import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Frontend Public Configuration & Environment Strategy', () => {
  it('defaults to http://localhost:3000 in local development environment', async () => {
    const originalWindow = global.window;
    global.window = {
      location: { hostname: 'localhost' }
    };

    // Load module fresh
    delete global.APPU_CONFIG;
    const configModule = await import(`../appu-config.js?t=${Date.now()}`);
    const config = configModule.default || global.APPU_CONFIG;

    assert.equal(config.apiBaseUrl, 'http://localhost:3000');
    assert.ok(config.supabaseUrl);
    assert.ok(config.supabasePublishableKey);

    global.window = originalWindow;
  });

  it('honors window.__APPU_API_BASE_URL__ explicit runtime override in production', async () => {
    const originalWindow = global.window;
    global.window = {
      location: { hostname: 'appu.yourdomain.com' },
      __APPU_API_BASE_URL__: 'https://api.yourdomain.com/'
    };

    delete global.APPU_CONFIG;
    const configModule = await import(`../appu-config.js?t=${Date.now()}`);
    const config = configModule.default || global.APPU_CONFIG;

    assert.equal(config.apiBaseUrl, 'https://api.yourdomain.com');

    global.window = originalWindow;
  });

  it('falls back to documented placeholder on hosted domains without explicit override', async () => {
    const originalWindow = global.window;
    global.window = {
      location: { hostname: 'appu-staging.cloud' }
    };

    delete global.APPU_CONFIG;
    const configModule = await import(`../appu-config.js?t=${Date.now()}`);
    const config = configModule.default || global.APPU_CONFIG;

    assert.equal(config.apiBaseUrl, 'https://api.example.com');

    global.window = originalWindow;
  });

  it('contains zero private keys, secret keys, or database URLs', async () => {
    const originalWindow = global.window;
    global.window = {
      location: { hostname: 'localhost' }
    };

    delete global.APPU_CONFIG;
    const configModule = await import(`../appu-config.js?t=${Date.now()}`);
    const config = configModule.default || global.APPU_CONFIG;

    const str = JSON.stringify(config);
    assert.equal(str.includes('rzp_test_secret'), false);
    assert.equal(str.includes('service_role'), false);
    assert.equal(str.includes('postgresql://'), false);
    assert.equal(str.includes('webhook'), false);

    global.window = originalWindow;
  });
});
