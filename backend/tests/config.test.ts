import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, ConfigValidationError } from '../src/config/index.js';

test('loadConfig applies safe defaults when env is empty', () => {
  const config = loadConfig({});

  assert.equal(config.NODE_ENV, 'development');
  assert.equal(config.PORT, 3000);
  assert.equal(config.HOST, '0.0.0.0');
  assert.equal(config.LOG_LEVEL, 'info');
});

test('loadConfig parses valid custom environment variables', () => {
  const config = loadConfig({
    NODE_ENV: 'production',
    PORT: '8080',
    HOST: '127.0.0.1',
    LOG_LEVEL: 'debug',
    GUEST_SESSION_SECRET: 'test_production_secret_32_chars_long'
  });

  assert.equal(config.NODE_ENV, 'production');
  assert.equal(config.PORT, 8080);
  assert.equal(config.HOST, '127.0.0.1');
  assert.equal(config.LOG_LEVEL, 'debug');
  assert.equal(config.GUEST_SESSION_SECRET, 'test_production_secret_32_chars_long');
});

test('loadConfig rejects invalid PORT (non-numeric, negative, out of range)', () => {
  assert.throws(
    () => loadConfig({ PORT: 'not-a-number' }),
    (err) => err instanceof ConfigValidationError && 'PORT' in err.issues
  );

  assert.throws(
    () => loadConfig({ PORT: '0' }),
    (err) => err instanceof ConfigValidationError && 'PORT' in err.issues
  );

  assert.throws(
    () => loadConfig({ PORT: '70000' }),
    (err) => err instanceof ConfigValidationError && 'PORT' in err.issues
  );

  assert.throws(
    () => loadConfig({ PORT: '-10' }),
    (err) => err instanceof ConfigValidationError && 'PORT' in err.issues
  );
});

test('loadConfig rejects invalid NODE_ENV', () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: 'staging' }),
    (err) => err instanceof ConfigValidationError && 'NODE_ENV' in err.issues
  );
});

test('loadConfig rejects invalid LOG_LEVEL', () => {
  assert.throws(
    () => loadConfig({ LOG_LEVEL: 'verbose' }),
    (err) => err instanceof ConfigValidationError && 'LOG_LEVEL' in err.issues
  );
});

test('loadConfig in production rejects missing GUEST_SESSION_SECRET', () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: 'production' }),
    (err) => err instanceof ConfigValidationError && 'GUEST_SESSION_SECRET' in err.issues
  );
});

test('loadConfig in production rejects empty or whitespace GUEST_SESSION_SECRET', () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: 'production', GUEST_SESSION_SECRET: '   ' }),
    (err) => err instanceof ConfigValidationError && 'GUEST_SESSION_SECRET' in err.issues
  );
});

test('loadConfig in production rejects GUEST_SESSION_SECRET shorter than 16 characters', () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: 'production', GUEST_SESSION_SECRET: 'short_secret' }),
    (err) => err instanceof ConfigValidationError && 'GUEST_SESSION_SECRET' in err.issues
  );
});

test('loadConfig in production accepts valid GUEST_SESSION_SECRET', () => {
  const config = loadConfig({
    NODE_ENV: 'production',
    GUEST_SESSION_SECRET: 'super_secure_production_secret_key_123'
  });
  assert.equal(config.GUEST_SESSION_SECRET, 'super_secure_production_secret_key_123');
});
