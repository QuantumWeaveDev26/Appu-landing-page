import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../config';

const GUEST_TOKEN_KEY = 'appu_guest_token';

export interface HealthResponse {
  status: string;
}

export interface GuestSessionInfo {
  guestToken: string;
  remainingQuota: number;
  usedQuota: number;
  maxQuota: number;
}

export interface GuestStatusResponse {
  authenticated: boolean;
  guestSession?: GuestSessionInfo;
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
}

export interface MessageResponse {
  text: string | null;
  audioSource?: string | null;
  audioDurationMs?: number | null;
  guestSession?: GuestSessionInfo | null;
  conversationId?: string | null;
  error?: string;
  message?: string;
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
 */
export async function getGuestStatus(): Promise<GuestStatusResponse> {
  const token = await getStoredGuestToken();
  const url = new URL(`${config.apiBaseUrl}/api/appu/guest/status`);
  if (token) {
    url.searchParams.set('guestToken', token);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new ApiError(response.status, 'GUEST_STATUS_FAILED', `Guest status failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Sends a learner message to the APPU backend gateway (POST /api/appu/message).
 * Supports both authenticated (Bearer token + childId) and guest (guestToken) modes.
 */
export async function sendAppuMessage(options: SendMessageOptions): Promise<MessageResponse> {
  const url = `${config.apiBaseUrl}/api/appu/message`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
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
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data: MessageResponse = await response.json().catch(() => ({
    text: null,
    error: 'INVALID_JSON',
    message: 'Failed to parse response from server',
  }));

  if (data.guestSession?.guestToken) {
    await setStoredGuestToken(data.guestSession.guestToken);
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error || 'SERVER_ERROR',
      data.message || `Request failed with status ${response.status}`
    );
  }

  return data;
}
