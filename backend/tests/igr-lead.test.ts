import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { buildApp } from '../src/app.js';
import { envSchema } from '../src/config/env.js';

describe('POST /api/igr/lead - Fail-Closed Security & Error Handling', () => {
  let mockServer: http.Server;
  let mockPort: number;
  let mockHandler: (req: http.IncomingMessage, res: http.ServerResponse) => void;

  before(async () => {
    mockServer = http.createServer((req, res) => {
      if (mockHandler) {
        mockHandler(req, res);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      }
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, '127.0.0.1', () => {
        const addr = mockServer.address() as any;
        mockPort = addr.port;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
  });

  const baseConfig = envSchema.parse({
    NODE_ENV: 'test',
    PORT: 3000,
    HOST: '127.0.0.1',
    LOG_LEVEL: 'silent'
  });

  // 1. Valid payload + upstream 2xx -> 200 success
  test('1. valid payload + upstream 2xx returns 200 with success status', async () => {
    let receivedPayload: any = null;
    mockHandler = (req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        receivedPayload = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'lead_enqueued' }));
      });
    };

    const webhookUrl = `http://127.0.0.1:${mockPort}/webhook/secret-lead-path`;
    const app = buildApp({ ...baseConfig, IGR_LEAD_WEBHOOK_URL: webhookUrl }, {});

    const response = await app.inject({
      method: 'POST',
      url: '/api/igr/lead',
      headers: { 'content-type': 'application/json' },
      payload: {
        user_name: 'Ramesh Sharma',
        user_phone: '+919876543210',
        student_name: 'Aarav Sharma',
        email: 'ramesh@example.com',
        grade: 'Class 10',
        event_type: 'DISCOVERY_CALL_BOOKING'
      }
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.ok(receivedPayload);
    assert.equal(receivedPayload.action, 'sendMessage');
    assert.equal(receivedPayload.leadData.user_name, 'Ramesh Sharma');
    assert.equal(receivedPayload.leadData.user_phone, '+919876543210');

    await app.close();
  });

  // 2. Missing webhook configuration -> non-2xx failure (503)
  test('2. missing webhook configuration returns 503 Service Unavailable', async () => {
    const app = buildApp({ ...baseConfig, IGR_LEAD_WEBHOOK_URL: undefined }, {});

    const response = await app.inject({
      method: 'POST',
      url: '/api/igr/lead',
      headers: { 'content-type': 'application/json' },
      payload: {
        user_name: 'Ramesh Sharma',
        user_phone: '+919876543210',
        student_name: 'Aarav Sharma',
        email: 'ramesh@example.com',
        grade: 'Class 10'
      }
    });

    assert.equal(response.statusCode, 503);
    const body = JSON.parse(response.body);
    assert.equal(body.error?.code, 'service_temporarily_unavailable');
    assert.equal(body.success, undefined);

    await app.close();
  });

  // 3. Upstream 500 -> non-2xx failure (502 Bad Gateway)
  test('3. upstream 500 returns 502 Bad Gateway', async () => {
    mockHandler = (_req, res) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error in workflow' }));
    };

    const webhookUrl = `http://127.0.0.1:${mockPort}/webhook/failing-lead-path`;
    const app = buildApp({ ...baseConfig, IGR_LEAD_WEBHOOK_URL: webhookUrl }, {});

    const response = await app.inject({
      method: 'POST',
      url: '/api/igr/lead',
      headers: { 'content-type': 'application/json' },
      payload: {
        user_name: 'Ramesh Sharma',
        user_phone: '+919876543210',
        student_name: 'Aarav Sharma',
        email: 'ramesh@example.com',
        grade: 'Class 10'
      }
    });

    assert.equal(response.statusCode, 502);
    const body = JSON.parse(response.body);
    assert.equal(body.error?.code, 'bad_gateway');

    await app.close();
  });

  // 4. Upstream network error / socket hang up -> non-2xx failure (502)
  test('4. upstream network error returns 502 Bad Gateway', async () => {
    mockHandler = (req) => {
      req.socket.destroy(); // Force sudden socket termination
    };

    const webhookUrl = `http://127.0.0.1:${mockPort}/webhook/broken-socket`;
    const app = buildApp({ ...baseConfig, IGR_LEAD_WEBHOOK_URL: webhookUrl }, {});

    const response = await app.inject({
      method: 'POST',
      url: '/api/igr/lead',
      headers: { 'content-type': 'application/json' },
      payload: {
        user_name: 'Ramesh Sharma',
        user_phone: '+919876543210',
        student_name: 'Aarav Sharma',
        email: 'ramesh@example.com',
        grade: 'Class 10'
      }
    });

    assert.equal(response.statusCode, 502);
    const body = JSON.parse(response.body);
    assert.equal(body.error?.code, 'bad_gateway');

    await app.close();
  });

  // 5. Malformed payload -> 400 Bad Request
  test('5. malformed payload (missing user_name) returns 400 Bad Request', async () => {
    const webhookUrl = `http://127.0.0.1:${mockPort}/webhook/test`;
    const app = buildApp({ ...baseConfig, IGR_LEAD_WEBHOOK_URL: webhookUrl }, {});

    const response = await app.inject({
      method: 'POST',
      url: '/api/igr/lead',
      headers: { 'content-type': 'application/json' },
      payload: {
        user_phone: '+919876543210'
      }
    });

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.equal(body.error?.code, 'invalid_request');

    await app.close();
  });

  test('5b. malformed payload (invalid phone) returns 400 Bad Request', async () => {
    const webhookUrl = `http://127.0.0.1:${mockPort}/webhook/test`;
    const app = buildApp({ ...baseConfig, IGR_LEAD_WEBHOOK_URL: webhookUrl }, {});

    const response = await app.inject({
      method: 'POST',
      url: '/api/igr/lead',
      headers: { 'content-type': 'application/json' },
      payload: {
        user_name: 'Ramesh',
        user_phone: '123'
      }
    });

    assert.equal(response.statusCode, 400);

    await app.close();
  });

  test('5c. malformed payload (invalid email) returns 400 Bad Request', async () => {
    const webhookUrl = `http://127.0.0.1:${mockPort}/webhook/test`;
    const app = buildApp({ ...baseConfig, IGR_LEAD_WEBHOOK_URL: webhookUrl }, {});

    const response = await app.inject({
      method: 'POST',
      url: '/api/igr/lead',
      headers: { 'content-type': 'application/json' },
      payload: {
        user_name: 'Ramesh',
        user_phone: '+919876543210',
        email: 'invalid-email-address'
      }
    });

    assert.equal(response.statusCode, 400);

    await app.close();
  });

  // 6. Response never contains the private webhook URL
  test('6. error and success responses never contain private webhook URL', async () => {
    const secretPath = 'super-secret-private-n8n-webhook-uuid-998877';
    const webhookUrl = `http://127.0.0.1:${mockPort}/${secretPath}`;

    mockHandler = (_req, res) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ secret: secretPath }));
    };

    const app = buildApp({ ...baseConfig, IGR_LEAD_WEBHOOK_URL: webhookUrl }, {});

    const response = await app.inject({
      method: 'POST',
      url: '/api/igr/lead',
      headers: { 'content-type': 'application/json' },
      payload: {
        user_name: 'Ramesh Sharma',
        user_phone: '+919876543210',
        student_name: 'Aarav Sharma',
        email: 'ramesh@example.com',
        grade: 'Class 10'
      }
    });

    assert.equal(response.statusCode, 502);
    assert.equal(response.body.includes(secretPath), false);
    assert.equal(response.body.includes(webhookUrl), false);

    await app.close();
  });
});
