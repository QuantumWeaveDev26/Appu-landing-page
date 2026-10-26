const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.resolve(__dirname, '../frontend/style.css'), 'utf8');
const renderer = fs.readFileSync(path.resolve(__dirname, '../frontend/lesson-card-renderer.js'), 'utf8');

// .msg-bubble is pre-wrap for plain answers; lesson cards inherited it and every
// template newline became an empty line inside the cards.
test('lesson cards in chat reset white-space to normal', () => {
  assert.match(css, /#chat-messages \.msg-study-body,\s*#chat-messages \.appu-lesson-card,[\s\S]*?\{\s*white-space: normal;/);
});

test('lesson cards in chat use one full-width column', () => {
  assert.match(css, /body\.chat-first #chat-messages \.appu-lesson-card \{\s*display: flex;\s*flex-direction: column;/);
});

test('mind map without a title never shows the sample photosynthesis wording', () => {
  const fn = renderer.slice(renderer.indexOf("container.className = 'appu-study-card study-mode-mindmap';"), renderer.indexOf('let central = mapData.central || title;'));
  assert.doesNotMatch(fn, /Photosynthesis Concept Map|Trace inputs, cellular/);
});

test('whole response area right of the menu is notebook paper with spiral rings', () => {
  const blk = css.slice(css.indexOf('/* ===== Notebook paper behind the whole response area'));
  // Paper lives on the page canvas, pinned to the screen, so it never ends partway while scrolling.
  assert.match(css, /html:has\(body\.view-app\.chat-first\) \{[\s\S]*?28px 28px fixed,[\s\S]*?#0e192d !important;/);
  assert.ok(!blk.includes('body.chat-first #app-shell {'), 'the shell must not paint its own (scrolling) paper');
  assert.ok(blk.includes('body.chat-first #app-shell::before {') && blk.includes('data:image/svg+xml'), 'spiral rings');
  // The old chat-first reset must no longer hide the shell background or its ::before.
  assert.ok(!css.includes('body.chat-first .app-shell::before,'), 'rings are not hidden');
});
