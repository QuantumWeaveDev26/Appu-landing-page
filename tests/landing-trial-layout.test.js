const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const js = fs.readFileSync(path.resolve(__dirname, '../frontend/landing-page.js'), 'utf8');
const css = fs.readFileSync(path.resolve(__dirname, '../frontend/landing-page.css'), 'utf8');

test('landing answers render above the question bar', () => {
  const body = js.slice(js.indexOf('ensureTrialConvo() {'), js.indexOf('openSignIn() {'));
  assert.match(body, /form\.parentNode\.insertBefore\(convo, form\)/);
});

test('question bar stays pinned below the answers', () => {
  assert.match(css, /\.has-trial \.landing-question-box \{[^}]*position: sticky;[^}]*bottom: 12px;/);
});

test('landing answers show only the concept mind map, not the full lesson card', () => {
  const body = js.slice(js.indexOf('answerInline(query) {'), js.indexOf('enterApp(question'));
  assert.match(body, /cardEl\.querySelector\('\.concept-tree-wrapper'\)/);
  assert.doesNotMatch(body, /answerSlot\.appendChild\(cardEl\)/);
});

test('landing mic is a live conversation: it listens again after Appu finishes speaking', () => {
  assert.match(js, /resumeLiveVoice\(\) \{[\s\S]*?ve\.isSpeaking[\s\S]*?this\.startListening\(\)/);
  const answer = js.slice(js.indexOf('answerInline(query) {'), js.indexOf('enterApp(question'));
  assert.match(answer, /\.then\(\(\) => self\.resumeLiveVoice\(\)/);
  assert.match(js, /showTrialGate\(\) \{\s*if \(this\.liveVoice\) this\.stopLiveVoice\(\);/);
});
