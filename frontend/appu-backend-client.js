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

  /**
   * Retrieves current guest session status from server.
   */
  async function getGuestStatus(params = {}) {
    const apiBase = params.baseUrl ? params.baseUrl.replace(/\/+$/, '') : getApiBaseUrl();
    const endpoint = `${apiBase}/api/appu/guest-status`;

    const storedToken = params.guestToken || (
      typeof localStorage !== 'undefined' ? localStorage.getItem('appu_guest_token') : null
    );

    const headers = { 'Content-Type': 'application/json' };
    if (storedToken) {
      headers['X-Guest-Session-Token'] = storedToken;
    }

    try {
      const res = await fetch(endpoint, { method: 'GET', headers });
      if (res.ok) {
        const data = await res.json();
        if (data.token && typeof localStorage !== 'undefined') {
          localStorage.setItem('appu_guest_token', data.token);
        }
        return {
          guestLimit: data.guestLimit ?? 3,
          used: data.used ?? 0,
          remaining: data.remaining ?? 3,
          loginRequired: Boolean(data.loginRequired),
          token: data.token || storedToken
        };
      }
    } catch {
      // Fallback
    }

    return {
      guestLimit: 3,
      used: 0,
      remaining: 3,
      loginRequired: false,
      token: storedToken
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
   * @returns {Promise<{ text: string, audioSource: string|null, childId?: string, error?: string, code?: string, guestSession?: any }>}
   */
  async function sendAppuMessage(params) {
    if (!params || typeof params !== 'object') {
      throw new Error('sendAppuMessage requires an options object');
    }

    const { accessToken, childId, message, language = 'en', baseUrl, guestToken } = params;

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

    if (isAuthenticated) {
      if (!childId || typeof childId !== 'string' || !childId.trim()) {
        throw new Error('Child context required: missing childId');
      }
      payload.childId = childId.trim();
    } else {
      const storedGuestToken = guestToken || (
        typeof localStorage !== 'undefined' ? localStorage.getItem('appu_guest_token') : null
      );
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
      if (res.status === 403 && (errCode === 'GUEST_LIMIT_REACHED' || errBody?.loginRequired)) {
        return {
          text: errBody?.message || errBody?.error?.message || "Your complimentary APPU chats are complete. Sign in to continue learning and save your progress.",
          audioSource: null,
          error: 'guest_limit_reached',
          code: 'GUEST_LIMIT_REACHED',
          guestLimit: errBody?.guestLimit ?? errBody?.details?.guestLimit ?? 3,
          used: errBody?.used ?? errBody?.details?.used ?? 3,
          remaining: 0,
          loginRequired: true
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

    // Save updated guest token to localStorage if returned
    if (data.guestSession?.token && typeof localStorage !== 'undefined') {
      localStorage.setItem('appu_guest_token', data.guestSession.token);
    }

    return {
      text: typeof data.text === 'string' ? data.text : '',
      audioSource: data.audioSource || null,
      audioDurationMs: data.audioDurationMs || null,
      childId: data.childId || payload.childId,
      guestSession: data.guestSession || null
    };
  }

  return {
    getApiBaseUrl,
    sendAppuMessage,
    getGuestStatus
  };
});
