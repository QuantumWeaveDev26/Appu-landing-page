const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../frontend');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('client voice code contains no direct TTS vendor request or embedded secret', () => {
  const source = read('voice-engine.js');

  assert.doesNotMatch(source, /api\.elevenlabs\.io/i);
  assert.doesNotMatch(source, /xi-api-key/i);
  assert.doesNotMatch(source, /sk_[a-z0-9]{24,}/i);
  assert.doesNotMatch(source, /generateClonedSpeech/);
});

test('application uses the real chat and live-session method names', () => {
  const source = read('app.js');

  assert.doesNotMatch(source, /chatAgent\.clearMessages\(/);
  assert.doesNotMatch(source, /voiceEngine\.toggleListening\(/);
  assert.match(source, /chatAgent\.clearHistory\(/);
  assert.match(source, /voiceEngine\.toggleLiveSession\(/);
});

test('obsolete local voice samples are absent and unreferenced', () => {
  const source = read('chat-agent.js');

  assert.doesNotMatch(source, /appu_reference|WhatsApp Audio|\.wav|\.mpeg/i);
  assert.equal(fs.existsSync(path.join(root, 'assets', 'appu_reference.wav')), false);
  assert.equal(fs.existsSync(path.join(root, 'assets', 'WhatsApp Audio 2026-08-14 at 11.10.11.mpeg')), false);
});
