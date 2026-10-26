const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const agentSrc = fs.readFileSync(path.resolve(__dirname, '../frontend/chat-agent.js'), 'utf8');
const clientSrc = fs.readFileSync(path.resolve(__dirname, '../frontend/appu-backend-client.js'), 'utf8');

test('answers keep requestId/conversationId and save their lesson card', () => {
  assert.match(agentSrc, /requestId: result\.requestId \|\| null,\s*conversationId: result\.conversationId \|\| null/);
  assert.match(agentSrc, /if \(appuMsg\.lessonCard\) this\.persistLessonCard\(appuMsg\);/);
  const update = agentSrc.slice(agentSrc.indexOf('updateLastAppuMessageCard(lessonCard) {'));
  assert.match(update, /this\.persistLessonCard\(lastAppu\);/);
});

test('restored history messages carry their saved lesson card', () => {
  const restore = agentSrc.slice(agentSrc.indexOf('replaceMessages(messages = []) {'), agentSrc.indexOf('persistLessonCard(msg) {'));
  assert.match(restore, /lessonCard: m\.lessonCard \|\| null/);
});

test('backend client saves the card with PUT /lesson-card', () => {
  const fn = clientSrc.slice(clientSrc.indexOf('async function saveLessonCard('), clientSrc.indexOf('async function deleteConversation('));
  assert.match(fn, /\/lesson-card`/);
  assert.match(fn, /method: 'PUT'/);
  assert.match(clientSrc, /^\s*saveLessonCard,$/m);
});

test('persistLessonCard sends the card to the backend client for a signed-in learner', async () => {
  global.window = { AppuSession: { accessToken: 'tok', childId: 'child-1' }, AppuBackendClient: {} };
  let sent = null;
  window.AppuBackendClient.saveLessonCard = async (p) => { sent = p; return { success: true }; };
  global.document = { getElementById: () => null };
  delete require.cache[require.resolve('../frontend/chat-agent.js')];
  require('../frontend/chat-agent.js');
  const agent = Object.create(window.ChatAgent.prototype);
  agent.persistLessonCard({ lessonCard: { title: 'T', big: 'x'.repeat(60000) }, requestId: 'r1', conversationId: 'c1' });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(sent.requestId, 'r1');
  assert.equal(sent.conversationId, 'c1');
  assert.equal(sent.lessonCard.title, 'T');
  assert.equal(sent.lessonCard.big, undefined, 'oversized strings are dropped');
});
