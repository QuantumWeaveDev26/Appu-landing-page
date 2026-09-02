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

test('voice-engine.js enforces 100% volume and unmuted playback across all voice paths', () => {
  const source = read('voice-engine.js');

  // 1. Explicit volume 1.0 and muted false in constructor
  assert.match(source, /this\.audioPlayer\.volume\s*=\s*1(?:\.0)?;/);
  assert.match(source, /this\.audioPlayer\.muted\s*=\s*false;/);

  // 2. English Base64 / playBackendAudio path maintains volume = 1.0 and muted = false
  assert.match(source, /playBackendAudio\([^)]*\)[\s\S]*?this\.audioPlayer\.volume\s*=\s*1(?:\.0)?;/);
  assert.match(source, /playBackendAudio\([^)]*\)[\s\S]*?this\.audioPlayer\.muted\s*=\s*false;/);

  // 3. Kannada Streaming / playStream path maintains volume = 1.0 and muted = false
  assert.match(source, /playStream\([^)]*\)[\s\S]*?this\.audioPlayer\.volume\s*=\s*1(?:\.0)?;/);
  assert.match(source, /playStream\([^)]*\)[\s\S]*?this\.audioPlayer\.muted\s*=\s*false;/);

  // 4. stopSpeaking preserves configured volume 1.0 and unmuted state
  assert.match(source, /stopSpeaking\(\)[\s\S]*?this\.audioPlayer\.volume\s*=\s*1(?:\.0)?;/);
  assert.match(source, /stopSpeaking\(\)[\s\S]*?this\.audioPlayer\.muted\s*=\s*false;/);

  // 5. Zero code reducing voice volume below 1.0 or setting muted = true
  assert.doesNotMatch(source, /this\.audioPlayer\.volume\s*=\s*0\./);
  assert.doesNotMatch(source, /this\.audioPlayer\.muted\s*=\s*true/);
});

test('frontend implements 3-way language switch (ENG | ಕನ್ನಡ | हिंदी) with full UI localization', () => {
  const html = read('index.html');
  const appJs = read('app.js');
  const voiceJs = read('voice-engine.js');

  // 1. HTML defines all 3 language buttons
  assert.match(html, /id="lang-en"/, 'Must contain ENG button');
  assert.match(html, /id="lang-kn"/, 'Must contain Kannada button');
  assert.match(html, /id="lang-hi"/, 'Must contain Hindi button');
  assert.match(html, /class="language-switch"[^>]*role="radiogroup"/, 'Language switch must have role=radiogroup');

  // 2. voice-engine.js configures speech recognition for en-IN, kn-IN, hi-IN
  assert.match(voiceJs, /kn-IN/, 'Must support kn-IN speech recognition');
  assert.match(voiceJs, /hi-IN/, 'Must support hi-IN speech recognition');
  assert.match(voiceJs, /en-IN/, 'Must support en-IN speech recognition');

  // 3. app.js contains centralized UI_TRANSLATIONS dictionary for en, kn, hi
  assert.match(appJs, /UI_TRANSLATIONS\s*=\s*\{/, 'Must define UI_TRANSLATIONS');
  assert.match(appJs, /en:\s*\{/, 'Must have en translations');
  assert.match(appJs, /kn:\s*\{/, 'Must have kn translations');
  assert.match(appJs, /hi:\s*\{/, 'Must have hi translations');

  // 4. app.js synchronizes document.documentElement.lang and localStorage
  assert.match(appJs, /document\.documentElement\.lang\s*=\s*lang/, 'Must synchronize html lang attribute');
  assert.match(appJs, /localStorage\.setItem\(['"]appu_lang['"]/, 'Must persist selected language');
  assert.match(appJs, /applyUiTranslations\(/, 'Must apply UI translations dynamically');
});
