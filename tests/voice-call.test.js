const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const VoiceCall = require('../frontend/voice-call.js');

function fakeEngine() {
  return {
    liveSessionActive: false, isSpeaking: false, isListening: false, awaitingResponse: false,
    startLiveSession() { this.liveSessionActive = true; },
    stopLiveSession() { this.liveSessionActive = false; },
    onTranscript() {}, onInterimTranscript() {}
  };
}

test('call screen opens with the live session and closes when it ends', () => {
  const calls = [];
  const engine = fakeEngine();
  const call = VoiceCall.attach(engine, {});
  call.open = () => calls.push('open');
  call.close = () => calls.push('close');
  // attach() wraps the engine methods, so the stubs above are what they reach.
  engine.startLiveSession();
  engine.stopLiveSession();
  assert.deepEqual(calls, ['open', 'close']);
});

test('heard words still reach the app after the call screen shows them', () => {
  const engine = fakeEngine();
  const got = [];
  engine.onTranscript = (t) => got.push(t);
  const call = VoiceCall.attach(engine, {});
  call.showHeard = () => {};
  engine.onTranscript('what is gravity');
  assert.deepEqual(got, ['what is gravity']);
});

test('barge-in needs a loud, sustained voice and the engine can be interrupted', () => {
  assert.ok(VoiceCall.BARGE_IN_RMS >= 0.05);
  assert.ok(VoiceCall.BARGE_IN_HOLD_MS >= 250);
  const engine = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'voice-engine.js'), 'utf8');
  assert.match(engine, /interrupt\(\) \{\s*if \(!this\.isSpeaking\) return false;\s*this\.stopSpeaking\(\);/);
  const app = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'app.js'), 'utf8');
  assert.match(app, /window\.VoiceCall\.attach\(voiceEngine, document, \{/);
});

test('mic buttons are voice typing; only the phone button starts a call', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'app.js'), 'utf8');
  const micBlock = app.slice(app.indexOf("  if (btnMic) {"), app.indexOf("  // Call button:"));
  assert.match(micBlock, /voiceEngine\.toggleDictation\(\)/);
  assert.doesNotMatch(micBlock, /toggleLiveSession/);
  const chatMic = app.slice(app.indexOf("  if (btnChatMic) {"), app.indexOf("  if (btnChatMic) {") + 700);
  assert.match(chatMic, /voiceEngine\.toggleDictation\(\)/);
  assert.match(app, /btnCall\.addEventListener[\s\S]{0,500}voiceEngine\.startLiveSession\(\)/);
  assert.match(app, /onCallStart[\s\S]{0,300}Voice call started/);
  const html = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'index.html'), 'utf8');
  assert.match(html, /id="btn-call"/);
});

test('call start and end are reported with the call length', () => {
  const engine = fakeEngine();
  const events = [];
  const fakeDoc = { createElement: () => ({ querySelector: () => ({ addEventListener() {}, textContent: '' }), setAttribute() {}, dataset: {}, remove() {} }), body: { appendChild() {}, classList: { add() {}, remove() {} } } };
  globalThis.setInterval = globalThis.setInterval || setInterval;
  const call = VoiceCall.attach(engine, fakeDoc, { onCallStart: () => events.push('start'), onCallEnd: ({ seconds }) => events.push(`end:${seconds}`) });
  call.render = () => {};
  engine.isVoiceSupported = true;
  engine.startLiveSession();
  engine.stopLiveSession();
  assert.deepEqual(events, ['start', 'end:0']);
});

test('only the ElevenLabs Appu voice is ever played: no device text-to-speech anywhere', () => {
  for (const f of ['voice-engine.js', 'lesson-card-renderer.js', 'app.js', 'brain-break.js', 'chat-agent.js', 'voice-call.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'frontend', f), 'utf8');
    assert.doesNotMatch(src, /new SpeechSynthesisUtterance|speechSynthesis\.speak\(/, f);
  }
});
