/**
 * AppuBackendClient: Browser-side Secure Gateway Client
 * 
 * Communicates with the Phase 2 backend gateway endpoint (POST /api/appu/message).
 * 
 * SECURITY INVARIANTS:
 * - Browser sends ONLY: childId, message, language, plus Authorization Bearer token.
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
    return 'http://localhost:3000';
  }

  /**
   * Sends child message to the secure Appu backend gateway.
   * 
   * @param {Object} params
   * @param {string} params.accessToken - Valid parent JWT access token
   * @param {string} params.childId - Verified child profile UUID
   * @param {string} params.message - User prompt text
   * @param {string} [params.language='en'] - Preferred language code
   * @param {string} [params.baseUrl] - Optional override for API base URL
   * @returns {Promise<{ text: string, audioSource: string|null, childId: string, error?: string }>}
   */
  async function sendAppuMessage(params) {
    if (!params || typeof params !== 'object') {
      throw new Error('sendAppuMessage requires an options object');
    }

    const { accessToken, childId, message, language = 'en', baseUrl } = params;

    if (!accessToken || typeof accessToken !== 'string' || !accessToken.trim()) {
      throw new Error('Authenticated session required: missing accessToken');
    }
    if (!childId || typeof childId !== 'string' || !childId.trim()) {
      throw new Error('Child context required: missing childId');
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new Error('Message cannot be empty');
    }

    const apiBase = baseUrl ? baseUrl.replace(/\/+$/, '') : getApiBaseUrl();
    const endpoint = `${apiBase}/api/appu/message`;

    // Strictly whitelist outbound request payload properties
    const payload = {
      childId: childId.trim(),
      message: message.trim(),
      language: typeof language === 'string' && language.trim() ? language.trim() : 'en'
    };

    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.trim()}`,
          'Content-Type': 'application/json'
        },
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
          text: "You've reached your monthly learning question limit. Ask your parent to upgrade your plan in the Parent Zone!",
          audioSource: null,
          childId: payload.childId,
          error: 'quota_exceeded'
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
        text: "I received an unreadable answer. Please try asking again!",
        audioSource: null,
        childId: payload.childId,
        error: 'parse_error'
      };
    }

    return {
      text: typeof data.text === 'string' && data.text.trim() ? data.text.trim() : 'Namaskara! I am listening.',
      audioSource: typeof data.audioSource === 'string' && data.audioSource.trim() ? data.audioSource.trim() : null,
      childId: data.childId || payload.childId
    };
  }

  return {
    sendAppuMessage,
    getApiBaseUrl
  };
});
