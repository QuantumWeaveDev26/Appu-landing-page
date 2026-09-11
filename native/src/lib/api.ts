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
    const limit = data?.limit ?? data?.guestLimit ?? data?.guest?.limit ?? 5;
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

// ==========================================
// PARENT ZONE: CHILDREN & PERSONALISATION TYPES
// ==========================================

export interface ChildProfile {
  id: string;
  householdId: string;
  preferredName: string;
  gradeBand: string;
  nickname?: string | null;
  dob?: string | null;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateChildInput {
  preferredName: string;
  gradeBand: string;
  nickname?: string | null;
  dob?: string | null;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export interface UpdateChildInput {
  preferredName?: string;
  gradeBand?: string;
  nickname?: string | null;
  dob?: string | null;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export type FontPreference = 'friendly' | 'rounded' | 'clean';
export type LearningStyle = 'visual' | 'auditory' | 'kinesthetic' | 'reading_writing' | 'interactive';
export type ResponseStyle = 'playful' | 'balanced' | 'focused';
export type ThemePreference = 'auto' | 'bright' | 'calm';

export interface ChildPersonalisation {
  id?: string;
  childId: string;
  householdId?: string;
  preferredLanguage: string;
  favoriteColor?: string | null;
  fontPreference: FontPreference;
  learningStyle: LearningStyle;
  interests: string[];
  favoriteSubjects: string[];
  goals: string[];
  responseStyle: ResponseStyle;
  voicePreference?: string;
  themePreference: ThemePreference;
  parentPhone?: string | null;
  whatsappConsent?: boolean;
  nickname?: string | null;
  dob?: string | null;
  additionalContext?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdatePersonalisationInput {
  preferredLanguage?: string;
  learningStyle?: LearningStyle;
  fontPreference?: FontPreference;
  responseStyle?: ResponseStyle;
  themePreference?: ThemePreference;
  favoriteColor?: string | null;
  interests?: string[];
  favoriteSubjects?: string[];
  goals?: string[];
  parentPhone?: string | null;
  whatsappConsent?: boolean;
  nickname?: string | null;
  dob?: string | null;
}

export interface SubscriptionInfo {
  id: string;
  planCode: string;
  status: 'ACTIVE' | 'AUTHENTICATED' | 'PENDING_PAYMENT' | 'PAST_DUE' | 'PAUSED' | 'HALTED' | 'CANCELLED' | 'EXPIRED';
  providerSubscriptionId?: string | null;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface EntitlementsInfo {
  monthly_ai_sessions?: number;
  monthly_voice_minutes?: number;
  multilingual?: boolean;
  advanced_personalisation?: boolean;
  parent_reports?: boolean;
  long_term_context?: boolean;
  premium_themes?: boolean;
  max_children?: number;
}

export interface CurrentSubscriptionResponse {
  hasSubscription: boolean;
  subscription: SubscriptionInfo | null;
  entitlements: EntitlementsInfo | null;
}

export interface UsageSummaryResponse {
  period?: {
    startsAt?: string;
    endsAt?: string;
    source?: string;
  };
  aiSessions?: {
    used: number;
    limit: number;
    remaining: number;
  };
  voiceMinutes?: {
    used: number | null;
    limit: number;
    remaining: number | null;
    meteringStatus?: string;
  };
}

export interface PlanItem {
  code: string;
  tierCode: string;
  tierName: string;
  name: string;
  description: string;
  currency: string;
  amountPaise: number;
  displayPrice: string;
  billingInterval: 'monthly' | 'yearly';
  isPublic: boolean;
  isPrimaryCard: boolean;
  isRecommended: boolean;
  entitlements?: EntitlementsInfo;
}

// ==========================================
// VALIDATION HELPERS (Parity with Web & Backend)
// ==========================================

export function validateChildNickname(nickname?: string | null): { valid: boolean; errorKey?: string } {
  if (!nickname || !nickname.trim()) return { valid: true };
  const trimmed = nickname.trim();
  if (trimmed.length > 50) return { valid: false, errorKey: 'nicknameTooLongAlert' };
  if (/[<>`$]/.test(trimmed)) return { valid: false, errorKey: 'nicknameInvalidAlert' };
  return { valid: true };
}

export function validateChildDob(dob?: string | null): { valid: boolean; errorKey?: string } {
  if (!dob || !dob.trim()) return { valid: true };
  const trimmed = dob.trim();
  const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dobRegex.test(trimmed)) return { valid: false, errorKey: 'dobAgeInvalidAlert' };
  const parts = trimmed.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return { valid: false, errorKey: 'dobAgeInvalidAlert' };
  }
  const now = new Date();
  if (parsed > now) return { valid: false, errorKey: 'dobAgeInvalidAlert' };
  const ageYears = (now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (ageYears < 3 || ageYears > 25) {
    return { valid: false, errorKey: 'dobAgeInvalidAlert' };
  }
  return { valid: true };
}

export function normalizePhoneNumber(raw?: string | null): string | false | null {
  if (raw === undefined || raw === null) return null;
  const cleaned = String(raw).trim().replace(/[\s\-()]/g, '');
  if (!cleaned) return null;
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith('+')) {
    if (/^\+[1-9]\d{6,14}$/.test(cleaned)) {
      return cleaned;
    }
    return false;
  }
  if (/^\d{7,15}$/.test(cleaned)) {
    const withPlus = `+${cleaned}`;
    if (/^\+[1-9]\d{6,14}$/.test(withPlus)) {
      return withPlus;
    }
  }
  return false;
}

// ==========================================
// PARENT ZONE: API ENDPOINTS
// ==========================================

export interface HouseholdInfo {
  id: string;
  name: string;
  role?: string;
}

export interface OnboardHouseholdResponse {
  household: HouseholdInfo;
  role: string;
  isNew: boolean;
}

/**
 * Ensures the authenticated parent has an active household.
 * Idempotently creates one if none exists.
 * POST /api/household/onboard
 */
export async function ensureHousehold(
  accessToken: string,
  householdName?: string
): Promise<HouseholdInfo> {
  if (!accessToken) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Access token required');
  }
  const url = `${config.apiBaseUrl}/api/household/onboard`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken.trim()}`,
    },
    body: JSON.stringify({
      householdName: householdName?.trim() || 'Family Household',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      err.code || err.error?.code || 'ONBOARD_HOUSEHOLD_FAILED',
      err.message || err.error?.message || 'Failed to initialize household'
    );
  }

  const data: OnboardHouseholdResponse = await response.json();
  return data.household;
}

/**
 * Retrieves authenticated user and household context.
 * GET /api/auth/me
 */
export async function fetchAuthMe(accessToken: string): Promise<{
  authenticated: boolean;
  userId: string;
  household: HouseholdInfo | null;
}> {
  if (!accessToken) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Access token required');
  }
  const url = `${config.apiBaseUrl}/api/auth/me`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken.trim()}`,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      err.code || 'AUTH_ME_FAILED',
      err.message || 'Failed to fetch auth info'
    );
  }

  return response.json();
}

/**
 * Lists all child profiles for the authenticated parent's household.
 * GET /api/children
 */
export async function fetchChildren(accessToken: string): Promise<ChildProfile[]> {
  if (!accessToken) return [];
  // Ensure household exists first so GET /api/children succeeds for fresh accounts
  await ensureHousehold(accessToken).catch((err) => {
    console.warn('[API] ensureHousehold pre-check non-fatal error:', err);
  });

  const url = `${config.apiBaseUrl}/api/children`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken.trim()}`,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      err.code || err.error?.code || 'FETCH_CHILDREN_FAILED',
      err.message || err.error?.message || 'Failed to load learner profiles'
    );
  }

  const data = await response.json();
  return data.children || [];
}

/**
 * Creates a new child profile under the verified parent's household.
 * POST /api/children
 */
export async function createChild(
  accessToken: string,
  input: CreateChildInput
): Promise<ChildProfile> {
  // Ensure household exists before creating child
  await ensureHousehold(accessToken).catch((err) => {
    console.warn('[API] ensureHousehold pre-create non-fatal error:', err);
  });

  const url = `${config.apiBaseUrl}/api/children`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken.trim()}`,
    },
    body: JSON.stringify({
      preferredName: input.preferredName.trim(),
      gradeBand: input.gradeBand.trim(),
      nickname: input.nickname?.trim() || null,
      dob: input.dob?.trim() || null,
      status: input.status || 'ACTIVE',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      err.code || err.error?.code || 'CREATE_CHILD_FAILED',
      err.message || err.error?.message || 'Failed to create child profile'
    );
  }

  const data = await response.json();
  return data.child;
}

/**
 * Updates a child profile.
 * PATCH /api/children/:childId
 */
export async function updateChild(
  accessToken: string,
  childId: string,
  input: UpdateChildInput
): Promise<ChildProfile> {
  const url = `${config.apiBaseUrl}/api/children/${childId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken.trim()}`,
    },
    body: JSON.stringify({
      preferredName: input.preferredName?.trim(),
      gradeBand: input.gradeBand?.trim(),
      nickname: input.nickname !== undefined ? (input.nickname?.trim() || null) : undefined,
      dob: input.dob !== undefined ? (input.dob?.trim() || null) : undefined,
      status: input.status,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      err.code || err.error?.code || 'UPDATE_CHILD_FAILED',
      err.message || err.error?.message || 'Failed to update child profile'
    );
  }

  const data = await response.json();
  return data.child;
}

/**
 * Fetches personalization settings for a specific child.
 * GET /api/children/:childId/personalisation
 */
export async function fetchPersonalisation(
  accessToken: string,
  childId: string
): Promise<ChildPersonalisation | null> {
  if (!accessToken || !childId) return null;
  const url = `${config.apiBaseUrl}/api/children/${childId}/personalisation`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken.trim()}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.personalisation || null;
}

/**
 * Saves/updates personalization settings for a child.
 * PUT /api/children/:childId/personalisation
 */
export async function savePersonalisation(
  accessToken: string,
  childId: string,
  input: UpdatePersonalisationInput
): Promise<ChildPersonalisation> {
  const url = `${config.apiBaseUrl}/api/children/${childId}/personalisation`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken.trim()}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      err.code || err.error?.code || 'SAVE_PERSONALISATION_FAILED',
      err.message || err.error?.message || 'Failed to save personalization'
    );
  }

  const data = await response.json();
  return data.personalisation;
}

/**
 * Fetches current household subscription details.
 * GET /api/subscriptions/current
 */
export async function fetchCurrentSubscription(
  accessToken: string
): Promise<CurrentSubscriptionResponse> {
  const url = `${config.apiBaseUrl}/api/subscriptions/current`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken.trim()}`,
    },
  });

  if (!response.ok) {
    return {
      hasSubscription: false,
      subscription: null,
      entitlements: null,
    };
  }

  return response.json();
}

/**
 * Fetches authoritative usage summary for the household.
 * GET /api/usage/current
 */
export async function fetchCurrentUsage(
  accessToken: string
): Promise<UsageSummaryResponse> {
  const url = `${config.apiBaseUrl}/api/usage/current`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken.trim()}`,
    },
  });

  if (!response.ok) {
    return {
      aiSessions: { used: 0, limit: 30, remaining: 30 },
      voiceMinutes: { used: 0, limit: 60, remaining: 60 },
    };
  }

  return response.json();
}

/**
 * Fetches available subscription plans.
 * GET /api/plans
 */
export async function fetchPlans(): Promise<PlanItem[]> {
  const url = `${config.apiBaseUrl}/api/plans`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.plans || [];
}

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export interface StoredConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  created_at: string;
  audio_source?: string | null;
}

/**
 * Lists recent conversations for an active child.
 * GET /api/appu/conversations?childId=<childId>
 */
export async function fetchConversations(
  accessToken: string,
  childId: string
): Promise<ConversationSummary[]> {
  try {
    const url = `${config.apiBaseUrl}/api/appu/conversations?childId=${encodeURIComponent(childId)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken.trim()}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.conversations || [];
  } catch (err) {
    console.warn('[API] Failed to fetch conversations:', err);
    return [];
  }
}

/**
 * Fetches messages for a specific conversation.
 * GET /api/appu/conversations/:conversationId/messages?childId=<childId>
 */
export async function fetchConversationMessages(
  accessToken: string,
  childId: string,
  conversationId: string
): Promise<StoredConversationMessage[]> {
  try {
    const url = `${config.apiBaseUrl}/api/appu/conversations/${encodeURIComponent(conversationId)}/messages?childId=${encodeURIComponent(childId)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken.trim()}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.messages || [];
  } catch (err) {
    console.warn('[API] Failed to fetch conversation messages:', err);
    return [];
  }
}

/**
 * Deletes a conversation for an active child.
 * DELETE /api/appu/conversations/:conversationId?childId=<childId>
 */
export async function deleteConversation(
  accessToken: string,
  childId: string,
  conversationId: string
): Promise<boolean> {
  try {
    const url = `${config.apiBaseUrl}/api/appu/conversations/${encodeURIComponent(conversationId)}?childId=${encodeURIComponent(childId)}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken.trim()}`,
      },
    });

    return response.ok;
  } catch (err) {
    console.warn('[API] Failed to delete conversation:', err);
    return false;
  }
}


