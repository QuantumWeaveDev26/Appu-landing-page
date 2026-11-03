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

  function isDevHost() {
    // 1. Explicit window/global override
    if (typeof window !== 'undefined' && typeof window.__APPU_DEV_HOST__ === 'boolean') {
      return window.__APPU_DEV_HOST__;
    }
    if (typeof globalThis !== 'undefined' && typeof globalThis.__APPU_DEV_HOST__ === 'boolean') {
      return globalThis.__APPU_DEV_HOST__;
    }

    // 2. Browser location check: true on localhost / 127.0.0.1, false on production domains like appuai.online
    if (typeof window !== 'undefined' && window.location && typeof window.location.host === 'string') {
      return /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(window.location.host);
    }

    // 3. Fallback for test runner (Node.js) or local environments
    return true;
  }

  let _experimentalLearningOverride = null;
  let _sessionStartOtpGateOverride = null;

  return {
    // Helper to determine if current host is dev/local
    isDevHost,

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
    // After this many chats, a signed-in parent is asked for feedback (dismissible).
    feedbackChatThreshold: 20,
    // Presentation Mode: 'rich' enables next-level visual lesson-cards and mascot reactions (develop/staging)
    presentationMode: 'rich',

    // Experimental Learning: Enables Phase B (adaptive difficulty) and Phase C (curiosity beyond syllabus)
    // Host-gated: true on localhost/dev hosts, false on production (appuai.online)
    get experimentalLearning() {
      if (_experimentalLearningOverride !== null) return _experimentalLearningOverride;
      if (typeof window !== 'undefined' && typeof window.__APPU_EXPERIMENTAL_LEARNING__ === 'boolean') {
        return window.__APPU_EXPERIMENTAL_LEARNING__;
      }
      if (typeof globalThis !== 'undefined' && typeof globalThis.__APPU_EXPERIMENTAL_LEARNING__ === 'boolean') {
        return globalThis.__APPU_EXPERIMENTAL_LEARNING__;
      }
      return isDevHost();
    },
    set experimentalLearning(val) {
      _experimentalLearningOverride = Boolean(val);
    },

    // Session Start OTP Gate: Host-gated — true on localhost/dev hosts, false on production (appuai.online)
    // where Meta WhatsApp templates are unapproved so screen time tracking ticks without OTP block.
    get sessionStartOtpGate() {
      if (_sessionStartOtpGateOverride !== null) return _sessionStartOtpGateOverride;
      if (typeof window !== 'undefined' && typeof window.__APPU_SESSION_START_OTP_GATE__ === 'boolean') {
        return window.__APPU_SESSION_START_OTP_GATE__;
      }
      if (typeof globalThis !== 'undefined' && typeof globalThis.__APPU_SESSION_START_OTP_GATE__ === 'boolean') {
        return globalThis.__APPU_SESSION_START_OTP_GATE__;
      }
      return isDevHost();
    },
    set sessionStartOtpGate(val) {
      _sessionStartOtpGateOverride = Boolean(val);
    }
  };
});
