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

  test('AppuBackendClient: persists guest token across requests and attaches X-Guest-Session-Token header', async () => {
    let callCount = 0;
    let headersReceived = [];

    global.fetch = async (url, options) => {
      callCount++;
      headersReceived.push(options.headers);

      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (name) => name.toLowerCase() === 'x-guest-session-token' ? 'gst_persisted_token_abc' : null
          },
          json: async () => ({
            text: 'Turn 1 answer',
            guest: {
              token: 'gst_persisted_token_abc',
              limit: 3,
              used: 1,
              remaining: 2,
              loginRequired: false
            }
          })
        };
      }

      return {
        ok: true,
        status: 200,
        headers: {
          get: (name) => name.toLowerCase() === 'x-guest-session-token' ? 'gst_persisted_token_abc_turn2' : null
        },
        json: async () => ({
          text: 'Turn 2 answer',
          guest: {
            token: 'gst_persisted_token_abc_turn2',
            limit: 3,
            used: 2,
            remaining: 1,
            loginRequired: false
          }
        })
      };
    };

    // Request 1: No token initially
    const res1 = await AppuBackendClient.sendAppuMessage({ message: 'First query' });
    assert.equal(headersReceived[0]['X-Guest-Session-Token'], undefined);
    assert.equal(res1.guest.used, 1);
    assert.equal(res1.guest.remaining, 2);
    assert.equal(global.localStorage.getItem('appu_guest_token'), 'gst_persisted_token_abc');

    // Request 2: Must automatically include persisted token
    const res2 = await AppuBackendClient.sendAppuMessage({ message: 'Second query' });
    assert.equal(headersReceived[1]['X-Guest-Session-Token'], 'gst_persisted_token_abc');
    assert.equal(res2.guest.used, 2);
    assert.equal(res2.guest.remaining, 1);
    assert.equal(global.localStorage.getItem('appu_guest_token'), 'gst_persisted_token_abc_turn2');
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

  test('SECURITY: frontend JS files contain ZERO n8n/webhook production URLs', () => {
    const frontendDir = path.resolve(__dirname, '../frontend');
    const jsFiles = fs.readdirSync(frontendDir).filter(f => f.endsWith('.js'));

    const forbiddenPatterns = [
      'n8n.srv1871828.hstgr.cloud',
      'N8N_APPU_WEBHOOK_URL',
      '/webhook/4a108e85',
      'n8nWebhookUrl',
      'defaultN8nUrl'
    ];

    const violations = [];
    for (const file of jsFiles) {
      const content = fs.readFileSync(path.join(frontendDir, file), 'utf8');
      for (const pattern of forbiddenPatterns) {
        if (content.includes(pattern)) {
          violations.push(`${file} contains forbidden pattern: ${pattern}`);
        }
      }
    }

    assert.equal(violations.length, 0,
      `Frontend JS files must not contain n8n/webhook URLs.\nViolations:\n${violations.join('\n')}`
    );
  });

  test('sendAppuMessage routes exclusively to backend API, never to n8n', async () => {
    const capturedUrls = [];

    global.fetch = async (url, options) => {
      capturedUrls.push(url);
      return {
        ok: true,
        status: 200,
        headers: {
          get: (name) => name.toLowerCase() === 'x-guest-session-token' ? 'gst_routing_test' : null
        },
        json: async () => ({
          text: 'Backend-routed response',
          guest: { token: 'gst_routing_test', limit: 3, used: 1, remaining: 2, loginRequired: false }
        })
      };
    };

    await AppuBackendClient.sendAppuMessage({ message: 'test routing' });

    // Every captured URL must be the backend API endpoint
    for (const url of capturedUrls) {
      assert.ok(
        url.includes('/api/appu/message'),
        `Request URL must target backend API, got: ${url}`
      );
      assert.ok(
        !url.includes('n8n'),
        `Request URL must NOT contain n8n domain, got: ${url}`
      );
      assert.ok(
        !url.includes('webhook'),
        `Request URL must NOT contain webhook path, got: ${url}`
      );
    }
  });

  test('Full 4-turn guest lifecycle: backend-routed with n8n call count zero on rejected turn', async () => {
    let backendCallCount = 0;

    global.fetch = async (url, options) => {
      backendCallCount++;
      const body = JSON.parse(options.body);

      assert.ok(url.includes('/api/appu/message'), `Turn ${backendCallCount}: must route to backend`);
      assert.ok(!url.includes('n8n'), `Turn ${backendCallCount}: must NOT route to n8n`);

      if (backendCallCount <= 3) {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (name) => name.toLowerCase() === 'x-guest-session-token' ? `gst_turn_${backendCallCount}` : null
          },
          json: async () => ({
            text: `Response for turn ${backendCallCount}`,
            guest: {
              token: `gst_turn_${backendCallCount}`,
              limit: 3,
              used: backendCallCount,
              remaining: 3 - backendCallCount,
              loginRequired: backendCallCount >= 3
            }
          })
        };
      }

      // Turn 4: 403 GUEST_LIMIT_REACHED
      return {
        ok: false,
        status: 403,
        headers: { get: () => null },
        json: async () => ({
          code: 'GUEST_LIMIT_REACHED',
          message: 'Your complimentary APPU chats are complete.',
          remaining: 0,
          used: 3,
          loginRequired: true
        })
      };
    };

    // Turn 1
    const r1 = await AppuBackendClient.sendAppuMessage({ message: 'Turn 1' });
    assert.equal(r1.guest.remaining, 2);
    assert.equal(r1.guest.used, 1);

    // Turn 2
    const r2 = await AppuBackendClient.sendAppuMessage({ message: 'Turn 2' });
    assert.equal(r2.guest.remaining, 1);
    assert.equal(r2.guest.used, 2);

    // Turn 3
    const r3 = await AppuBackendClient.sendAppuMessage({ message: 'Turn 3' });
    assert.equal(r3.guest.remaining, 0);
    assert.equal(r3.guest.used, 3);
    assert.equal(r3.guest.loginRequired, true);

    // Turn 4: must be rejected
    const r4 = await AppuBackendClient.sendAppuMessage({ message: 'Turn 4' });
    assert.equal(r4.code, 'GUEST_LIMIT_REACHED');
    assert.equal(r4.remaining, 0);
    assert.equal(r4.loginRequired, true);

    // Total backend calls: 4 (turns 1-3 succeeded, turn 4 was 403)
    // n8n direct calls: 0 (all routed through backend API)
    assert.equal(backendCallCount, 4, 'All 4 requests must route through backend API');
  });
});
