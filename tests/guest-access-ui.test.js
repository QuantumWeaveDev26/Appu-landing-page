const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const AppuBackendClient = require('../frontend/appu-backend-client.js');

describe('Guest Access UI & 3-Turn Authoritative Quota Invariants', () => {
  beforeEach(() => {
    global.localStorage = {
      _data: {},
      getItem(k) { return this._data[k] || null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; },
      clear() { this._data = {}; }
    };
  });

  test('AppuBackendClient.sendAppuMessage: sends guest payload without requiring accessToken or childId', async () => {
    let capturedUrl = '';
    let capturedHeaders = {};
    let capturedBody = {};

    global.fetch = async (url, options) => {
      capturedUrl = url;
      capturedHeaders = options.headers;
      capturedBody = JSON.parse(options.body);

      return {
        ok: true,
        status: 200,
        json: async () => ({
          text: 'Answer for guest learner.',
          audioSource: null,
          guestSession: {
            token: 'gst_token_123.sig',
            guestLimit: 3,
            used: 1,
            remaining: 2,
            loginRequired: false
          }
        })
      };
    };

    const res = await AppuBackendClient.sendAppuMessage({
      message: 'Explain gravity in simple terms',
      language: 'en'
    });

    assert.ok(capturedUrl.endsWith('/api/appu/message'));
    assert.equal(capturedBody.message, 'Explain gravity in simple terms');
    assert.equal(capturedBody.childId, undefined);
    assert.equal(capturedHeaders['Authorization'], undefined);

    assert.equal(res.text, 'Answer for guest learner.');
    assert.equal(res.guestSession.used, 1);
    assert.equal(res.guestSession.remaining, 2);
    assert.equal(global.localStorage.getItem('appu_guest_token'), 'gst_token_123.sig');
  });

  test('AppuBackendClient.sendAppuMessage: maps HTTP 403 GUEST_LIMIT_REACHED response to structured gate state', async () => {
    global.fetch = async () => {
      return {
        ok: false,
        status: 403,
        json: async () => ({
          code: 'GUEST_LIMIT_REACHED',
          message: 'Your complimentary APPU chats are complete. Sign in to continue learning and save your progress.',
          guestLimit: 3,
          used: 3,
          remaining: 0,
          loginRequired: true
        })
      };
    };

    const res = await AppuBackendClient.sendAppuMessage({
      message: 'Question 4'
    });

    assert.equal(res.error, 'guest_limit_reached');
    assert.equal(res.code, 'GUEST_LIMIT_REACHED');
    assert.equal(res.remaining, 0);
    assert.equal(res.used, 3);
    assert.equal(res.guestLimit, 3);
    assert.equal(res.loginRequired, true);
  });

  test('AppuBackendClient.getGuestStatus: fetches current quota status', async () => {
    global.fetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          guestLimit: 3,
          used: 2,
          remaining: 1,
          loginRequired: false,
          token: 'gst_active_token'
        })
      };
    };

    const status = await AppuBackendClient.getGuestStatus();
    assert.equal(status.guestLimit, 3);
    assert.equal(status.used, 2);
    assert.equal(status.remaining, 1);
    assert.equal(status.loginRequired, false);
    assert.equal(status.token, 'gst_active_token');
  });

  test('DOM & CSS invariants: guest-limit-modal and guest-access-badge are defined and responsive', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../frontend/index.html'), 'utf8');
    const css = fs.readFileSync(path.resolve(__dirname, '../frontend/style.css'), 'utf8');

    // Invariant 1: Guest modal elements in HTML
    assert.ok(html.includes('id="guest-limit-modal"'), 'HTML must include guest-limit-modal');
    assert.ok(html.includes('id="btn-guest-signin"'), 'HTML must include sign in button');
    assert.ok(html.includes('id="btn-guest-register"'), 'HTML must include register button');
    assert.ok(html.includes('id="btn-guest-plans"'), 'HTML must include view plans button');
    assert.ok(html.includes('id="guest-access-badge"'), 'HTML must include guest-access-badge');

    // Invariant 2: CSS rules for badge and gate modal
    assert.match(css, /\.guest-access-badge\s*\{/, 'CSS must style .guest-access-badge');
    assert.match(css, /\.guest-limit-sheet\s*\{/, 'CSS must style .guest-limit-sheet');
    assert.match(css, /\.guest-gate-features\s*\{/, 'CSS must style .guest-gate-features');
    assert.match(css, /\.guest-gate-actions\s*\{/, 'CSS must style .guest-gate-actions');

    // Invariant 3: Touch targets >= 44px
    assert.match(css, /min-height:\s*48px/, 'CTA buttons must satisfy >= 44px touch target');
  });
});
