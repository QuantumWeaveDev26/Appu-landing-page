const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load, SRC_DIR } = require('./helpers/load.cjs');

function setup(auth) {
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, method: opts.method, auth: opts.headers.Authorization, body: opts.body ? JSON.parse(opts.body) : null });
    return { ok: true, json: async () => ({ consent: { granted: true } }) };
  };
  const mod = load('lib/learning.ts', {
    '../config': { config: { apiBaseUrl: 'https://api.test' } },
    '../stores/authStore': { useAuthStore: { getState: () => auth } },
  });
  return { mod, calls };
}

const SIGNED_IN = { session: { access_token: 'tok' }, activeChildId: 'kid-1', isGuest: false };

describe('Learning sync (app → learner model)', () => {
  it('sends quiz answers and opened tabs for the active child in one batch', async () => {
    const { mod, calls } = setup(SIGNED_IN);
    mod.reportLearning({ source: 'lesson_quiz', topic: ' Photosynthesis ', isCorrect: false, question: 'What do leaves need?' });
    mod.reportLearning({ source: 'mode_open', topic: 'Photosynthesis', mode: 'see' });
    await mod.flushLearning();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.test/api/appu/learning/events');
    assert.equal(calls[0].auth, 'Bearer tok');
    assert.equal(calls[0].body.childId, 'kid-1');
    assert.deepEqual(calls[0].body.events.map((e) => [e.source, e.topic, e.isCorrect, e.mode]), [
      ['lesson_quiz', 'Photosynthesis', false, undefined],
      ['mode_open', 'Photosynthesis', undefined, 'see'],
    ]);
  });

  it('guests and empty topics send nothing', async () => {
    const { mod, calls } = setup({ session: null, activeChildId: null, isGuest: true });
    mod.reportLearning({ source: 'lesson_quiz', topic: 'Fractions', isCorrect: true });
    await mod.flushLearning();
    const signed = setup(SIGNED_IN);
    signed.mod.reportLearning({ source: 'lesson_quiz', topic: '   ', isCorrect: true });
    await signed.mod.flushLearning();
    assert.equal(calls.length + signed.calls.length, 0);
  });

  it('the Parent Zone reads and changes consent', async () => {
    const { mod, calls } = setup(SIGNED_IN);
    assert.equal(await mod.setLearningConsent('kid-1', true), true);
    await mod.getLearningProfile('kid-1');
    assert.deepEqual(calls.map((c) => [c.method, c.url]), [
      ['PUT', 'https://api.test/api/children/kid-1/learning-consent'],
      ['GET', 'https://api.test/api/children/kid-1/learning'],
    ]);
    assert.deepEqual(calls[0].body, { granted: true });
  });

  it('lesson tabs, quiz answers and the parent switch are wired up', () => {
    const views = fs.readFileSync(path.join(SRC_DIR, 'lessons/LessonViews.tsx'), 'utf8');
    const parent = fs.readFileSync(path.join(SRC_DIR, 'screens/ParentZoneScreen.tsx'), 'utf8');
    assert.match(views, /reportLearning\(\{ source: 'mode_open', topic: lesson\.topic, mode: LEARNING_MODE\[m\] \}\)/);
    assert.match(views, /reportLearning\(\{ source: 'lesson_quiz', topic: lesson\.topic, isCorrect, question: q\.question \}\)/);
    assert.match(parent, /await setLearningConsent\(persChild\.id, learningConsent\)/);
    assert.match(parent, /value=\{learningConsent\}/);
    assert.match(parent, /useState\(true\)/);
    assert.match(parent, /setLearningConsentState\(!p \|\| p\.consent\.granted \|\| !p\.consent\.decided\)/);
  });
});
