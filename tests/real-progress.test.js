const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = f => fs.readFileSync(path.join(__dirname, '..', 'frontend', f), 'utf8');

test('progress starts at zero: no seeded streak, XP or badges', () => {
  const app = read('app.js');
  const block = app.slice(app.indexOf('function emptyGamificationState()'), app.indexOf('function calculateLevel(xp)'));
  assert.match(block, /xp: 0, streak: 0, bestStreak: 0/);
  assert.doesNotMatch(app, /: 120,\s*\n\s*streak: 3/);
  assert.doesNotMatch(app, /\['plant-detective', 'quick-thinker', 'curious-mind'\]/);
});

test('page markup has no hard-coded progress numbers or pre-unlocked badges', () => {
  const html = read('index.html');
  for (const id of ['game-streak-count', 'game-xp-count', 'drawer-streak-count', 'drawer-xp-count']) {
    assert.match(html, new RegExp(`id="${id}">0<`), id);
  }
  assert.doesNotMatch(html, /badge-item is-unlocked/);
});

test('every XP award names the activity it counts toward badges', () => {
  const lessons = read('lesson-card-renderer.js');
  assert.match(lessons, /awardXP\(20, 'Quiz Answer Correct! ⭐', 'quizCorrect'\)/);
  assert.match(lessons, /awardXP\(5, 'Flashcard Mastered! 🗂️', 'flashcards'\)/);
  assert.match(lessons, /awardXP\(20, 'Diagram Mastered! 🎯', 'diagrams'\)/);
  assert.match(read('chat-agent.js'), /recordActivity\('questions'\)/);
});
