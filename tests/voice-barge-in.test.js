// Barge-in and always-on mic, exercised on the real VoiceEngine with a fake browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadEngine() {
  const el = () => ({ classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, appendChild() {}, dataset: {}, textContent: '' });
  class FakeRecognition { start() { this.started = (this.started || 0) + 1; } stop() {} abort() { this.aborted = (this.aborted || 0) + 1; } }
  class FakeAudio { constructor() { this.paused = true; this.listeners = {}; } addEventListener(n, f) { this.listeners[n] = f; } pause() { this.paused = true; } }
  const timers = [];
  const window = {
    SpeechRecognition: FakeRecognition,
    setTimeout: (f) => { timers.push(f); return timers.length; },
    clearTimeout() {}, clearInterval() {}, setInterval() { return 1; }
  };
  const document = { getElementById: () => el(), querySelector: () => null, body: el() };
  const ctx = { window, document, navigator: { mediaDevices: { getUserMedia() {} } }, Audio: FakeAudio, console, AbortController };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'frontend', 'voice-engine.js'), 'utf8'), ctx);
  const heard = [];
  const engine = new window.VoiceEngine({ onTranscript: (t) => heard.push(t) });
  engine.initWebAudio = () => {};
  engine.playListenStart = () => {};
  engine.playListenStop = () => {};
  engine.streamSubtitles = () => {};
  return { engine, heard, timers };
}

const result = (text, isFinal) => ({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal })] });

test('Appu hearing its own voice is ignored; the learner talking over it interrupts', () => {
  const { engine, heard } = loadEngine();
  engine.toggleMic();
  assert.equal(engine.liveMode, 'mic');
  engine.isSpeaking = true;
  engine.currentSpeechText = 'The mantle is the thick, hot middle layer beneath the crust.';
  engine.recognition.onresult(result('the mantle is the thick hot', false));
  assert.equal(engine.isSpeaking, true, 'echo must not stop Appu');
  engine.recognition.onresult(result('the mantle is the thick hot middle layer', true));
  assert.deepEqual(heard, [], 'echo must never be sent as a question');
  engine.recognition.onresult(result('wait tell me about volcanoes', false));
  assert.equal(engine.isSpeaking, false, 'learner speech stops Appu');
  engine.recognition.onresult(result('wait tell me about volcanoes instead', true));
  assert.deepEqual(heard, ['wait tell me about volcanoes instead']);
});

test('the mic stays on: silence, recognition hiccups and Appu speaking do not switch it off', () => {
  const { engine } = loadEngine();
  engine.toggleMic();
  engine.recognition.onstart();
  engine.handleSilenceTimeout();
  assert.equal(engine.liveSessionActive, true);
  engine.recognition.onerror({ error: 'network' });
  engine.isListening = false;
  const before = engine.recognition.started;
  engine.recognition.onend();
  assert.ok(engine.recognition.started > before, 'restarts after a hiccup');
  engine.audioPlayer.listeners.play();
  assert.ok(!engine.recognition.aborted, 'Appu speaking keeps the mic open in a live session');
  engine.toggleMic();
  assert.equal(engine.liveSessionActive, false, 'tapping the mic again turns it off');
});

test('a lost answer never leaves the mic silently off', () => {
  const { engine, timers } = loadEngine();
  engine.toggleMic();
  engine.recognition.onstart();
  engine.recognition.onresult(result('what is gravity', true));
  assert.equal(engine.awaitingResponse, true);
  engine.isListening = false;
  timers.forEach((f) => f());
  assert.equal(engine.awaitingResponse, false);
  assert.ok(engine.recognition.started >= 2, 'listening again after the watchdog');
});

test('the phone button starts a call; a mic session switches to the call', () => {
  const { engine } = loadEngine();
  engine.toggleMic();
  engine.startCall();
  assert.equal(engine.liveMode, 'call');
  assert.equal(engine.liveSessionActive, true);
});
