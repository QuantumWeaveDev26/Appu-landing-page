/**
 * AppuBackendClient: Browser-side Secure Gateway Client
 * 
 * Communicates with the Phase 2 backend gateway endpoint (POST /api/appu/message).
 * 
 * SECURITY INVARIANTS:
 * - Authenticated browser sends ONLY: childId, message, language, plus Authorization Bearer token.
 * - Guest browser sends ONLY: message, language, guestToken.
 * - Browser NEVER passes: householdId, plan, entitlements, personalisation, n8n webhook URL.
 * - Upstream server errors and status codes are mapped to safe, friendly child-facing messages.
 * - Access token is NEVER logged or echoed.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.AppuBackendClient = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function getApiBaseUrl() {
    if (
      typeof globalThis !== 'undefined' &&
      globalThis.APPU_CONFIG &&
      typeof globalThis.APPU_CONFIG.apiBaseUrl === 'string' &&
      globalThis.APPU_CONFIG.apiBaseUrl.trim()
    ) {
      return globalThis.APPU_CONFIG.apiBaseUrl.replace(/\/+$/, '');
    }
    return 'https://antiquewhite-elk-758047.hostingersite.com';
  }

  function getStoredGuestToken() {
    try {
      if (typeof localStorage !== 'undefined') {
        const tok = localStorage.getItem('appu_guest_token');
        if (tok && typeof tok === 'string' && tok.trim()) return tok.trim();
      }
    } catch {}
    try {
      if (typeof sessionStorage !== 'undefined') {
        const tok = sessionStorage.getItem('appu_guest_token');
        if (tok && typeof tok === 'string' && tok.trim()) return tok.trim();
      }
    } catch {}
    return null;
  }

  function setStoredGuestToken(token) {
    if (!token || typeof token !== 'string' || !token.trim()) return;
    const cleanToken = token.trim();
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('appu_guest_token', cleanToken);
      }
    } catch {}
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('appu_guest_token', cleanToken);
      }
    } catch {}
  }

  /**
   * Retrieves current guest session status from server.
   */
  async function getGuestStatus(params = {}) {
    const apiBase = params.baseUrl ? params.baseUrl.replace(/\/+$/, '') : getApiBaseUrl();
    const endpoint = `${apiBase}/api/appu/guest-status`;

    const storedToken = params.guestToken || getStoredGuestToken();

    const headers = { 'Content-Type': 'application/json' };
    if (storedToken) {
      headers['X-Guest-Session-Token'] = storedToken;
    }

    try {
      const res = await fetch(endpoint, { method: 'GET', headers });
      if (res.ok) {
        const headerToken = (res.headers && typeof res.headers.get === 'function')
          ? res.headers.get('x-guest-session-token')
          : null;
        const data = await res.json();
        const activeToken = headerToken || data.token || data.guest?.token || data.guestSession?.token || storedToken;

        if (activeToken) {
          setStoredGuestToken(activeToken);
        }

        const limit = data.limit ?? data.guestLimit ?? data.guest?.limit ?? data.guestSession?.guestLimit ?? 3;
        const used = data.used ?? data.guest?.used ?? data.guestSession?.used ?? 0;
        const remaining = data.remaining ?? data.guest?.remaining ?? data.guestSession?.remaining ?? Math.max(0, limit - used);
        const loginRequired = Boolean(data.loginRequired ?? data.guest?.loginRequired ?? data.guestSession?.loginRequired ?? (remaining <= 0));

        const quotaInfo = {
          limit,
          guestLimit: limit,
          used,
          remaining,
          loginRequired,
          token: activeToken
        };

        return {
          ...quotaInfo,
          guest: quotaInfo,
          guestSession: quotaInfo
        };
      }
    } catch {
      // Fallback
    }

    const defaultQuota = {
      limit: 3,
      guestLimit: 3,
      used: 0,
      remaining: 3,
      loginRequired: false,
      token: storedToken
    };

    return {
      ...defaultQuota,
      guest: defaultQuota,
      guestSession: defaultQuota
    };
  }

  /**
   * Sends learner or guest message to the secure Appu backend gateway.
   * 
   * @param {Object} params
   * @param {string} [params.accessToken] - Valid parent JWT access token (optional for guests)
   * @param {string} [params.childId] - Verified child profile UUID (optional for guests)
   * @param {string} params.message - User prompt text
   * @param {string} [params.language='en'] - Preferred language code
   * @param {string} [params.guestToken] - Optional guest session token
   * @param {string} [params.baseUrl] - Optional override for API base URL
   * @param {boolean} [params.includeAudio] - Whether Appu should generate audio for this response (default true)
   * @returns {Promise<{ text: string, audioSource: string|null, childId?: string, error?: string, code?: string, guest?: any, guestSession?: any }>}
   */
  async function sendAppuMessage(params) {
    if (!params || typeof params !== 'object') {
      throw new Error('sendAppuMessage requires an options object');
    }

    const { accessToken, childId, message, language = 'en', baseUrl, guestToken, includeAudio } = params;

    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new Error('Message cannot be empty');
    }

    const isAuthenticated = typeof accessToken === 'string' && accessToken.trim().length > 0;

    const apiBase = baseUrl ? baseUrl.replace(/\/+$/, '') : getApiBaseUrl();
    const endpoint = `${apiBase}/api/appu/message`;

    // Strictly whitelist outbound request payload properties
    const payload = {
      message: message.trim(),
      language: typeof language === 'string' && language.trim() ? language.trim() : 'en'
    };

    // Omitted entirely when undefined -- backend/n8n default to true (audio on) either way.
    if (typeof includeAudio === 'boolean') {
      payload.includeAudio = includeAudio;
    }

    if (isAuthenticated) {
      if (!childId || typeof childId !== 'string' || !childId.trim()) {
        throw new Error('Child context required: missing childId');
      }
      payload.childId = childId.trim();
    } else {
      const storedGuestToken = guestToken || getStoredGuestToken();
      if (storedGuestToken) {
        payload.guestToken = storedGuestToken;
      }
    }

    // Generate unique idempotency key for this logical message
    const requestKey = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : 'rk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);

    const headers = {
      'Content-Type': 'application/json',
      'Idempotency-Key': requestKey
    };

    if (isAuthenticated) {
      headers['Authorization'] = `Bearer ${accessToken.trim()}`;
    } else if (payload.guestToken) {
      headers['X-Guest-Session-Token'] = payload.guestToken;
    }

    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
    } catch {
      return {
        text: "I'm having a brief connection pause. Please check your internet connection and try again!",
        audioSource: null,
        childId: payload.childId,
        error: 'network_error'
      };
    }

    if (!res.ok) {
      let errBody = null;
      try {
        errBody = await res.json();
      } catch {
        errBody = null;
      }

      // Check for GUEST_LIMIT_REACHED
      const errCode = errBody?.code || errBody?.error?.code;
      if (res.status === 403 && (errCode === 'GUEST_LIMIT_REACHED' || errBody?.loginRequired || errBody?.guest?.loginRequired)) {
        const errLimit = errBody?.limit ?? errBody?.guestLimit ?? errBody?.details?.guestLimit ?? errBody?.guest?.limit ?? 3;
        const errUsed = errBody?.used ?? errBody?.details?.used ?? errBody?.guest?.used ?? 3;
        const quotaInfo = {
          limit: errLimit,
          guestLimit: errLimit,
          used: errUsed,
          remaining: 0,
          loginRequired: true
        };
        return {
          text: errBody?.message || errBody?.error?.message || "Your complimentary APPU chats are complete. Sign in to continue learning and save your progress.",
          audioSource: null,
          error: 'guest_limit_reached',
          code: 'GUEST_LIMIT_REACHED',
          ...quotaInfo,
          guest: quotaInfo,
          guestSession: quotaInfo
        };
      }

      if (res.status === 401) {
        return {
          text: "Your session has expired. Please sign in again from the Parent Zone.",
          audioSource: null,
          childId: payload.childId,
          error: 'unauthorized'
        };
      }
      if (res.status === 403) {
        return {
          text: "An active Appu learning subscription is needed for this session. Ask your parent to verify your plan in the Parent Zone!",
          audioSource: null,
          childId: payload.childId,
          error: 'forbidden'
        };
      }
      if (res.status === 404) {
        return {
          text: "I couldn't find your learner profile. Please select or set up your child profile in the Parent Zone.",
          audioSource: null,
          childId: payload.childId,
          error: 'not_found'
        };
      }
      if (res.status === 429) {
        return {
          text: errCode === 'RATE_LIMITED'
            ? "Too many requests. Please slow down and try asking again shortly."
            : "You've reached your monthly learning question limit. Ask your parent to upgrade your plan in the Parent Zone!",
          audioSource: null,
          childId: payload.childId,
          error: 'quota_exceeded'
        };
      }
      if (res.status === 409) {
        return {
          text: "Something went wrong with sending your question. Please try asking again!",
          audioSource: null,
          childId: payload.childId,
          error: 'idempotency_conflict'
        };
      }
      if (res.status === 502 || res.status === 503) {
        return {
          text: "Appu is thinking deeply right now and took a little too long to answer. Let's try your question again!",
          audioSource: null,
          childId: payload.childId,
          error: 'service_unavailable'
        };
      }

      return {
        text: "Something unexpected happened while talking to Appu. Please try asking your question again.",
        audioSource: null,
        childId: payload.childId,
        error: 'server_error'
      };
    }

    let data;
    try {
      data = await res.json();
    } catch {
      return {
        text: "I received a response, but could not parse it cleanly. Please ask again!",
        audioSource: null,
        childId: payload.childId,
        error: 'parse_error'
      };
    }

    // Capture returned guest token from response header or body
    const headerToken = (res.headers && typeof res.headers.get === 'function')
      ? res.headers.get('x-guest-session-token')
      : null;
    const receivedToken = headerToken || data.guest?.token || data.guestSession?.token || data.token;
    if (receivedToken) {
      setStoredGuestToken(receivedToken);
    }

    let guestInfo = null;
    if (data.guest || data.guestSession) {
      const limit = data.guest?.limit ?? data.guestSession?.guestLimit ?? 3;
      const used = data.guest?.used ?? data.guestSession?.used ?? 0;
      const remaining = data.guest?.remaining ?? data.guestSession?.remaining ?? Math.max(0, limit - used);
      const loginRequired = Boolean(data.guest?.loginRequired ?? data.guestSession?.loginRequired ?? (remaining <= 0));

      guestInfo = {
        token: receivedToken || payload.guestToken || null,
        limit,
        guestLimit: limit,
        used,
        remaining,
        loginRequired
      };
    }

    return {
      text: typeof data.text === 'string' ? data.text : '',
      audioSource: data.audioSource || null,
      audioDurationMs: data.audioDurationMs || null,
      childId: data.childId || payload.childId,
      guest: guestInfo,
      guestSession: guestInfo
    };
  }

  return {
    getApiBaseUrl,
    getStoredGuestToken,
    setStoredGuestToken,
    sendAppuMessage,
    getGuestStatus
  };
});
