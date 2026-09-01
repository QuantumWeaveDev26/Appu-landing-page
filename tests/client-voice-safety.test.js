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

test('voice-engine.js implements jitter-free streaming playback queue and initial buffer threshold', () => {
  const source = read('voice-engine.js');

  // 1. Initial startup buffer threshold between 1.0 and 1.5 seconds
  assert.match(source, /MIN_STARTUP_BUFFER_SECS\s*=\s*(1\.[0-5]|1);/, 'Must define startup buffer threshold ~1.0-1.5s');

  // 2. FIFO chunk queue and updateend sequential processing
  assert.match(source, /chunkQueue\s*=\s*\[\]/, 'Must maintain a chunk FIFO queue');
  assert.match(source, /sourceBuffer\.addEventListener\(['"]updateend['"]/, 'Must process queue on updateend');

  // 3. Clean endOfStream on complete download + empty queue
  assert.match(source, /mediaSource\.endOfStream\(\)/, 'Must call endOfStream when download complete and queue drained');

  // 4. AbortController / cancellation integration on stopSpeaking
  assert.match(source, /currentStreamController/, 'Must track current stream controller');
  assert.match(source, /abort\(\)/, 'Must abort controller on stopSpeaking');
});
