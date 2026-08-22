/**
 * AppuSession: In-Memory Authenticated Session Bridge
 * 
 * Used to hand verified Phase 2 parent authentication and active child profile context
 * to the child learning experience.
 * 
 * SECURITY INVARIANTS:
 * - In-memory only (NEVER stored in localStorage or sessionStorage).
 * - Never log access tokens to console or remote monitoring.
 * - Never put tokens in URLs or query parameters.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.AppuSession = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  let _accessToken = null;
  let _childId = null;
  let _parentContext = null;

  const session = {
    get accessToken() {
      return _accessToken;
    },

    get childId() {
      return _childId;
    },

    get parentContext() {
      return _parentContext;
    },

    /**
     * Sets authenticated session context.
     * @param {Object} params
     * @param {string} params.accessToken
     * @param {string} params.childId
     * @param {Object} [params.parentContext]
     */
    setSession(params) {
      if (!params || typeof params !== 'object') {
        throw new Error('AppuSession.setSession requires an object parameter');
      }
      const { accessToken, childId, parentContext = null } = params;

      if (!accessToken || typeof accessToken !== 'string' || !accessToken.trim()) {
        throw new Error('AppuSession: accessToken must be a non-empty string');
      }
      if (!childId || typeof childId !== 'string' || !childId.trim()) {
        throw new Error('AppuSession: childId must be a non-empty string');
      }

      _accessToken = accessToken.trim();
      _childId = childId.trim();
      _parentContext = parentContext;
    },

    /**
     * Checks if a valid authenticated session is present.
     * @returns {boolean}
     */
    isAuthenticated() {
      return Boolean(_accessToken && _childId);
    },

    /**
     * Clears in-memory session.
     */
    clear() {
      _accessToken = null;
      _childId = null;
      _parentContext = null;
    }
  };

  return session;
});
