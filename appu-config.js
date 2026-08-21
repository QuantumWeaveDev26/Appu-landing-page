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

  return {
    // Backend API base URL for Phase 2 endpoints (e.g. /api/appu/message)
    apiBaseUrl:
      typeof window !== 'undefined' &&
      window.location &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:3000'
        : 'http://localhost:3000',
    // Public Supabase configuration (client-safe publishable key only)
    supabaseUrl: 'https://cmulkkpinwernuzhtegp.supabase.co',
    supabasePublishableKey: 'sb_publishable_N-I0xWkc2SXY6kga0iD0_Q_awDjKXNr'
  };
});
