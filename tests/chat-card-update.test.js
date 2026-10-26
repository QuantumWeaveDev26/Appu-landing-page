const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const js = fs.readFileSync(path.resolve(__dirname, '../frontend/chat-agent.js'), 'utf8');
const fn = js.slice(js.indexOf('updateLastAppuMessageCard(lessonCard) {'), js.indexOf('clearHistory() {'));

// The late Study Visualizer card must land on the chat answer. It once queried
// '.msg-row.appu-msg', which never matched the '.message-row' rows, so no mind map,
// quiz or flashcards appeared after the chat-first redesign removed the popup.
test('late lesson card re-renders the matching chat row with the normal renderer', () => {
  assert.doesNotMatch(fn, /msg-row/);
  assert.match(fn, /r\._appuMsg === lastAppu/);
  assert.match(fn, /this\.renderMessage\(lastAppu\)/);
  assert.match(fn, /lastRow\.replaceWith\(freshRow\)/);
  assert.match(js, /row\._appuMsg = msg;/);
});
