const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { load, fakeAsyncStorage, atTime } = require('./helpers/load.cjs');

function freshStore(initial) {
  const storage = fakeAsyncStorage(initial);
  const mod = load('stores/progressStore.ts', { '@react-native-async-storage/async-storage': storage });
  return { ...mod, storage, s: () => mod.useProgressStore.getState() };
}

describe('Real progress (XP, streak, level, badges)', () => {
  it('starts everyone at zero — no fake numbers', async () => {
    const { s } = freshStore();
    await s().load();
    assert.equal(s().xp, 0);
    assert.equal(s().streak, 0);
    assert.deepEqual(s().badges, []);
  });

  it('a first question starts the streak and unlocks Curious Mind', async () => {
    const { s } = freshStore();
    await s().load();
    await atTime('2026-11-25T10:00:00', () => s().record('questions'));
    assert.equal(s().streak, 1);
    assert.equal(s().stats.questions, 1);
    assert.deepEqual(s().badges, ['curious-mind']);
    assert.match(s().toast.text, /Curious Mind/);
  });

  it('awards XP for quiz answers and shows a +XP toast', async () => {
    const { s } = freshStore();
    await s().load();
    await atTime('2026-11-25T10:00:00', () => s().record('quizCorrect', 20, 'Quiz answer correct!'));
    assert.equal(s().xp, 20);
    assert.match(s().toast.text, /\+20 XP/);
  });

  it('levels up at 50 XP', async () => {
    const { s, levelFor } = freshStore();
    await s().load();
    await atTime('2026-11-25T10:00:00', () => {
      s().record('quizCorrect', 20);
      s().record('quizCorrect', 20);
      s().record('quizCorrect', 20);
    });
    assert.equal(s().xp, 60);
    assert.equal(levelFor(s().xp).level, 2);
    assert.ok(s().badges.includes('quick-thinker'));
  });

  it('counts a day only once, grows on the next day, and resets after a missed day', async () => {
    const { s } = freshStore();
    await s().load();
    await atTime('2026-11-25T09:00:00', () => s().record('questions'));
    await atTime('2026-11-25T20:00:00', () => s().record('questions'));
    assert.equal(s().streak, 1);
    await atTime('2026-11-26T08:00:00', () => s().record('questions'));
    assert.equal(s().streak, 2);
    await atTime('2026-11-29T08:00:00', () => s().record('questions'));
    assert.equal(s().streak, 1);
    assert.equal(s().bestStreak, 2);
  });

  it('three days in a row earns On Fire', async () => {
    const { s } = freshStore();
    await s().load();
    for (const day of ['2026-11-24', '2026-11-25', '2026-11-26']) {
      await atTime(`${day}T10:00:00`, () => s().record('questions'));
    }
    assert.ok(s().badges.includes('on-fire'));
  });

  it('saves progress and shows a broken streak as 0 when the app reopens days later', async () => {
    const first = freshStore();
    await first.s().load();
    await atTime('2026-11-20T10:00:00', () => first.s().record('flashcards', 5));
    await new Promise((r) => setTimeout(r, 0));
    const saved = Object.fromEntries(first.storage.data);
    const second = freshStore(saved);
    await atTime('2026-11-25T10:00:00', () => second.s().load());
    assert.equal(second.s().xp, 5);
    assert.equal(second.s().stats.flashcards, 1);
    assert.equal(second.s().streak, 0);
  });

  it('badge rules match the website (7 badges)', () => {
    const { BADGE_RULES } = freshStore();
    assert.deepEqual(BADGE_RULES.map((b) => b.id), [
      'curious-mind', 'space-cadet', 'quick-thinker', 'diagram-detective', 'flashcard-pro', 'on-fire', 'week-warrior',
    ]);
  });
});
