import crypto from 'node:crypto';
import type { Queryable } from '../../db/types.js';
import type { GuestSession, GuestSessionTokenPayload, GuestQuotaResult, GuestStatusResult } from './types.js';
import { GuestRepository } from './repository.js';
import { GuestLimitReachedError, RateLimitedError } from '../../errors/index.js';

export interface GuestServiceConfig {
  maxTurns?: number;
  sessionTtlMs?: number;
  secret?: string;
  ipBurstLimit?: number;
  ipHourlyLimit?: number;
}

export class GuestSessionService {
  public static readonly DEFAULT_MAX_TURNS = 30; // BETA: raised from 3 for public beta testing
  public static readonly DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  public static readonly DEV_TEST_DEFAULT_SECRET = 'appu_guest_hmac_secret_key_2026_test_only_salt_9931';
  private static readonly IP_SALT = 'appu_privacy_ip_salt_7718';

  // In-memory LRU/TTL cache for speed and test isolation
  private static memoryStore = new Map<string, GuestSession>();
  // In-memory rate limiting tracking: ipHash -> timestamps array
  private static ipRequestTimestamps = new Map<string, number[]>();

  /**
   * Resolves authoritative server HMAC secret with environment override support.
   * In production (NODE_ENV=production), GUEST_SESSION_SECRET is strictly mandatory.
   */
  public static getSecret(providedSecret?: string): string {
    if (providedSecret && providedSecret.trim()) {
      return providedSecret.trim();
    }
    if (typeof process !== 'undefined' && process.env && process.env.GUEST_SESSION_SECRET && process.env.GUEST_SESSION_SECRET.trim()) {
      return process.env.GUEST_SESSION_SECRET.trim();
    }
    const isProd = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';
    if (isProd) {
      throw new Error('GUEST_SESSION_SECRET is required in production and must not be empty');
    }
    return this.DEV_TEST_DEFAULT_SECRET;
  }

  /**
   * Resets in-memory state (useful in test setups)
   */
  public static resetMemoryStore(): void {
    this.memoryStore.clear();
    this.ipRequestTimestamps.clear();
  }

  /**
   * Generates a privacy-preserving one-way hash of client IP.
   */
  public static computeIpHash(ip = '127.0.0.1'): string {
    const cleanIp = (ip || '127.0.0.1').trim().toLowerCase();
    return crypto
      .createHash('sha256')
      .update(`${cleanIp}:${this.IP_SALT}`, 'utf8')
      .digest('hex')
      .slice(0, 32);
  }

  /**
   * Signs a guest token using HMAC-SHA256.
   */
  public static signGuestToken(
    session: { id: string; turns: number; exp?: number; ipHash?: string },
    secret?: string
  ): string {
    const hmacSecret = this.getSecret(secret);
    const now = Date.now();
    const exp = session.exp || now + this.DEFAULT_SESSION_TTL_MS;
    const ipHash = session.ipHash || this.computeIpHash();

    const payload: GuestSessionTokenPayload = {
      id: session.id,
      turns: session.turns,
      iat: now,
      exp,
      ipHash
    };

    const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const signature = crypto
      .createHmac('sha256', hmacSecret)
      .update(payloadB64)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return `${payloadB64}.${signature}`;
  }

  /**
   * Verifies and decodes a signed guest token. Returns payload if valid, or null if tampered/expired.
   */
  public static verifyGuestToken(
    token?: string | null,
    secret?: string
  ): GuestSessionTokenPayload | null {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
      return null;
    }

    const hmacSecret = this.getSecret(secret);
    const [payloadB64, providedSig] = token.split('.');
    if (!payloadB64 || !providedSig) {
      return null;
    }

    const expectedSig = crypto
      .createHmac('sha256', hmacSecret)
      .update(payloadB64)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Constant-time signature comparison to prevent timing attacks
    if (providedSig.length !== expectedSig.length) {
      return null;
    }

    try {
      const match = crypto.timingSafeEqual(
        Buffer.from(providedSig, 'utf8'),
        Buffer.from(expectedSig, 'utf8')
      );
      if (!match) return null;

      const jsonStr = Buffer.from(
        payloadB64.replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
      ).toString('utf8');

      const payload: GuestSessionTokenPayload = JSON.parse(jsonStr);

      // Verify expiration
      if (typeof payload.exp !== 'number' || payload.exp < Date.now()) {
        return null;
      }

      if (typeof payload.id !== 'string' || typeof payload.turns !== 'number') {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Checks sliding window IP rate limit to prevent flood attacks.
   */
  public static checkIpRateLimit(
    ipHash: string,
    burstLimit = 10,
    windowMs = 60 * 1000
  ): void {
    const now = Date.now();
    const timestamps = this.ipRequestTimestamps.get(ipHash) || [];
    const activeTimestamps = timestamps.filter((ts) => now - ts < windowMs);

    if (activeTimestamps.length >= burstLimit) {
      throw new RateLimitedError('Too many requests. Please slow down and try again shortly.');
    }

    activeTimestamps.push(now);
    this.ipRequestTimestamps.set(ipHash, activeTimestamps);
  }

  /**
   * Resolves or creates an authoritative guest session.
   */
  public static async resolveGuestSession(
    db: Queryable | null,
    rawGuestToken?: string | null,
    clientIp = '127.0.0.1',
    secret?: string
  ): Promise<{ session: GuestSession; token: string }> {
    const ipHash = this.computeIpHash(clientIp);
    const decoded = this.verifyGuestToken(rawGuestToken, secret);

    let session: GuestSession | null = null;

    if (decoded) {
      // Prefer the database whenever available. It is authoritative for quota and
      // late callback reconciliation; memory is only a cache/fallback.
      if (db) {
        try {
          session = await GuestRepository.getById(db, decoded.id);
        } catch {
          session = null;
        }
      }

      if (!session) {
        session = this.memoryStore.get(decoded.id) || null;
      }

      // 3. If session not found in store but token was valid and unexpired, restore from token
      if (!session) {
        session = {
          id: decoded.id,
          ipHash,
          usedTurns: decoded.turns,
          createdAt: new Date(decoded.iat),
          updatedAt: new Date(),
          expiresAt: new Date(decoded.exp)
        };
        this.memoryStore.set(session.id, session);
        if (db) {
          await GuestRepository.upsert(db, session).catch(() => {});
        }
      }
    }

    // If no valid session, create a new one
    if (!session) {
      const newId = `gst_${crypto.randomUUID()}`;
      const expiresAt = new Date(Date.now() + this.DEFAULT_SESSION_TTL_MS);

      session = {
        id: newId,
        ipHash,
        usedTurns: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt
      };

      this.memoryStore.set(newId, session);
      if (db) {
        await GuestRepository.upsert(db, session).catch(() => {});
      }
    }

    const token = this.signGuestToken({
      id: session.id,
      turns: session.usedTurns,
      exp: session.expiresAt.getTime(),
      ipHash
    }, secret);

    return { session, token };
  }

  /**
   * Concurrency-safe atomic turn reservation prior to upstream n8n execution.
   * Throws GuestLimitReachedError immediately if turn limit is reached.
   */
  public static async reserveGuestTurn(
    db: Queryable | null,
    session: GuestSession,
    maxTurns = this.DEFAULT_MAX_TURNS
  ): Promise<{ reserved: boolean; used: number; remaining: number }> {
    if (session.usedTurns >= maxTurns) {
      throw new GuestLimitReachedError(
        'Your complimentary APPU chats are complete. Sign in to continue learning and save your progress.',
        {
          guestLimit: maxTurns,
          used: session.usedTurns,
          remaining: 0,
          loginRequired: true
        }
      );
    }

    let updatedSession: GuestSession | null = null;

    if (db) {
      updatedSession = await GuestRepository.reserveTurn(db, session.id, maxTurns);
      if (!updatedSession) {
        throw new GuestLimitReachedError(
          'Your complimentary APPU chats are complete. Sign in to continue learning and save your progress.',
          {
            guestLimit: maxTurns,
            used: maxTurns,
            remaining: 0,
            loginRequired: true
          }
        );
      }
      this.memoryStore.set(session.id, updatedSession);
    } else {
      // In-memory atomic reservation
      const memSession = this.memoryStore.get(session.id) || session;
      if (memSession.usedTurns >= maxTurns) {
        throw new GuestLimitReachedError(
          'Your complimentary APPU chats are complete. Sign in to continue learning and save your progress.',
          {
            guestLimit: maxTurns,
            used: memSession.usedTurns,
            remaining: 0,
            loginRequired: true
          }
        );
      }
      memSession.usedTurns += 1;
      memSession.updatedAt = new Date();
      this.memoryStore.set(session.id, memSession);
      updatedSession = memSession;
    }

    const remaining = Math.max(0, maxTurns - updatedSession.usedTurns);
    return {
      reserved: true,
      used: updatedSession.usedTurns,
      remaining
    };
  }

  /**
   * Releases a reserved turn if upstream provider fails.
   */
  public static async releaseGuestTurn(
    db: Queryable | null,
    sessionId: string
  ): Promise<void> {
    if (db) {
      const updated = await GuestRepository.releaseTurn(db, sessionId).catch(() => null);
      if (updated) {
        this.memoryStore.set(sessionId, updated);
      }
    } else {
      const memSession = this.memoryStore.get(sessionId);
      if (memSession && memSession.usedTurns > 0) {
        memSession.usedTurns -= 1;
        memSession.updatedAt = new Date();
        this.memoryStore.set(sessionId, memSession);
      }
    }
  }

  /**
   * Evaluates guest quota and raises GuestLimitReachedError if quota (3 turns) is exhausted.
   */
  public static evaluateGuestQuota(
    session: GuestSession,
    maxTurns = this.DEFAULT_MAX_TURNS,
    secret?: string
  ): GuestQuotaResult {
    const used = session.usedTurns;
    const remaining = Math.max(0, maxTurns - used);
    const allowed = used < maxTurns;

    const guestToken = this.signGuestToken({
      id: session.id,
      turns: used,
      exp: session.expiresAt.getTime(),
      ipHash: session.ipHash
    }, secret);

    if (!allowed) {
      throw new GuestLimitReachedError(
        'Your complimentary APPU chats are complete. Sign in to continue learning and save your progress.',
        {
          guestLimit: maxTurns,
          used,
          remaining: 0,
          loginRequired: true
        }
      );
    }

    return {
      allowed: true,
      used,
      limit: maxTurns,
      remaining,
      guestToken
    };
  }

  /**
   * Atomically records a successful guest turn and returns the updated quota result and newly signed token.
   */
  public static async recordSuccessfulTurn(
    db: Queryable | null,
    sessionId: string,
    maxTurns = this.DEFAULT_MAX_TURNS,
    secret?: string
  ): Promise<GuestQuotaResult> {
    let session = this.memoryStore.get(sessionId) || null;

    if (db) {
      try {
        const updated = await GuestRepository.incrementTurn(db, sessionId);
        if (updated) {
          session = updated;
          this.memoryStore.set(sessionId, updated);
        }
      } catch {
        // Fallback to in-memory increment if DB query errors
      }
    }

    if (!session) {
      const expiresAt = new Date(Date.now() + this.DEFAULT_SESSION_TTL_MS);
      session = {
        id: sessionId,
        ipHash: this.computeIpHash(),
        usedTurns: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt
      };
      this.memoryStore.set(sessionId, session);
    } else if (!db) {
      session.usedTurns += 1;
      session.updatedAt = new Date();
      this.memoryStore.set(sessionId, session);
    }

    const remaining = Math.max(0, maxTurns - session.usedTurns);
    const guestToken = this.signGuestToken({
      id: session.id,
      turns: session.usedTurns,
      exp: session.expiresAt.getTime(),
      ipHash: session.ipHash
    }, secret);

    return {
      allowed: session.usedTurns < maxTurns,
      used: session.usedTurns,
      limit: maxTurns,
      remaining,
      guestToken
    };
  }

  /**
   * Retrieves guest status for public inspection.
   */
  public static async getGuestStatus(
    db: Queryable | null,
    rawGuestToken?: string | null,
    clientIp = '127.0.0.1',
    maxTurns = this.DEFAULT_MAX_TURNS,
    secret?: string
  ): Promise<GuestStatusResult> {
    const { session, token } = await this.resolveGuestSession(db, rawGuestToken, clientIp, secret);
    const remaining = Math.max(0, maxTurns - session.usedTurns);

    return {
      guestLimit: maxTurns,
      used: session.usedTurns,
      remaining,
      loginRequired: session.usedTurns >= maxTurns,
      token
    };
  }
}
