const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.cjs');

/** Fake expo-speech-recognition: records starts/aborts and lets tests emit events. */
function fakeRecognition({ granted = true } = {}) {
  const listeners = {};
  const mod = {
    starts: [],
    aborts: 0,
    requestPermissionsAsync: async () => ({ granted }),
    addListener(name, fn) {
      (listeners[name] ||= []).push(fn);
      return { remove: () => (listeners[name] = listeners[name].filter((f) => f !== fn)) };
    },
    start(opts) {
      mod.starts.push(opts);
    },
    abort() {
      mod.aborts += 1;
    },
    emit(name, ev = {}) {
      (listeners[name] || []).forEach((f) => f(ev));
    },
    count: (name) => (listeners[name] || []).length,
  };
  return mod;
}

function setup(opts) {
  const rec = fakeRecognition(opts);
  const voice = { isSpeaking: false, speakingText: '', stops: 0, onIdle: null, prepared: 0, prepareForLive() { this.prepared += 1; }, stopPlayback() { this.stops += 1; this.isSpeaking = false; } };
  const mod = load('lib/liveVoice.ts', {
    'expo-speech-recognition': { ExpoSpeechRecognitionModule: rec },
    './voiceService': { voiceService: voice },
  });
  return { rec, voice, live: mod.liveVoice, isLikelyEcho: mod.isLikelyEcho, stripEcho: mod.stripEcho };
}

const result = (text, isFinal) => ({ isFinal, results: [{ transcript: text }] });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

describe('Echo filter', () => {
  const { isLikelyEcho } = setup();
  const said = 'Plants make their food from sunlight and water.';
  it('treats Appu\'s own words coming back through the speaker as echo', () => {
    assert.equal(isLikelyEcho('plants make food from sunlight', said), true);
  });
  it('treats new words as the learner interrupting', () => {
    assert.equal(isLikelyEcho('wait stop tell me about rockets', said), false);
  });
  it('one stop word is enough to interrupt ("stop", "wait", "ruko", "ನಿಲ್ಲಿಸು")', () => {
    for (const w of ['stop', 'Wait!', 'रुको', 'ನಿಲ್ಲಿಸು']) assert.equal(isLikelyEcho(w, said), false, w);
  });
  it('judges the newest words, so the learner talking after an echo still interrupts', () => {
    assert.equal(isLikelyEcho('plants make their food from sunlight and water tell me about rockets now', said), false);
  });
  it('removes Appu\'s words picked up before the learner spoke', () => {
    const { stripEcho } = setup();
    assert.equal(stripEcho('sunlight and water tell me about rockets', said), 'tell me about rockets');
  });
  it('ignores empty or punctuation-only results', () => {
    assert.equal(isLikelyEcho('  ...  ', said), true);
  });
  it('works for Kannada and Hindi script', () => {
    assert.equal(isLikelyEcho('ಸಸ್ಯಗಳು ಆಹಾರ', 'ಸಸ್ಯಗಳು ಸೂರ್ಯನ ಬೆಳಕಿನಿಂದ ಆಹಾರ ಮಾಡುತ್ತವೆ'), true);
    assert.equal(isLikelyEcho('रुको मुझे रॉकेट के बारे में बताओ', 'पौधे धूप से भोजन बनाते हैं'), false);
  });
});

describe('Always-on mic and call (liveVoice)', () => {
  let t;
  beforeEach(() => {
    t = setup();
  });
  afterEach(() => t.live.stop('user', false));

  it('starts continuous listening in the chosen language', async () => {
    const ok = await t.live.start('mic', 'kn', {});
    assert.equal(ok, true);
    assert.equal(t.live.mode, 'mic');
    assert.equal(t.rec.starts[0].continuous, true);
    assert.equal(t.rec.starts[0].interimResults, true);
    assert.equal(t.rec.starts[0].lang, 'kn-IN');
  });

  it('reports blocked when the microphone permission is refused', async () => {
    const s = setup({ granted: false });
    let stopped = null;
    const ok = await s.live.start('mic', 'en', { onStopped: (r) => (stopped = r) });
    assert.equal(ok, false);
    assert.equal(stopped, 'blocked');
    assert.equal(s.live.active, false);
  });

  it('sends partial words to the box and finished sentences as a question', async () => {
    const partial = [];
    const finals = [];
    await t.live.start('mic', 'en', { onPartial: (x) => partial.push(x), onFinal: (x) => finals.push(x) });
    t.rec.emit('result', result('what is', false));
    t.rec.emit('result', result('what is gravity', true));
    assert.deepEqual(partial, ['what is']);
    assert.deepEqual(finals, ['what is gravity']);
  });

  it('does not send a second question while an answer is on its way', async () => {
    const finals = [];
    await t.live.start('call', 'en', { onFinal: (x) => finals.push(x) });
    t.live.awaitingAnswer = true;
    t.rec.emit('result', result('another question', true));
    assert.deepEqual(finals, []);
  });

  it('ignores Appu\'s own voice while it speaks', async () => {
    let bargeIns = 0;
    await t.live.start('call', 'en', { onBargeIn: () => bargeIns++ });
    t.voice.isSpeaking = true;
    t.voice.speakingText = 'Gravity pulls things towards the Earth.';
    t.rec.emit('result', result('gravity pulls things', false));
    assert.equal(t.voice.stops, 0);
    assert.equal(bargeIns, 0);
  });

  it('stops Appu when the learner talks over it (barge-in)', async () => {
    let bargeIns = 0;
    const finals = [];
    await t.live.start('mic', 'en', { onBargeIn: () => bargeIns++, onFinal: (x) => finals.push(x) });
    t.voice.isSpeaking = true;
    t.voice.speakingText = 'Gravity pulls things towards the Earth.';
    t.rec.emit('result', result('wait I have a different question', true));
    assert.equal(t.voice.stops, 1);
    assert.equal(bargeIns, 1);
    assert.deepEqual(finals, ['wait I have a different question']);
  });

  it('keeps listening after silence: restarts when recognition ends', async () => {
    await t.live.start('mic', 'en', {});
    t.rec.emit('error', { error: 'no-speech' });
    t.rec.emit('end');
    await wait(400);
    assert.equal(t.rec.starts.length, 2);
    assert.equal(t.live.active, true);
  });

  it('keeps listening after an error even when the phone sends no "end"', async () => {
    await t.live.start('call', 'en', {});
    t.rec.emit('start');
    t.rec.emit('error', { error: 'audio-capture' });
    await wait(400);
    assert.equal(t.rec.starts.length, 2);
    assert.equal(t.live.active, true);
  });

  it('watchdog restarts a recogniser that stopped silently', async () => {
    await t.live.start('call', 'en', {});
    // no 'start' event ever arrives: after the start timeout the watchdog tries again
    await wait(6200);
    assert.ok(t.rec.starts.length >= 2, `starts: ${t.rec.starts.length}`);
  });

  it('listens afresh for the learner\'s turn when Appu finishes speaking', async () => {
    await t.live.start('call', 'en', {});
    t.rec.emit('start');
    assert.equal(typeof t.voice.onIdle, 'function');
    const aborts = t.rec.aborts;
    t.voice.onIdle();
    assert.equal(t.rec.aborts, aborts + 1);
    await wait(400);
    assert.equal(t.rec.starts.length, 2);
  });

  it('lets Appu\'s voice and the mic run together during a call', async () => {
    await t.live.start('call', 'en', {});
    assert.equal(t.voice.prepared, 1);
  });

  it('after an interruption, sends only the learner\'s words', async () => {
    const finals = [];
    await t.live.start('call', 'en', { onFinal: (x) => finals.push(x) });
    t.voice.isSpeaking = true;
    t.voice.speakingText = 'Gravity pulls things towards the Earth.';
    t.rec.emit('result', result('towards the earth stop what is a rocket', false));
    t.rec.emit('result', result('towards the earth stop what is a rocket', true));
    assert.deepEqual(finals, ['stop what is a rocket']);
  });

  it('switches off only when the microphone is blocked', async () => {
    let stopped = null;
    await t.live.start('mic', 'en', { onStopped: (r) => (stopped = r) });
    t.rec.emit('error', { error: 'not-allowed' });
    assert.equal(stopped, 'blocked');
    assert.equal(t.live.active, false);
    assert.equal(t.rec.count('result'), 0);
  });

  it('stop() turns the mic off and does not restart', async () => {
    let stopped = null;
    await t.live.start('mic', 'en', { onStopped: (r) => (stopped = r) });
    t.live.stop();
    t.rec.emit('end');
    await wait(400);
    assert.equal(stopped, 'user');
    assert.equal(t.rec.starts.length, 1);
    assert.equal(t.rec.count('end'), 0);
    assert.equal(t.voice.onIdle, null);
  });

  it('changing language restarts recognition in the new language', async () => {
    await t.live.start('mic', 'en', {});
    const before = t.rec.aborts;
    t.live.setLanguage('hi');
    assert.equal(t.rec.aborts, before + 1);
    t.rec.emit('end');
    await wait(400);
    assert.equal(t.rec.starts.at(-1).lang, 'hi-IN');
  });
});
