// QA 2026-10-24 F09: a slow Notes Tutor call timed out and silently retried behind a
// generic "Working it out" state with no cancel/retry path.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Renderer = require('../frontend/lesson-card-renderer.js');

function stubFetch(behaviours) {
  const calls = [];
  const original = global.fetch;
  global.fetch = (url, opts) => {
    const next = behaviours[Math.min(calls.length, behaviours.length - 1)];
    calls.push(opts);
    if (next === 'hang') {
      return new Promise((_, reject) => opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    }
    return Promise.resolve({ ok: true, json: async () => ({ answer: 'Area = 7 m x 4 m = 28 m2.' }) });
  };
  return { calls, restore: () => { global.fetch = original; } };
}

test('a timed-out first attempt is retried once, reported to the UI, and the answer is used once', async () => {
  const f = stubFetch(['hang', 'ok']);
  const retries = [];
  try {
    const res = await Renderer.fetchNotesTutor({ question: 'Area?', documentText: 'A 7 m by 4 m rectangle.', timeoutMs: 30, onRetry: (a, t) => retries.push([a, t]) });
    assert.equal(res.answer, 'Area = 7 m x 4 m = 28 m2.');
    assert.deepEqual(retries, [[2, 2]]);
    assert.equal(f.calls.length, 2);
  } finally { f.restore(); }
});

test('retries are bounded: two hanging attempts end in null, not a loop', async () => {
  const f = stubFetch(['hang']);
  try {
    const res = await Renderer.fetchNotesTutor({ question: 'Area?', documentText: 'notes', timeoutMs: 20 });
    assert.equal(res, null);
    assert.equal(f.calls.length, 2);
  } finally { f.restore(); }
});

test('Cancel stops the request immediately and makes no further attempt', async () => {
  const f = stubFetch(['hang']);
  const controller = new AbortController();
  try {
    const pending = Renderer.fetchNotesTutor({ question: 'Area?', documentText: 'notes', timeoutMs: 5000, signal: controller.signal });
    setTimeout(() => controller.abort(), 20);
    assert.deepEqual(await pending, { cancelled: true });
    assert.equal(f.calls.length, 1);
  } finally { f.restore(); }
});

test('the notes lesson shows status, Cancel and Try again, keeping the document and question', () => {
  const app = fs.readFileSync(path.resolve(__dirname, '../frontend/app.js'), 'utf8');
  assert.match(app, /const retryNotes = \(\) => handleUserInteraction\(rawQuestion\);/);
  assert.match(app, /signal: notesAbort \? notesAbort\.signal : null,/);
  assert.match(app, /trying once more \(attempt \$\{attempt\} of \$\{total\}\)/);
  assert.match(app, /showNotesStatus\('Stopped\. Your notes are still loaded/);
  assert.match(app, /showNotesStatus\('Your notes are still loaded\.', \{ retry: retryNotes \}\);/);
});
