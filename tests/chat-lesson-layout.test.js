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
