const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function withStorage(profile, fn) {
  const store = { appu_guest_profile: JSON.stringify(profile) };
  const prev = global.localStorage;
  global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  return Promise.resolve(fn()).finally(() => { global.localStorage = prev; });
}

async function guestBody() {
  let body = null;
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => { body = JSON.parse(opts.body); return { ok: true, headers: new Map(), json: async () => ({ text: 'ok' }) }; };
  try {
    const client = require('../frontend/appu-backend-client.js');
    await client.sendAppuMessage({ message: 'What is gravity?', baseUrl: 'https://api.example.test' });
  } finally { global.fetch = originalFetch; }
  return body;
}

test('guest messages carry the landing nickname, class and favourite subject', () => withStorage(
  { nickname: 'Chinnu', grade: '6', favoriteSubject: 'Science' },
  async () => assert.deepEqual((await guestBody()).guestProfile, { nickname: 'Chinnu', grade: '6', favoriteSubject: 'Science' })
));

test('bad stored values are dropped instead of being sent', () => withStorage(
  { nickname: '<b>x</b>', grade: '3', favoriteSubject: 'Maths' },
  async () => assert.deepEqual((await guestBody()).guestProfile, { favoriteSubject: 'Maths' })
));

test('a skipped profile sends no guestProfile at all', () => withStorage(
  {},
  async () => assert.equal('guestProfile' in (await guestBody()), false)
));

test('first landing question asks for the profile before answering', () => {
  const js = fs.readFileSync(path.resolve(__dirname, '../frontend/landing-page.js'), 'utf8');
  assert.match(js, /if \(!authed && !this\.getGuestProfile\(\)\) \{ this\.askGuestProfile\(q\); return; \}/);
});
