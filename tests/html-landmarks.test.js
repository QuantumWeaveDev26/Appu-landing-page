const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '../frontend/index.html'), 'utf8');
const count = (re) => (html.match(re) || []).length;

// A stray </section> in place of </main> once broke the app layout and hid the ask box.
test('index.html opens and closes exactly one <main>', () => {
  assert.equal(count(/<main[\s>]/g), 1);
  assert.equal(count(/<\/main>/g), 1);
});

test('index.html has balanced <section> tags', () => {
  assert.equal(count(/<section[\s>]/g), count(/<\/section>/g));
});
