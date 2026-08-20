import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';
import type { PostgresDatabase } from '../src/db/client.js';

test('GET /health returns 200 with status ok (liveness probe)', async () => {
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

test('GET /ready returns 200 with status ready when database is ready', async () => {
  const config = loadConfig({
    NODE_ENV: 'test',
    PORT: '3000',
    HOST: '127.0.0.1',
    LOG_LEVEL: 'silent'
  });

  // Mock a healthy database
  const mockHealthyDb = {
    isHealthy: async () => true,
    close: async () => {}
  } as unknown as PostgresDatabase;

  const app = buildApp(config, { database: mockHealthyDb });

  const response = await app.inject({
    method: 'GET',
    url: '/ready'
  });

  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.payload);
  assert.deepEqual(payload, { status: 'ready' });

  await app.close();
});

test('GET /ready returns 503 with status not_ready when database ping fails', async () => {
  const config = loadConfig({
    NODE_ENV: 'test',
    PORT: '3000',
    HOST: '127.0.0.1',
    LOG_LEVEL: 'silent'
  });

  // Mock an unhealthy database
  const mockUnhealthyDb = {
    isHealthy: async () => false,
    close: async () => {}
  } as unknown as PostgresDatabase;

  const app = buildApp(config, { database: mockUnhealthyDb });

  const response = await app.inject({
    method: 'GET',
    url: '/ready'
  });

  assert.equal(response.statusCode, 503);
  const payload = JSON.parse(response.payload);
  assert.deepEqual(payload, { status: 'not_ready' });
  // Ensure no internal DB details or credentials leaked
  assert.equal(payload.database, undefined);

  await app.close();
});

test('Fastify app.close() invokes database.close() cleanly', async () => {
  const config = loadConfig({
    NODE_ENV: 'test',
    PORT: '3000',
    HOST: '127.0.0.1',
    LOG_LEVEL: 'silent'
  });

  let closeInvoked = false;
  const mockDb = {
    isHealthy: async () => true,
    close: async () => {
      closeInvoked = true;
    }
  } as unknown as PostgresDatabase;

  const app = buildApp(config, { database: mockDb });
  await app.ready();
  await app.close();

  assert.equal(closeInvoked, true, 'Expected app.close() to invoke database.close()');
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

  let capturedIp = '';
  app.get('/test-ip', async (request, reply) => {
    capturedIp = request.ip;
    return reply.send({ ip: request.ip });
  });

  await app.inject({
    method: 'GET',
    url: '/test-ip',
    headers: {
      'x-forwarded-for': '198.51.100.24'
    }
  });

  assert.notEqual(capturedIp, '198.51.100.24', 'trustProxy must remain false until deployment proxy topology is confirmed');
  await app.close();
});
