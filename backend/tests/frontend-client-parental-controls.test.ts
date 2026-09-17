import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

describe('Frontend AppuBackendClient Parental Controls Suite', () => {
  function createClientEnvironment() {
    const clientPath = path.resolve(process.cwd(), '..', 'frontend', 'appu-backend-client.js');
    const code = fs.readFileSync(clientPath, 'utf8');

    const capturedCalls: Array<{ url: string; options: any }> = [];
    const mockFetch = async (url: string, options: any) => {
      capturedCalls.push({ url, options });
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => ({ success: true, requested: true, verified: true, sent: true })
      };
    };

    const sandbox: any = {
      module: { exports: {} },
      exports: {},
      console,
      fetch: mockFetch,
      APPU_CONFIG: { apiBaseUrl: 'https://api.test.online' }
    };
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;

    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);

    const client = sandbox.module.exports || sandbox.AppuBackendClient;
    return { client, capturedCalls };
  }

  test('sendStudyNoteToWhatsApp sends POST to /api/appu/notes/send-whatsapp with Bearer token', async () => {
    const { client, capturedCalls } = createClientEnvironment();
    assert.ok(client, 'AppuBackendClient must be defined');

    const res = await client.sendStudyNoteToWhatsApp({
      childId: 'c1234567-0000-0000-0000-000000000001',
      note: 'Pythagorean theorem: a^2 + b^2 = c^2',
      accessToken: 'test_parent_jwt_token',
      baseUrl: 'https://api.test.online'
    });

    assert.equal(res.sent, true);
    assert.equal(capturedCalls.length, 1);
    assert.equal(capturedCalls[0].url, 'https://api.test.online/api/appu/notes/send-whatsapp');
    assert.equal(capturedCalls[0].options.method, 'POST');
    assert.equal(capturedCalls[0].options.headers['Authorization'], 'Bearer test_parent_jwt_token');
    assert.deepEqual(JSON.parse(capturedCalls[0].options.body), {
      childId: 'c1234567-0000-0000-0000-000000000001',
      note: 'Pythagorean theorem: a^2 + b^2 = c^2'
    });
  });

  test('recordSessionHeartbeat sends POST to /api/appu/session/heartbeat with metrics', async () => {
    const { client, capturedCalls } = createClientEnvironment();

    const res = await client.recordSessionHeartbeat({
      sessionId: 'sess_test_123',
      childId: 'c1234567-0000-0000-0000-000000000001',
      activeMsSinceLast: 15000,
      awayMsSinceLast: 5000,
      visibility: 'visible',
      accessToken: 'test_jwt',
      baseUrl: 'https://api.test.online'
    });

    assert.equal(res.success, true);
    assert.equal(capturedCalls.length, 1);
    assert.equal(capturedCalls[0].url, 'https://api.test.online/api/appu/session/heartbeat');
    assert.equal(capturedCalls[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(capturedCalls[0].options.body), {
      sessionId: 'sess_test_123',
      childId: 'c1234567-0000-0000-0000-000000000001',
      activeMsSinceLast: 15000,
      awayMsSinceLast: 5000,
      visibility: 'visible'
    });
  });

  test('getSessionUsage sends GET to /api/appu/session/usage with query params', async () => {
    const { client, capturedCalls } = createClientEnvironment();

    await client.getSessionUsage({
      sessionId: 'sess_test_123',
      childId: 'c1234567-0000-0000-0000-000000000001',
      accessToken: 'test_jwt',
      baseUrl: 'https://api.test.online'
    });

    assert.equal(capturedCalls.length, 1);
    assert.equal(capturedCalls[0].url, 'https://api.test.online/api/appu/session/usage?sessionId=sess_test_123&childId=c1234567-0000-0000-0000-000000000001');
    assert.equal(capturedCalls[0].options.method, 'GET');
  });

  test('requestSessionOtp sends POST to /api/appu/session/otp/request', async () => {
    const { client, capturedCalls } = createClientEnvironment();

    const res = await client.requestSessionOtp({
      sessionId: 'sess_test_123',
      childId: 'c1234567-0000-0000-0000-000000000001',
      accessToken: 'test_jwt',
      baseUrl: 'https://api.test.online'
    });

    assert.equal(res.requested, true);
    assert.equal(capturedCalls.length, 1);
    assert.equal(capturedCalls[0].url, 'https://api.test.online/api/appu/session/otp/request');
    assert.equal(capturedCalls[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(capturedCalls[0].options.body), {
      sessionId: 'sess_test_123',
      childId: 'c1234567-0000-0000-0000-000000000001'
    });
  });

  test('verifySessionOtp sends POST to /api/appu/session/otp/verify with 6-digit code', async () => {
    const { client, capturedCalls } = createClientEnvironment();

    const res = await client.verifySessionOtp({
      sessionId: 'sess_test_123',
      childId: 'c1234567-0000-0000-0000-000000000001',
      code: '849201',
      accessToken: 'test_jwt',
      baseUrl: 'https://api.test.online'
    });

    assert.equal(res.verified, true);
    assert.equal(capturedCalls.length, 1);
    assert.equal(capturedCalls[0].url, 'https://api.test.online/api/appu/session/otp/verify');
    assert.equal(capturedCalls[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(capturedCalls[0].options.body), {
      sessionId: 'sess_test_123',
      childId: 'c1234567-0000-0000-0000-000000000001',
      code: '849201'
    });
  });
});

describe('Frontend ParentalControlsUI Controller Suite', () => {
  function createUIEnvironment() {
    const uiPath = path.resolve(process.cwd(), '..', 'frontend', 'parental-controls-ui.js');
    const code = fs.readFileSync(uiPath, 'utf8');

    const domElements: Record<string, any> = {};
    function mockElement(id: string) {
      if (!domElements[id]) {
        domElements[id] = {
          id,
          hidden: false,
          style: {},
          classList: {
            classes: new Set<string>(),
            add(c: string) { this.classes.add(c); },
            remove(c: string) { this.classes.delete(c); },
            contains(c: string) { return this.classes.has(c); }
          },
          attributes: new Map<string, string>(),
          setAttribute(k: string, v: string) { this.attributes.set(k, v); },
          getAttribute(k: string) { return this.attributes.get(k); },
          textContent: '',
          innerHTML: '',
          value: '',
          focus: () => {},
          addEventListener: () => {},
          querySelector: () => null,
          querySelectorAll: () => [],
          onclick: null as any
        };
      }
      return domElements[id];
    }

    const elementIds = [
      'parental-lock-modal',
      'parental-lock-title',
      'lock-stat-active',
      'lock-stat-away',
      'lock-view-request',
      'lock-view-verify',
      'lock-view-success',
      'lock-btn-request-otp',
      'lock-btn-verify-otp',
      'lock-btn-resend-otp',
      'lock-btn-add-phone',
      'lock-otp-input',
      'lock-request-status',
      'lock-verify-status',
      'parental-timer-badge',
      'parental-timer-text'
    ];
    elementIds.forEach(mockElement);

    const storageMap = new Map<string, string>();
    const sessionStorage = {
      getItem: (k: string) => storageMap.get(k) || null,
      setItem: (k: string, v: string) => storageMap.set(k, v),
      removeItem: (k: string) => storageMap.delete(k)
    };

    const listeners: Record<string, Function[]> = {};
    const sandbox: any = {
      module: { exports: {} },
      exports: {},
      console,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      Date,
      sessionStorage,
      document: {
        documentElement: { lang: 'en' },
        getElementById: (id: string) => domElements[id] || null,
        visibilityState: 'visible'
      },
      window: {
        addEventListener: (event: string, fn: Function) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(fn);
        },
        AppuSession: {
          isAuthenticated: () => true,
          childId: 'c_child_test_uuid',
          accessToken: 'jwt_parent_auth'
        },
        AppuBackendClient: {
          recordSessionHeartbeat: async () => ({
            enabled: true,
            locked: false,
            activeSeconds: 60,
            awaySeconds: 0,
            timeRemainingSeconds: 1740
          }),
          requestSessionOtp: async () => ({
            requested: true,
            expiresInSeconds: 600,
            activeSeconds: 1800,
            awaySeconds: 0
          }),
          verifySessionOtp: async () => ({
            verified: true,
            windowReset: true
          })
        },
        VoiceEngine: {
          stopSpeech: () => {}
        }
      }
    };
    sandbox.globalThis = sandbox;
    sandbox.window.document = sandbox.document;
    sandbox.window.sessionStorage = sandbox.sessionStorage;

    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);

    const ui = sandbox.module.exports || sandbox.ParentalControlsUI;
    return { ui, domElements, sandbox };
  }

  test('ParentalControlsUI initializes, tracks state, and responds to lock and unlock triggers', () => {
    const { ui, domElements } = createUIEnvironment();
    assert.ok(ui, 'ParentalControlsUI must be defined');

    try {
      ui.init();
      assert.equal(ui.isLocked, false);

      // Trigger lock explicitly
      ui.triggerLock();
      assert.equal(ui.isLocked, true);
      assert.equal(domElements['parental-lock-modal'].classList.contains('is-visible'), true);
      assert.equal(domElements['parental-lock-modal'].attributes.get('aria-hidden'), 'false');
      assert.equal(domElements['lock-view-request'].hidden, false);
      assert.equal(domElements['lock-view-verify'].hidden, true);

      // Unlock session
      ui.unlockSession();
      assert.equal(ui.isLocked, false);
      assert.equal(domElements['parental-lock-modal'].classList.contains('is-visible'), false);
      assert.equal(domElements['parental-lock-modal'].attributes.get('aria-hidden'), 'true');
    } finally {
      ui.destroy();
    }
  });
});

