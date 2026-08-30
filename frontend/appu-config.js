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
    // 1. Explicit window override (can be injected by hosting/CDN environment)
    if (
      typeof window !== 'undefined' &&
      window.__APPU_API_BASE_URL__ &&
      typeof window.__APPU_API_BASE_URL__ === 'string' &&
      window.__APPU_API_BASE_URL__.trim()
    ) {
      return window.__APPU_API_BASE_URL__.trim().replace(/\/+$/, '');
    }

    // 2. Deployed backend API URL
    return 'https://api.appuai.online';
  }

  return {
    // Dynamic getter for Backend API base URL (reactively evaluates window overrides and hostname)
    get apiBaseUrl() {
      return resolveApiBaseUrl();
    },
    // Public Supabase configuration (client-safe publishable key only)
    supabaseUrl: 'https://cmulkkpinwernuzhtegp.supabase.co',
    supabasePublishableKey: 'sb_publishable_N-I0xWkc2SXY6kga0iD0_Q_awDjKXNr'
  };
});
