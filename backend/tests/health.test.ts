import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';

test('GET /health returns 200 with status ok', async () => {
  const config = loadConfig({
    NODE_ENV: 'test',
    PORT: '3000',
    HOST: '127.0.0.1',
    LOG_LEVEL: 'silent'
  });

  const app = buildApp(config);

  const response = await app.inject({
    method: 'GET',
    url: '/health'
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['content-type'] ?? '', /application\/json/);
  
  const payload = JSON.parse(response.payload);
  assert.deepEqual(payload, { status: 'ok' });

  await app.close();
});

test('GET /unknown-route returns structured 404 error', async () => {
  const config = loadConfig({
    NODE_ENV: 'test',
    PORT: '3000',
    HOST: '127.0.0.1',
    LOG_LEVEL: 'silent'
  });

  const app = buildApp(config);

  const response = await app.inject({
    method: 'GET',
    url: '/non-existent-endpoint'
  });

  assert.equal(response.statusCode, 404);
  const payload = JSON.parse(response.payload);
  assert.equal(payload.error.code, 'not_found');
  assert.equal(payload.error.message, 'Route not found');

  await app.close();
});

test('untrusted forwarded headers cannot override request identity by default', async () => {
  const config = loadConfig({
    NODE_ENV: 'test',
    PORT: '3000',
    HOST: '127.0.0.1',
    LOG_LEVEL: 'silent'
  });

  const app = buildApp(config);
  app.get('/request-identity', async (request) => ({
    ip: request.ip,
    protocol: request.protocol
  }));

  const response = await app.inject({
    method: 'GET',
    url: '/request-identity',
    headers: {
      'x-forwarded-for': '203.0.113.99',
      'x-forwarded-proto': 'https'
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.payload), {
    ip: '127.0.0.1',
    protocol: 'http'
  });

  await app.close();
});
