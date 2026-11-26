const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FRONTEND = path.join(__dirname, '../frontend');
const read = (f) => fs.readFileSync(path.join(FRONTEND, f), 'utf8');

/** Runs learning-sync.js in a fake browser window; returns the window and the fetch calls. */
function loadSync({ signedIn = true, parentToken = null } = {}) {
  const calls = [];
  const listeners = {};
  const win = {
    APPU_CONFIG: { apiBaseUrl: 'https://api.test/' },
    AppuSession: signedIn
      ? { isAuthenticated: () => true, accessToken: 'tok', childId: 'child-1' }
      : { isAuthenticated: () => false },
    ParentOnboardingShell: parentToken ? { state: { session: { access_token: parentToken } } } : undefined,
    addEventListener: (name, fn) => { listeners[name] = fn; },
    fetch: async (url, opts) => {
      calls.push({ url, method: opts.method, auth: opts.headers.Authorization, body: opts.body ? JSON.parse(opts.body) : null });
      return { ok: true, json: async () => ({ consent: { granted: true } }) };
    },
    setTimeout: (fn) => { win._pending = fn; return 1; },
    JSON, String, Boolean, encodeURIComponent
  };
  win.window = win;
  vm.runInNewContext(read('learning-sync.js'), { window: win, globalThis: win, fetch: win.fetch, setTimeout: win.setTimeout, module: undefined });
  const emit = (detail) => listeners['appu:learning']({ detail });
  const tick = async () => { const fn = win._pending; win._pending = null; if (fn) await fn(); };
  return { win, calls, emit, tick };
}

describe('Learning sync (website → learner model)', () => {
  test('quiz answers and opened lesson modes are batched to the backend for the active child', async () => {
    const { calls, emit, tick } = loadSync();
    emit({ source: 'lesson_quiz', topic: ' Fractions ', isCorrect: false, question: 'What is 1/2 + 1/4?' });
    emit({ source: 'mode_open', topic: 'Fractions', mode: 'see' });
    assert.equal(calls.length, 0, 'waits briefly to send one batch');
    await tick();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.test/api/appu/learning/events');
    assert.equal(calls[0].auth, 'Bearer tok');
    assert.deepEqual(calls[0].body, {
      childId: 'child-1',
      events: [
        { source: 'lesson_quiz', topic: 'Fractions', isCorrect: false, question: 'What is 1/2 + 1/4?' },
        { source: 'mode_open', topic: 'Fractions', mode: 'see' }
      ]
    });
  });

  test('nothing is sent for guests, or for events without a topic or with an unknown source', async () => {
    const guest = loadSync({ signedIn: false });
    guest.emit({ source: 'lesson_quiz', topic: 'Fractions', isCorrect: true });
    await guest.tick();
    assert.equal(guest.calls.length, 0);

    const s = loadSync();
    s.emit({ source: 'lesson_quiz', topic: '', isCorrect: true });
    s.emit({ source: 'chat_quiz', topic: 'Fractions', isCorrect: true }); // chat quizzes are graded by the server itself
    await s.tick();
    assert.equal(s.calls.length, 0);
  });

  test('the Parent Zone can read and change consent with the parent sign-in', async () => {
    const { win, calls } = loadSync({ signedIn: false, parentToken: 'parent-tok' });
    await win.AppuLearning.setConsent(true, 'kid-9');
    await win.AppuLearning.getProfile('kid-9');
    assert.deepEqual(calls.map((c) => [c.method, c.url, c.auth]), [
      ['PUT', 'https://api.test/api/children/kid-9/learning-consent', 'Bearer parent-tok'],
      ['GET', 'https://api.test/api/children/kid-9/learning', 'Bearer parent-tok']
    ]);
    assert.deepEqual(calls[0].body, { granted: true });
  });
});

describe('Learning hooks in the website', () => {
  const renderer = read('lesson-card-renderer.js');
  const html = read('index.html');
  const setup = read('parent-setup-ui.js');

  test('lesson quiz answers and opened study modes are reported', () => {
    assert.match(renderer, /emitLearning\(\{ source: 'lesson_quiz', topic: options\.learningTopic, isCorrect, question: q\.question \}\)/);
    assert.match(renderer, /emitLearning\(\{ source: 'mode_open', topic: learningTopic, mode: LEARNING_MODES\[modeName\] \}\)/);
  });

  test('learning-sync loads before the lesson renderer, and the parent consent box is wired', () => {
    assert.ok(html.indexOf('learning-sync.js') > 0 && html.indexOf('learning-sync.js') < html.indexOf('lesson-card-renderer.js'));
    assert.match(html, /id="pos-learning-consent" type="checkbox"/);
    assert.match(setup, /AppuLearning\.setConsent\(learningConsentEl\.checked, child\.id\)/);
    assert.match(setup, /AppuLearning\.getProfile\(child\.id\)/);
    assert.match(html, /id="pos-learning-consent" type="checkbox" checked>/, 'ticked by default');
    assert.match(setup, /learningConsentEl\.checked = !c \|\| Boolean\(c\.granted\) \|\| !c\.decided;/, 'a saved "no" stays unticked');
  });
});
