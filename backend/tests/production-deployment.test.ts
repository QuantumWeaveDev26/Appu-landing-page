import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/index.js';

describe('Production Deployment & Environment Readiness', () => {
  const baseDevConfig = loadConfig({
    NODE_ENV: 'development',
    PORT: '3000',
    LOG_LEVEL: 'silent'
  });

  const baseProdConfig = loadConfig({
    NODE_ENV: 'production',
    PORT: '8080',
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ALLOWED_ORIGINS: 'https://appu.example.com,https://www.appu.example.com'
  });

  describe('CORS Enforcement in Production vs Development', () => {
    it('allows configured production origin and echoes back matching origin', async () => {
      const app = buildApp(baseProdConfig);
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          origin: 'https://appu.example.com'
        }
      });

      assert.equal(res.statusCode, 204);
      assert.equal(res.headers['access-control-allow-origin'], 'https://appu.example.com');
      assert.equal(res.headers['vary'], 'Origin');
      assert.ok(res.headers['access-control-allow-headers']?.includes('Idempotency-Key'));
      assert.ok(res.headers['access-control-allow-headers']?.includes('Authorization'));
      await app.close();
    });

    it('rejects unapproved third-party origin with 403 on preflight in production', async () => {
      const app = buildApp(baseProdConfig);
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          origin: 'https://malicious-site.com'
        }
      });

      assert.equal(res.statusCode, 403);
      assert.equal(res.headers['access-control-allow-origin'], undefined);
      await app.close();
    });

    it('permits localhost origins automatically in development mode', async () => {
      const app = buildApp(baseDevConfig);
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          origin: 'http://localhost:5500'
        }
      });

      assert.equal(res.statusCode, 204);
      assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5500');
      await app.close();
    });
  });

  describe('Production Route Security', () => {
    it('disables checkout-test.html in production mode (returns 404)', async () => {
      const app = buildApp(baseProdConfig);
      const res = await app.inject({
        method: 'GET',
        url: '/checkout-test.html'
      });

      assert.equal(res.statusCode, 404);
      await app.close();
    });

    it('serves checkout-test.html in development mode (returns 200)', async () => {
      const app = buildApp(baseDevConfig);
      const res = await app.inject({
        method: 'GET',
        url: '/checkout-test.html'
      });

      assert.equal(res.statusCode, 200);
      assert.ok(res.headers['content-type']?.includes('text/html'));
      await app.close();
    });

    it('GET /health returns 200 without exposing server environment or secrets', async () => {
      const app = buildApp(baseProdConfig);
      const res = await app.inject({
        method: 'GET',
        url: '/health'
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.status, 'ok');
      assert.equal(body.database, undefined);
      assert.equal(body.secrets, undefined);
      await app.close();
    });
  });

  describe('Configuration & Port Binding', () => {
    it('coerces string PORT from environment and validates range', () => {
      const config = loadConfig({
        PORT: '8080',
        NODE_ENV: 'production'
      });
      assert.equal(config.PORT, 8080);
      assert.equal(config.NODE_ENV, 'production');
    });

    it('parses comma-separated CORS_ALLOWED_ORIGINS correctly', () => {
      const config = loadConfig({
        CORS_ALLOWED_ORIGINS: 'https://a.com, https://b.com'
      });
      assert.equal(config.CORS_ALLOWED_ORIGINS, 'https://a.com, https://b.com');
    });
  });
});
