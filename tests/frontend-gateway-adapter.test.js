const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const AppuSession = require('../frontend/appu-session.js');
const AppuBackendClient = require('../frontend/appu-backend-client.js');
const AppuVoiceContract = require('../frontend/voice-contract.js');

describe('Frontend Secure Gateway Adapter & Session Bridge', () => {
  beforeEach(() => {
    AppuSession.clear();
  });

  afterEach(() => {
    AppuSession.clear();
  });

  // ============================================================================
  // 1. IN-MEMORY SESSION BRIDGE
  // ============================================================================

  test('AppuSession stores session in-memory and provides authentication check', () => {
    assert.equal(AppuSession.isAuthenticated(), false);
    assert.equal(AppuSession.accessToken, null);
    assert.equal(AppuSession.childId, null);

    AppuSession.setSession({
      accessToken: 'test-jwt-token-12345',
      childId: 'c1234567-0000-0000-0000-000000000001',
      parentContext: { email: 'parent@example.com' }
    });

    assert.equal(AppuSession.isAuthenticated(), true);
    assert.equal(AppuSession.accessToken, 'test-jwt-token-12345');
    assert.equal(AppuSession.childId, 'c1234567-0000-0000-0000-000000000001');
    assert.equal(AppuSession.parentContext.email, 'parent@example.com');

    AppuSession.clear();
    assert.equal(AppuSession.isAuthenticated(), false);
    assert.equal(AppuSession.accessToken, null);
    assert.equal(AppuSession.childId, null);
  });

  test('AppuSession rejects empty or invalid tokens/childIds', () => {
    assert.throws(() => AppuSession.setSession({ accessToken: '', childId: 'c1' }));
    assert.throws(() => AppuSession.setSession({ accessToken: 'token', childId: '' }));
  });

  // ============================================================================
  // 2. APPU BACKEND CLIENT PAYLOAD & SECURITY
  // ============================================================================

  test('AppuBackendClient.sendAppuMessage constructs valid request and returns normalized response', async () => {
    let capturedUrl = '';
    let capturedHeaders = {};
    let capturedBody = {};

    // Mock global fetch
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      capturedUrl = url;
      capturedHeaders = options.headers;
      capturedBody = JSON.parse(options.body);

      return {
        ok: true,
        status: 200,
        async json() {
          return {
            text: 'Hello from secure backend Appu!',
            audioSource: 'data:audio/mpeg;base64,SUQzBAAAAAAA...',
            childId: capturedBody.childId
          };
        }
      };
    };

    try {
      const response = await AppuBackendClient.sendAppuMessage({
        accessToken: 'secure-parent-token-abc',
        childId: '00000000-1111-2222-3333-444444444444',
        message: 'Tell me about stars',
        language: 'kn',
        baseUrl: 'http://localhost:3000'
      });

      assert.equal(capturedUrl, 'http://localhost:3000/api/appu/message');
      assert.equal(capturedHeaders['Authorization'], 'Bearer secure-parent-token-abc');
      assert.equal(capturedHeaders['Content-Type'], 'application/json');

      // Security Invariant: Outbound body contains ONLY childId, message, language
      assert.deepEqual(Object.keys(capturedBody).sort(), ['childId', 'language', 'message']);
      assert.equal(capturedBody.childId, '00000000-1111-2222-3333-444444444444');
      assert.equal(capturedBody.message, 'Tell me about stars');
      assert.equal(capturedBody.language, 'kn');

      // Response matches voice and chat contract
      assert.equal(response.text, 'Hello from secure backend Appu!');
      assert.equal(response.audioSource, 'data:audio/mpeg;base64,SUQzBAAAAAAA...');
      assert.equal(response.childId, '00000000-1111-2222-3333-444444444444');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // ============================================================================
  // 3. HTTP ERROR MAPPING TO FRIENDLY USER-FACING MESSAGES
  // ============================================================================

  test('AppuBackendClient maps HTTP status codes (401, 403, 404, 429, 502/503) safely', async () => {
    const originalFetch = global.fetch;

    const testCases = [
      { status: 401, expectedError: 'unauthorized', matchText: 'session has expired' },
      { status: 403, expectedError: 'forbidden', matchText: 'active Appu learning subscription is needed' },
      { status: 404, expectedError: 'not_found', matchText: 'learner profile' },
      { status: 429, expectedError: 'quota_exceeded', matchText: 'learning question limit' },
      { status: 502, expectedError: 'service_unavailable', matchText: 'thinking deeply right now' },
      { status: 503, expectedError: 'service_unavailable', matchText: 'thinking deeply right now' }
    ];

    for (const tc of testCases) {
      global.fetch = async () => ({
        ok: false,
        status: tc.status,
        async text() {
          return 'Internal error with sensitive details: https://internal.n8n.webhook/secret';
        }
      });

      try {
        const res = await AppuBackendClient.sendAppuMessage({
          accessToken: 'token',
          childId: 'c1',
          message: 'hi'
        });

        assert.equal(res.error, tc.expectedError);
        assert.ok(res.text.includes(tc.matchText));
        assert.equal(res.audioSource, null);
        assert.ok(!res.text.includes('internal.n8n.webhook'), 'Must never leak internal upstream URLs');
      } finally {
        global.fetch = originalFetch;
      }
    }
  });

  test('AppuBackendClient handles network exceptions gracefully', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => {
      throw new Error('TypeError: Failed to fetch (connection refused to https://secret.internal/api)');
    };

    try {
      const res = await AppuBackendClient.sendAppuMessage({
        accessToken: 'token',
        childId: 'c1',
        message: 'hi'
      });

      assert.equal(res.error, 'network_error');
      assert.ok(res.text.includes('connection pause'));
      assert.ok(!res.text.includes('secret.internal'), 'Must never leak internal network URLs');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('authenticated parent without an active learner never falls back to the guest gateway', async () => {
    const originalWindow = global.window;
    const originalDocument = global.document;
    let gatewayCalls = 0;

    global.document = {
      getElementById() {
        return null;
      }
    };
    global.window = {
      AppuSession,
      ParentOnboardingShell: {
        state: {
          session: { access_token: 'valid-parent-without-learner' },
          authStatus: 'CHILD_SELECTION_REQUIRED'
        },
        whenReady() {
          return Promise.resolve('CHILD_SELECTION_REQUIRED');
        }
      },
      ParentSetupUI: {
        openModal() {}
      },
      AppuBackendClient: {
        async sendAppuMessage() {
          gatewayCalls += 1;
          return { text: 'This guest request must not happen.' };
        }
      }
    };

    try {
      delete require.cache[require.resolve('../frontend/chat-agent.js')];
      require('../frontend/chat-agent.js');
      const agent = new global.window.ChatAgent();
      const response = await agent.sendMessage('Teach me fractions');

      assert.equal(gatewayCalls, 0);
      assert.match(response.text, /select.*learner/i);
      assert.equal(response.actionCard.title, 'Parent Zone');
    } finally {
      global.window = originalWindow;
      global.document = originalDocument;
      delete require.cache[require.resolve('../frontend/chat-agent.js')];
    }
  });

  test('AppuBackendClient.sendAppuMessage forwards includeAudio flag when provided', async () => {
    let capturedBody = {};
    const originalFetch = global.fetch;

    global.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            text: 'Audio preference acknowledged',
            audioSource: null
          };
        }
      };
    };

    try {
      // 1. Explicit includeAudio: false
      await AppuBackendClient.sendAppuMessage({
        message: 'Text only please',
        includeAudio: false,
        baseUrl: 'http://localhost:3000'
      });
      assert.equal(capturedBody.includeAudio, false);

      // 2. Explicit includeAudio: true
      await AppuBackendClient.sendAppuMessage({
        message: 'Voice please',
        includeAudio: true,
        baseUrl: 'http://localhost:3000'
      });
      assert.equal(capturedBody.includeAudio, true);

      // 3. includeAudio omitted
      await AppuBackendClient.sendAppuMessage({
        message: 'Default audio',
        baseUrl: 'http://localhost:3000'
      });
      assert.equal(capturedBody.includeAudio, undefined);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // ============================================================================
  // 3. AUDIO STREAM URL ORIGIN RESOLUTION & SECURITY (KANNADA V3 FIX)
  // ============================================================================

  test('resolveAudioStreamUrl: relative audioStreamUrl resolves to api.appuai.online and never appuai.online', () => {
    const relativePath = '/api/appu/audio/stream?requestId=test-uuid-123';

    // 1. Default configured API base
    const resolvedDefault = AppuBackendClient.resolveAudioStreamUrl(relativePath);
    assert.equal(resolvedDefault, 'https://api.appuai.online/api/appu/audio/stream?requestId=test-uuid-123');
    assert.notEqual(resolvedDefault, 'https://appuai.online/api/appu/audio/stream?requestId=test-uuid-123');

    // 2. Custom backend baseUrl
    const resolvedCustom = AppuBackendClient.resolveAudioStreamUrl(relativePath, 'https://api-staging.appuai.online');
    assert.equal(resolvedCustom, 'https://api-staging.appuai.online/api/appu/audio/stream?requestId=test-uuid-123');
  });

  test('resolveAudioStreamUrl: preserves trusted absolute backend URLs and rejects untrusted origins', () => {
    // 1. Trusted backend origin
    const trustedUrl = 'https://api.appuai.online/api/appu/audio/stream?requestId=test-uuid-456';
    assert.equal(AppuBackendClient.resolveAudioStreamUrl(trustedUrl), trustedUrl);

    // 2. Untrusted external origin (e.g. attacker domain attempting Bearer token exfiltration)
    const evilUrl = 'https://attacker.evil.com/api/appu/audio/stream?requestId=test-uuid-456';
    assert.equal(AppuBackendClient.resolveAudioStreamUrl(evilUrl), null, 'Must block untrusted third-party origins');

    // 3. Static website domain (appuai.online) should not receive audio stream requests
    const staticHostUrl = 'https://appuai.online/api/appu/audio/stream?requestId=test-uuid-456';
    assert.equal(AppuBackendClient.resolveAudioStreamUrl(staticHostUrl), null, 'Must reject static frontend host origin');

    // 4. Invalid or non-string inputs
    assert.equal(AppuBackendClient.resolveAudioStreamUrl(null), null);
    assert.equal(AppuBackendClient.resolveAudioStreamUrl(undefined), null);
    assert.equal(AppuBackendClient.resolveAudioStreamUrl(''), null);
  });

  test('sendAppuMessage normalizes relative audioStreamUrl into absolute backend URL with Authorization', async () => {
    let capturedUrl = '';
    let capturedHeaders = {};

    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
      capturedUrl = url;
      capturedHeaders = options.headers;
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            text: 'ಕನ್ನಡ ಉತ್ತರ',
            audioSource: null,
            audioStreamUrl: '/api/appu/audio/stream?requestId=req-kannada-789',
            audioDurationMs: null,
            childId: 'c123'
          };
        }
      };
    };

    try {
      const response = await AppuBackendClient.sendAppuMessage({
        accessToken: 'valid-learner-bearer-token',
        childId: 'c123',
        message: 'ನಮಸ್ಕಾರ',
        language: 'kn'
      });

      // 1. Backend message request had valid Authorization
      assert.equal(capturedUrl, 'https://api.appuai.online/api/appu/message');
      assert.equal(capturedHeaders['Authorization'], 'Bearer valid-learner-bearer-token');

      // 2. Returned audioStreamUrl is normalized to api.appuai.online
      assert.equal(response.audioStreamUrl, 'https://api.appuai.online/api/appu/audio/stream?requestId=req-kannada-789');
      assert.equal(response.text, 'ಕನ್ನಡ ಉತ್ತರ');
      assert.equal(response.audioSource, null);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('sendAppuMessage preserves English audioSource and includeAudio=false behavior unchanged', async () => {
    const originalFetch = global.fetch;

    try {
      // Case A: English turn returns Base64 audioSource and null audioStreamUrl
      global.fetch = async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            text: 'Hello learner!',
            audioSource: 'data:audio/mpeg;base64,SUQzBAAAAAAA...',
            audioStreamUrl: null,
            audioDurationMs: 2500
          };
        }
      });

      const resEnglish = await AppuBackendClient.sendAppuMessage({
        accessToken: 'token-123',
        childId: 'c123',
        message: 'Hello Appu',
        language: 'en',
        includeAudio: true
      });

      assert.equal(resEnglish.audioSource, 'data:audio/mpeg;base64,SUQzBAAAAAAA...');
      assert.equal(resEnglish.audioStreamUrl, null);
      assert.equal(resEnglish.audioDurationMs, 2500);

      // Case B: includeAudio=false returns text only with null audioSource and null audioStreamUrl
      global.fetch = async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            text: 'Text only response',
            audioSource: null,
            audioStreamUrl: null,
            audioDurationMs: null
          };
        }
      });

      const resTextOnly = await AppuBackendClient.sendAppuMessage({
        accessToken: 'token-123',
        childId: 'c123',
        message: 'No audio please',
        includeAudio: false
      });

      assert.equal(resTextOnly.text, 'Text only response');
      assert.equal(resTextOnly.audioSource, null);
      assert.equal(resTextOnly.audioStreamUrl, null);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
