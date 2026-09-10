import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../config';

const GUEST_TOKEN_KEY = 'appu_guest_token';

export interface HealthResponse {
  status: string;
}

export interface GuestQuotaInfo {
  token?: string;
  limit: number;
  guestLimit?: number;
  used: number;
  remaining: number;
  loginRequired: boolean;
}

export interface GuestStatusResponse {
  authenticated?: boolean;
  guestLimit: number;
  limit: number;
  used: number;
  remaining: number;
  loginRequired: boolean;
  token: string;
  guest?: GuestQuotaInfo;
  guestSession?: GuestQuotaInfo;
  error?: string;
  message?: string;
}

export interface SendMessageOptions {
  message: string;
  language?: 'en' | 'kn' | 'hi';
  includeAudio?: boolean;
  childId?: string;
  conversationId?: string;
  newConversation?: boolean;
  accessToken?: string;
  guestToken?: string;
  idempotencyKey?: string;
}

export interface MessageResponse {
  requestId?: string;
  requestStatus?: string;
  childId?: string | null;
  conversationId?: string | null;
  text: string | null;
  audioSource?: string | null;
  audioStreamUrl?: string | null;
  audioDurationMs?: number | null;
  idempotentReplay?: boolean;
  guest?: GuestQuotaInfo | null;
  guestSession?: GuestQuotaInfo | null;
  error?: string;
  code?: string;
  message?: string;
  loginRequired?: boolean;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Returns stored guest session token from AsyncStorage.
 */
export async function getStoredGuestToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(GUEST_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Persists guest session token into AsyncStorage.
 */
export async function setStoredGuestToken(token: string): Promise<void> {
  try {
    if (token && token.trim()) {
      await AsyncStorage.setItem(GUEST_TOKEN_KEY, token.trim());
    }
  } catch (err) {
    console.warn('[API] Failed to store guest token:', err);
  }
}

/**
 * Clears stored guest session token from AsyncStorage.
 */
export async function clearStoredGuestToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GUEST_TOKEN_KEY);
  } catch (err) {
    console.warn('[API] Failed to clear guest token:', err);
  }
}

/**
 * Liveness probe against the backend service.
 */
export async function pingHealth(): Promise<HealthResponse> {
  const url = `${config.apiBaseUrl}/health`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new ApiError(response.status, 'HEALTH_CHECK_FAILED', `Health check failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Resolves current guest status & remaining turns.
 * Hits /api/appu/guest-status with X-Guest-Session-Token header.
 */
export async function getGuestStatus(): Promise<GuestStatusResponse> {
  const token = await getStoredGuestToken();
  const url = `${config.apiBaseUrl}/api/appu/guest-status`;
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (token) {
    headers['X-Guest-Session-Token'] = token;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new ApiError(response.status, 'GUEST_STATUS_FAILED', `Guest status failed: ${response.statusText}`);
  }

  const headerToken = response.headers.get('x-guest-session-token');
  const data = await response.json();

  const activeToken =
    headerToken ||
    data?.token ||
    data?.guest?.token ||
    data?.guestSession?.token;

  if (activeToken) {
    await setStoredGuestToken(activeToken);
  }

  const limit = data.guestLimit ?? data.limit ?? data.guest?.limit ?? 3;
  const used = data.used ?? data.guest?.used ?? 0;
  const remaining = data.remaining ?? data.guest?.remaining ?? 3;
  const loginRequired = Boolean(data.loginRequired ?? data.guest?.loginRequired);

  const quotaInfo: GuestQuotaInfo = {
    token: activeToken,
    limit,
    guestLimit: limit,
    used,
    remaining,
    loginRequired,
  };

  return {
    ...data,
    limit,
    guestLimit: limit,
    used,
    remaining,
    loginRequired,
    token: activeToken || data.token,
    guest: quotaInfo,
    guestSession: quotaInfo,
  };
}

/**
 * Sends a learner message to the APPU backend gateway (POST /api/appu/message).
 * Supports both authenticated (Bearer token + childId) and guest (guestToken) modes.
 * Includes Idempotency-Key and X-Guest-Session-Token headers.
 */
export async function sendAppuMessage(options: SendMessageOptions): Promise<MessageResponse> {
  const url = `${config.apiBaseUrl}/api/appu/message`;
  const idempotencyKey =
    options.idempotencyKey ||
    `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Idempotency-Key': idempotencyKey,
  };

  const body: Record<string, unknown> = {
    message: options.message,
    language: options.language || 'en',
    includeAudio: Boolean(options.includeAudio),
  };

  if (options.conversationId) {
    body.conversationId = options.conversationId;
  }
  if (options.newConversation) {
    body.newConversation = true;
  }

  if (options.accessToken) {
    headers['Authorization'] = `Bearer ${options.accessToken}`;
    if (options.childId) {
      body.childId = options.childId;
    }
  } else {
    const guestToken = options.guestToken || (await getStoredGuestToken());
    if (guestToken) {
      body.guestToken = guestToken;
      headers['X-Guest-Session-Token'] = guestToken;
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const headerToken = response.headers.get('x-guest-session-token');
  let data: any;
  try {
    data = await response.json();
  } catch {
    data = {
      text: null,
      error: 'INVALID_JSON',
      message: 'Failed to parse response from server',
    };
  }

  // Handle 403 GUEST_LIMIT_REACHED cleanly without throwing hard error
  const errCode = data?.code || data?.error?.code;
  if (response.status === 403 && (errCode === 'GUEST_LIMIT_REACHED' || data?.loginRequired || data?.guest?.loginRequired)) {
    const limit = data?.limit ?? data?.guestLimit ?? data?.guest?.limit ?? 3;
    const used = data?.used ?? data?.guest?.used ?? limit;
    const quotaInfo: GuestQuotaInfo = {
      limit,
      guestLimit: limit,
      used,
      remaining: 0,
      loginRequired: true,
      token: (await getStoredGuestToken()) || undefined,
    };
    return {
      requestId: data?.requestId,
      requestStatus: 'FAILED',
      text: data?.message || "Your complimentary APPU chats are complete. Sign in to continue learning and save your progress.",
      audioSource: null,
      audioStreamUrl: null,
      audioDurationMs: null,
      error: 'guest_limit_reached',
      code: 'GUEST_LIMIT_REACHED',
      loginRequired: true,
      guest: quotaInfo,
      guestSession: quotaInfo,
    };
  }

  const activeToken =
    headerToken ||
    data?.guest?.token ||
    data?.guestSession?.token ||
    data?.token;

  if (activeToken) {
    await setStoredGuestToken(activeToken);
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.code || data.error || 'SERVER_ERROR',
      data.message || `Request failed with status ${response.status}`
    );
  }

  const normalizedQuota: GuestQuotaInfo | null = data.guest
    ? {
        token: data.guest.token || activeToken,
        limit: data.guest.limit ?? data.guest.guestLimit ?? 3,
        guestLimit: data.guest.limit ?? data.guest.guestLimit ?? 3,
        used: data.guest.used ?? 0,
        remaining: data.guest.remaining ?? 0,
        loginRequired: Boolean(data.guest.loginRequired),
      }
    : data.guestSession
    ? {
        token: data.guestSession.token || activeToken,
        limit: data.guestSession.limit ?? data.guestSession.guestLimit ?? 3,
        guestLimit: data.guestSession.limit ?? data.guestSession.guestLimit ?? 3,
        used: data.guestSession.used ?? 0,
        remaining: data.guestSession.remaining ?? 0,
        loginRequired: Boolean(data.guestSession.loginRequired),
      }
    : null;

  return {
    ...data,
    guest: normalizedQuota,
    guestSession: normalizedQuota,
  };
}
