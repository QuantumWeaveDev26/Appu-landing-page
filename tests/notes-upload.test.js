const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../frontend/app.js'), 'utf8');

function functionBody(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(open, i + 1);
  }
  throw new Error(`unbalanced ${name}`);
}

test('picking the same notes file again still triggers an upload', () => {
  // Without clearing the input before the dialog opens, re-selecting the same file fires
  // no change event and the upload silently does nothing.
  assert.match(source, /notesFileInput\.addEventListener\('click',[\s\S]{0,80}notesFileInput\.value = ''/);
});

test('a PDF that cannot be parsed is never sent as raw bytes', () => {
  const body = functionBody('extractTextFromPdfFile');
  assert.doesNotMatch(body, /await file\.text\(\)/);
  assert.match(body, /return null;/);
});

test('unsupported, oversized and stale file picks are rejected', () => {
  const body = functionBody('processSelectedFile');
  assert.match(body, /!isPdf && !isText/);
  assert.match(body, /file\.size > NOTES_MAX_BYTES/);
  assert.match(source, /const NOTES_MAX_BYTES = 10 \* 1024 \* 1024;/);
  assert.match(body, /if \(seq !== notesFileSeq\) return;/);
});

test('a scanned PDF gets a clear paste-the-text message', () => {
  assert.match(functionBody('processSelectedFile'), /may be a scan or photo/);
});
