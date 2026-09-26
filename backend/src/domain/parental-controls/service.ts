import crypto from 'node:crypto';
import type { Queryable } from '../../db/types.js';
import { createAppuHmacSignature } from '../gateway/hmac.js';
import { TenancyRepository } from '../tenancy/repository.js';
import { ParentalControlsRepository } from './repository.js';
import type {
  HeartbeatInput,
  HeartbeatResult,
  RequestOtpInput,
  RequestOtpResult,
  VerifyOtpInput,
  VerifyOtpResult,
  SendNoteInput,
  SendNoteResult,
  SessionUsageResult
} from './types.js';

export interface ParentalControlsServiceOptions {
  enabled?: boolean;
  lockIntervalSeconds?: number;
  n8nWebhookUrl?: string;
  fetchFn?: typeof fetch;
  requestSigningSecret?: string | null;
  logger?: {
    warn: (objOrMsg: any, msg?: string) => void;
    info?: (objOrMsg: any, msg?: string) => void;
    error?: (objOrMsg: any, msg?: string) => void;
  };
}

export function sanitizeMetaParam(text: string | null | undefined, maxLength: number): string {
  if (!text) return '';
  const cleaned = text.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength - 3).trim() + '...';
}

async function sendMetaTemplateViaN8n(
  webhookUrl: string | undefined,
  recipientPhone: string,
  templateName: string,
  payloadData: {
    parameters?: Array<{ type: 'text'; text: string }>;
    components?: any[];
  },
  fetchFn: typeof fetch,
  logger?: any,
  requestSigningSecret?: string | null
): Promise<boolean> {
  if (!webhookUrl) {
    logger?.warn?.(
      { templateName, recipientPhone },
      'N8N_WHATSAPP_TEMPLATE_WEBHOOK_URL not configured; skipping dispatch'
    );
    return false;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const bodyObj: Record<string, any> = {
      recipientPhone,
      templateName,
      templateLanguage: 'en'
    };
    if (payloadData.components) {
      bodyObj.components = payloadData.components;
    } else if (payloadData.parameters) {
      bodyObj.parameters = payloadData.parameters;
    }

    const rawBody = JSON.stringify(bodyObj);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (requestSigningSecret && requestSigningSecret.trim().length > 0) {
      const timestamp = String(Math.floor(Date.now() / 1000));
      headers['X-APPU-Timestamp'] = timestamp;
      headers['X-APPU-Signature'] = createAppuHmacSignature(rawBody, timestamp, requestSigningSecret.trim());
    }

    const res = await fetchFn(webhookUrl, {
      method: 'POST',
      headers,
      body: rawBody,
      signal: controller.signal
    });
    clearTimeout(timeout);
    return res.ok;
  } catch (err: any) {
    logger?.warn?.(
      { err: err?.message || err, templateName, recipientPhone },
      'Failed to post Meta template to n8n webhook'
    );
    return false;
  }
}

export class ParentalControlsService {
  /**
   * Accumulates active/away seconds from client heartbeats and reports lock status.
   */
  static async recordHeartbeat(
    db: Queryable,
    householdId: string,
    input: HeartbeatInput,
    options?: ParentalControlsServiceOptions
  ): Promise<HeartbeatResult> {
    const lockInterval = Math.max(60, options?.lockIntervalSeconds ?? 1800);
    const isEnabled = Boolean(options?.enabled);

    if (!isEnabled) {
      return {
        enabled: false,
        locked: false,
        activeSeconds: 0,
        awaySeconds: 0,
        timeRemainingSeconds: lockInterval
      };
    }

    const addActiveSec = Math.max(0, Math.min(300, Math.round((input.activeMsSinceLast ?? 0) / 1000)));
    const addAwaySec = Math.max(0, Math.min(300, Math.round((input.awayMsSinceLast ?? 0) / 1000)));

    const usage = await ParentalControlsRepository.upsertHeartbeat(
      db,
      input.sessionId,
      householdId,
      input.childId,
      addActiveSec,
      addAwaySec
    );

    // Lock on total wall-clock time (active + away): the 30-min limit counts
    // from session entry regardless of whether the tab was focused or backgrounded.
    const totalSeconds = usage.activeSeconds + usage.awaySeconds;
    const locked = totalSeconds >= lockInterval;
    const timeRemainingSeconds = Math.max(0, lockInterval - totalSeconds);

    return {
      enabled: true,
      locked,
      activeSeconds: usage.activeSeconds,
      awaySeconds: usage.awaySeconds,
      timeRemainingSeconds
    };
  }

  /**
   * Retrieves current session usage metrics without mutating state.
   */
  static async getSessionUsage(
    db: Queryable,
    householdId: string,
    childId: string,
    sessionId: string,
    options?: ParentalControlsServiceOptions
  ): Promise<SessionUsageResult> {
    const lockInterval = Math.max(60, options?.lockIntervalSeconds ?? 1800);
    const isEnabled = Boolean(options?.enabled);

    if (!isEnabled) {
      return {
        enabled: false,
        locked: false,
        activeSeconds: 0,
        awaySeconds: 0,
        timeRemainingSeconds: lockInterval
      };
    }

    const usage = await ParentalControlsRepository.getSessionUsage(db, sessionId, householdId, childId);
    if (!usage) {
      return {
        enabled: true,
        locked: false,
        activeSeconds: 0,
        awaySeconds: 0,
        timeRemainingSeconds: lockInterval
      };
    }

    // Lock on total wall-clock time (active + away): the 30-min limit counts
    // from session entry regardless of whether the tab was focused or backgrounded.
    const totalSeconds = usage.activeSeconds + usage.awaySeconds;
    const locked = totalSeconds >= lockInterval;
    const timeRemainingSeconds = Math.max(0, lockInterval - totalSeconds);

    return {
      enabled: true,
      locked,
      activeSeconds: usage.activeSeconds,
      awaySeconds: usage.awaySeconds,
      timeRemainingSeconds
    };
  }

  /**
   * Generates a 6-digit numeric OTP, stores SHA-256 hash, and dispatches via n8n.
   */
  static async requestOtp(
    db: Queryable,
    householdId: string,
    input: RequestOtpInput,
    options?: ParentalControlsServiceOptions
  ): Promise<RequestOtpResult> {
    const isEnabled = Boolean(options?.enabled);
    if (!isEnabled) {
      return { requested: false, error: 'parental_controls_disabled' };
    }

    const fetchClient = options?.fetchFn ?? globalThis.fetch;

    // Check parent phone and WhatsApp consent
    const notifPrefs = await TenancyRepository.getNotificationPreferences(db, householdId);
    if (!notifPrefs.parentPhone || !notifPrefs.whatsappConsent) {
      return { requested: false, needsPhone: true };
    }

    // Rate-limit check: maximum 5 requests per hour for this session
    const oneHourAgo = new Date(Date.now() - 3600_000);
    const recentCount = await ParentalControlsRepository.countRecentOtps(
      db,
      householdId,
      input.sessionId,
      oneHourAgo
    );
    if (recentCount >= 5) {
      return { requested: false, error: 'rate_limited', retryAfterSeconds: 300 };
    }

    // Generate secure 6-digit numeric OTP and SHA-256 hash
    const otp = crypto.randomInt(100000, 1000000).toString();
    const codeHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60_000); // 10 minutes expiry

    await ParentalControlsRepository.createOtp(
      db,
      householdId,
      input.childId,
      input.sessionId,
      codeHash,
      expiresAt
    );

    // Retrieve current usage metrics
    const usage = await ParentalControlsRepository.getSessionUsage(
      db,
      input.sessionId,
      householdId,
      input.childId
    );
    const activeSec = usage?.activeSeconds ?? 0;
    const awaySec = usage?.awaySeconds ?? 0;

    // Dispatch OTP template: appu_parent_otp
    await sendMetaTemplateViaN8n(
      options?.n8nWebhookUrl,
      notifPrefs.parentPhone,
      'appu_parent_otp',
      {
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: otp }]
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: otp }]
          }
        ]
      },
      fetchClient,
      options?.logger,
      options?.requestSigningSecret
    );

    // Dispatch Usage Report template: appu_screentime_report
    const child = await TenancyRepository.getChildProfile(db, householdId, input.childId).catch(() => null);
    const childName = sanitizeMetaParam(child?.nickname || child?.preferredName || 'Learner', 40);
    const activeMin = String(Math.max(1, Math.round(activeSec / 60)));
    const awayMin = String(Math.round(awaySec / 60));

    await sendMetaTemplateViaN8n(
      options?.n8nWebhookUrl,
      notifPrefs.parentPhone,
      'appu_screentime_report',
      {
        parameters: [
          { type: 'text', text: childName },
          { type: 'text', text: activeMin },
          { type: 'text', text: awayMin }
        ]
      },
      fetchClient,
      options?.logger,
      options?.requestSigningSecret
    );

    return {
      requested: true,
      expiresInSeconds: 600,
      activeSeconds: activeSec,
      awaySeconds: awaySec
    };
  }

  /**
   * Verifies the submitted OTP against the active challenge and resets the 30-min window on success.
   */
  static async verifyOtp(
    db: Queryable,
    householdId: string,
    input: VerifyOtpInput,
    options?: ParentalControlsServiceOptions
  ): Promise<VerifyOtpResult> {
    const isEnabled = Boolean(options?.enabled);
    if (!isEnabled) {
      return { verified: false, error: 'parental_controls_disabled' };
    }

    const activeOtp = await ParentalControlsRepository.getLatestActiveOtp(db, input.sessionId);
    if (!activeOtp || activeOtp.expiresAt < new Date()) {
      return { verified: false, error: 'expired_or_not_found' };
    }

    if (activeOtp.attempts >= 5) {
      return { verified: false, error: 'max_attempts_exceeded', lockedOut: true };
    }

    const submittedHash = crypto.createHash('sha256').update(input.code.trim()).digest('hex');
    if (submittedHash !== activeOtp.codeHash) {
      const newAttempts = await ParentalControlsRepository.incrementOtpAttempts(db, activeOtp.id);
      const attemptsLeft = Math.max(0, 5 - newAttempts);
      return {
        verified: false,
        attemptsLeft,
        ...(attemptsLeft === 0 ? { lockedOut: true, error: 'max_attempts_exceeded' } : {})
      };
    }

    // Success: consume OTP and reset the usage window to zero
    await ParentalControlsRepository.consumeOtp(db, activeOtp.id);
    await ParentalControlsRepository.resetUsageWindow(db, input.sessionId, householdId, input.childId);

    return { verified: true, windowReset: true };
  }

  /**
   * Sends study notes directly to the parent's verified WhatsApp number via template appu_study_note.
   */
  static async sendStudyNoteToWhatsApp(
    db: Queryable,
    householdId: string,
    input: SendNoteInput,
    options?: ParentalControlsServiceOptions
  ): Promise<SendNoteResult> {
    const notifPrefs = await TenancyRepository.getNotificationPreferences(db, householdId);
    if (!notifPrefs.parentPhone || !notifPrefs.whatsappConsent) {
      return { sent: false, needsPhone: true };
    }

    const child = await TenancyRepository.getChildProfile(db, householdId, input.childId).catch(() => null);
    const childName = sanitizeMetaParam(child?.nickname || child?.preferredName || 'Learner', 40);

    const noteFlattened = sanitizeMetaParam(input.note, 1024);
    if (!noteFlattened) {
      return { sent: false, error: 'empty_note' };
    }

    const fetchClient = options?.fetchFn ?? globalThis.fetch;
    const sent = await sendMetaTemplateViaN8n(
      options?.n8nWebhookUrl,
      notifPrefs.parentPhone,
      'appu_study_note',
      {
        parameters: [
          { type: 'text', text: childName },
          { type: 'text', text: noteFlattened }
        ]
      },
      fetchClient,
      options?.logger,
      options?.requestSigningSecret
    );

    return { sent };
  }
}
