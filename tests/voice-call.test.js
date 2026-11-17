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
  assert.match(app, /window\.VoiceCall\.attach\(voiceEngine\)/);
});
