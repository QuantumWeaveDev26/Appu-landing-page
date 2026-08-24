import crypto from 'node:crypto';
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { DefaultN8nClient } from '../src/domain/gateway/client.js';
import { verifyAppuHmacSignature } from '../src/domain/gateway/hmac.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('DefaultN8nClient signs the exact serialized request body with a fresh timestamp', async () => {
  const signingSecret = 'test_request_signing_secret_at_least_32_chars';
  const fixedNow = 1_787_558_400_000;
  let capturedInit: RequestInit | undefined;

  globalThis.fetch = async (_input, init) => {
    capturedInit = init;
    return new Response(JSON.stringify({ output: 'Signed response' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  const client = new DefaultN8nClient({
    webhookUrl: 'https://duplicate.example.test/webhook/appu',
    requestSigningSecret: signingSecret,
    now: () => fixedNow
  } as any);

  const envelope = {
    requestId: '11111111-1111-4111-8111-111111111111',
    action: 'sendMessage' as const,
    channel: 'website' as const,
    sessionId: 'appu_guest_gst_test',
    chatInput: 'What is gravity?',
    message: 'What is gravity?',
    language: 'en',
    mentorContext: {
      mode: 'guest' as const,
      primaryLanguage: 'en',
      personalizationEnabled: false as const
    }
  };

  await client.sendMessage(envelope);

  assert.ok(capturedInit);
  const rawBody = String(capturedInit.body);
  assert.equal(rawBody, JSON.stringify(envelope));

  const timestamp = String(Math.floor(fixedNow / 1000));
  const expectedSignature = crypto
    .createHmac('sha256', signingSecret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  const headers = new Headers(capturedInit.headers);
  assert.equal(headers.get('x-appu-timestamp'), timestamp);
  assert.equal(headers.get('x-appu-signature'), `v1=${expectedSignature}`);
});

test('network transport failure is classified as unknown rather than definite failure', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('connection reset after request write');
  };
  const client = new DefaultN8nClient({
    webhookUrl: 'https://duplicate.example.test/webhook/appu'
  });

  await assert.rejects(
    client.sendMessage({
      requestId: '11111111-1111-4111-8111-111111111111',
      action: 'sendMessage',
      channel: 'website',
      sessionId: 'guest-session',
      chatInput: 'Hello',
      message: 'Hello',
      language: 'en',
      mentorContext: {
        mode: 'guest',
        primaryLanguage: 'en',
        personalizationEnabled: false
      }
    }),
    (error: any) => error?.code === 'service_temporarily_unavailable'
  );
});

test('n8n 5xx is classified as unknown because execution may have already consumed provider work', async () => {
  globalThis.fetch = async () => new Response('workflow failed after dispatch', { status: 500 });
  const client = new DefaultN8nClient({
    webhookUrl: 'https://duplicate.example.test/webhook/appu'
  });

  await assert.rejects(
    client.sendMessage({
      requestId: '22222222-2222-4222-8222-222222222222',
      action: 'sendMessage',
      channel: 'website',
      sessionId: 'guest-session',
      chatInput: 'Hello',
      message: 'Hello',
      language: 'en',
      mentorContext: {
        mode: 'guest',
        primaryLanguage: 'en',
        personalizationEnabled: false
      }
    }),
    (error: any) => error?.code === 'service_temporarily_unavailable'
  );
});

test('HMAC verifier rejects missing, malformed, stale, and altered signatures', () => {
  const secret = 'test_callback_signing_secret_at_least_32_chars';
  const now = 1_787_558_400_000;
  const timestamp = String(Math.floor(now / 1000));
  const rawBody = '{"requestId":"11111111-1111-4111-8111-111111111111"}';
  const signature = `v1=${crypto.createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')}`;

  assert.deepEqual(verifyAppuHmacSignature({ rawBody, secret }), {
    valid: false,
    reason: 'missing'
  });
  assert.deepEqual(verifyAppuHmacSignature({
    rawBody,
    secret,
    timestampHeader: timestamp,
    signatureHeader: 'v1=not-hex',
    now: () => now
  }), { valid: false, reason: 'malformed' });
  assert.deepEqual(verifyAppuHmacSignature({
    rawBody,
    secret,
    timestampHeader: String(Number(timestamp) - 301),
    signatureHeader: signature,
    now: () => now,
    maxAgeSeconds: 300
  }), { valid: false, reason: 'stale' });
  assert.deepEqual(verifyAppuHmacSignature({
    rawBody: `${rawBody} `,
    secret,
    timestampHeader: timestamp,
    signatureHeader: signature,
    now: () => now
  }), { valid: false, reason: 'mismatch' });
});
