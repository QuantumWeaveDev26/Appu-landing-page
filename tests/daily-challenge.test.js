const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createDaily, BANK, LABELS, GOAL, bandFor } = require('../frontend/daily-challenge.js');

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}
function make(opts = {}) {
  const clock = { t: new Date(opts.start || '2026-10-13T10:00:00') };
  const storage = opts.storage || memStorage();
  const ctx = { child: opts.child || 'child-1', grade: opts.grade || '6' };
  const daily = createDaily({
    storage,
    getChildId: () => ctx.child,
    getGrade: () => ctx.grade,
    now: () => clock.t
  });
  return { daily, clock, storage, ctx, nextDay: (n = 1) => { clock.t = new Date(clock.t.getFullYear(), clock.t.getMonth(), clock.t.getDate() + n, 10, 0, 0); } };
}

describe('AppuDaily streak', () => {
  test('a new child starts at zero, not a fake placeholder streak', () => {
    const { daily } = make();
    assert.equal(daily.getStreak(), 0);
    assert.deepEqual(daily.getProgress(), { count: 0, goal: GOAL, done: false, streak: 0 });
  });

  test('first question starts the streak at 1; more questions the same day do not inflate it', () => {
    const { daily } = make();
    assert.equal(daily.noteQuestion().streak, 1);
    assert.equal(daily.noteQuestion().streak, 1);
    assert.equal(daily.getStreak(), 1);
  });

  test('consecutive days grow the streak', () => {
    const { daily, nextDay } = make();
    daily.noteQuestion();
    nextDay(); assert.equal(daily.noteQuestion().streak, 2);
    nextDay(); assert.equal(daily.noteQuestion().streak, 3);
  });

  test('a missed day resets it, and the display drops to 0 before the next question', () => {
    const { daily, nextDay } = make();
    daily.noteQuestion(); nextDay(); daily.noteQuestion();
    assert.equal(daily.getStreak(), 2);
    nextDay(); assert.equal(daily.getStreak(), 2, 'yesterday still counts: it can be extended today');
    nextDay(); assert.equal(daily.getStreak(), 0, 'two days without a question breaks it');
    assert.equal(daily.noteQuestion().streak, 1);
  });

  test('streaks are per child', () => {
    const { daily, ctx } = make();
    daily.noteQuestion();
    ctx.child = 'child-2';
    assert.equal(daily.getStreak(), 0);
    daily.noteQuestion();
    ctx.child = 'child-1';
    assert.equal(daily.getStreak(), 1);
  });

  test('works without storage (private mode) and survives corrupt data', () => {
    const noStore = createDaily({ storage: null, now: () => new Date('2026-10-13T10:00:00') });
    assert.doesNotThrow(() => noStore.noteQuestion());
    const bad = memStorage();
    bad.setItem('appu_daily_v1:child-1', '{not json');
    const { daily } = make({ storage: bad });
    assert.equal(daily.getStreak(), 0);
    assert.equal(daily.noteQuestion().streak, 1);
  });
});

describe('AppuDaily challenge', () => {
  test('completes exactly once on the 3rd question of the day and awards the bonus once', () => {
    const { daily } = make();
    assert.equal(daily.noteQuestion().completed, false);
    assert.equal(daily.noteQuestion().completed, false);
    const third = daily.noteQuestion();
    assert.equal(third.completed, true);
    assert.equal(third.bonusXp, daily.BONUS_XP);
    const fourth = daily.noteQuestion();
    assert.equal(fourth.completed, false);
    assert.equal(fourth.bonusXp, 0);
    assert.equal(daily.getProgress().done, true);
  });

  test('progress resets the next day and can be completed again', () => {
    const { daily, nextDay } = make();
    for (let i = 0; i < 3; i++) daily.noteQuestion();
    nextDay();
    assert.deepEqual(daily.getProgress(), { count: 0, goal: GOAL, done: false, streak: 1 });
    daily.noteQuestion(); daily.noteQuestion();
    assert.equal(daily.noteQuestion().completed, true);
  });
});

describe('Question of the Day', () => {
  test('every question has English, Kannada and Hindi text; labels cover all three languages', () => {
    for (const band of Object.keys(BANK)) {
      assert.equal(BANK[band].length, 7, band);
      for (const q of BANK[band]) {
        for (const l of ['en', 'kn', 'hi']) assert.ok(q[l] && q[l].trim().length > 5, `${band} ${l}`);
      }
    }
    for (const l of ['en', 'kn', 'hi']) {
      assert.ok(LABELS[l].tag && LABELS[l].ask && LABELS[l].done);
      assert.match(LABELS[l].today(1, 3), /1/);
    }
  });

  test('grade bands map correctly and unknown grades fall back to the youngest band', () => {
    assert.equal(bandFor('Grade 5'), '5-7');
    assert.equal(bandFor('7'), '5-7');
    assert.equal(bandFor('Grade 8'), '8-10');
    assert.equal(bandFor(10), '8-10');
    assert.equal(bandFor('Grade 12'), '11-12');
    assert.equal(bandFor(null), '5-7');
  });

  test('same question all day, a different one tomorrow, and the learner language is used', () => {
    const { daily, nextDay, ctx } = make({ grade: 'Grade 9' });
    const a = daily.getQuestionOfTheDay('en');
    assert.equal(daily.getQuestionOfTheDay('en'), a);
    assert.ok(BANK['8-10'].some((q) => q.en === a));
    assert.ok(BANK['8-10'].some((q) => q.kn === daily.getQuestionOfTheDay('kn')));
    nextDay();
    assert.notEqual(daily.getQuestionOfTheDay('en'), a);
    ctx.grade = 'Grade 11';
    assert.ok(BANK['11-12'].some((q) => q.en === daily.getQuestionOfTheDay('en')));
  });
});

describe('Wiring', () => {
  const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  test('app counts one daily question per real send and reads the real streak', () => {
    const app = read('frontend/app.js');
    assert.match(app, /window\.AppuDaily\.afterQuestion\(\)/);
    assert.match(app, /streak: currentStreak\(\)/);
    assert.doesNotMatch(app, /streak: 3\b/, 'no hard-coded placeholder streak');
    assert.doesNotMatch(app, /xp: 120\b/, 'no hard-coded placeholder XP');
  });
  test('the page loads the module', () => {
    assert.match(read('frontend/index.html'), /<script src="daily-challenge\.js\?v=[\w-]+"><\/script>/);
  });
});
