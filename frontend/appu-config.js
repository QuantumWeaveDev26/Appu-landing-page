/**
 * APPU Frontend Configuration
 * Safe public configuration for browser clients.
 * STRICT INVARIANT: No secrets, credentials, webhook URLs, or tokens may appear here.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.APPU_CONFIG = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function resolveApiBaseUrl() {
    // 1. Explicit window override (can be injected by hosting/CDN environment or dev proxy)
    if (
      typeof window !== 'undefined' &&
      typeof window.__APPU_API_BASE_URL__ === 'string'
    ) {
      return window.__APPU_API_BASE_URL__.trim().replace(/\/+$/, '');
    }

    // 2. Automatically route through local dev proxy on localhost / 127.0.0.1
    if (
      typeof window !== 'undefined' &&
      window.location &&
      /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(window.location.host)
    ) {
      return '';
    }

    // 3. Deployed backend API URL
    return 'https://api.appuai.online';
  }

  return {
    // Dynamic getter for Backend API base URL (reactively evaluates window overrides and hostname)
    get apiBaseUrl() {
      return resolveApiBaseUrl();
    },
    // Public Supabase configuration (client-safe publishable key only)
    supabaseUrl: 'https://cmulkkpinwernuzhtegp.supabase.co',
    supabasePublishableKey: 'sb_publishable_N-I0xWkc2SXY6kga0iD0_Q_awDjKXNr',
    // BETA: hides plan pricing UI and unlocks the free beta signup path. Flip to false to
    // restore normal paid-plan display once the beta period ends.
    betaMode: true,
    betaChatLimit: 5,
    // After this many chats, a signed-in parent must submit feedback before continuing.
    feedbackChatThreshold: 12,
    // Presentation Mode: 'rich' enables next-level visual lesson-cards and mascot reactions (develop/staging)
    presentationMode: 'rich'
  };
});
