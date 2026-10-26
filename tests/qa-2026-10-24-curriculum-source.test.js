// QA 2026-10-24 F02: a Class 8 answer showed "Source: NCERT Class 8 Science - Photosynthesis
// in Higher Plants", a Class 11 Biology chapter. Precise claims are now checked against the
// verified 2026-27 catalogue (frontend/curriculum-catalogue.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const Renderer = require('../frontend/lesson-card-renderer.js');
const Saved = require('../frontend/saved-lessons-ui.js');

test('the QA citation is not shown as a Class 8 source; it is qualified under its real class', () => {
  const d = Renderer.formatCitationDisplay('NCERT Class 8 Science - Photosynthesis in Higher Plants');
  assert.ok(d);
  assert.equal(d.verification, 'other-class');
  assert.equal(d.text, 'Related chapter: NCERT Class 11 Biology - Photosynthesis in Higher Plants');
  assert.doesNotMatch(d.text, /Class 8/);
  assert.match(d.url, /^https:\/\//);
});

test('a chapter that really is in the claimed class shows as a linked source', () => {
  const d = Renderer.formatCitationDisplay({ label: 'NCERT Class 8 Science - Exploring Forces' });
  assert.equal(d.verification, 'verified');
  assert.equal(d.text, 'Source: NCERT Class 8 Science - Exploring Forces');
  assert.match(d.url, /^https:\/\/ncert\.nic\.in\//);
  // Chapter-number prefixes and punctuation do not matter.
  assert.equal(Renderer.formatCitationDisplay('From NCERT Class 8 Science, Chapter 5: Exploring forces').verification, 'verified');
});

test('unverifiable precise claims are omitted rather than shown', () => {
  assert.equal(Renderer.formatCitationDisplay('NCERT Class 8 Science - Chapter 11'), null);
  assert.equal(Renderer.formatCitationDisplay('NCERT Class 7 Science - Nutrition in Animals'), null); // pre-2026 edition title
  assert.equal(Renderer.formatCitationDisplay({ class: 8, subject: 'Science', chapter: 'Made Up Chapter' }), null);
});

test('uploaded notes and non-curriculum labels are unchanged', () => {
  assert.equal(Renderer.formatCitationDisplay({ label: 'Your uploaded notes', source: 'upload' }).text, 'Your uploaded notes');
  assert.equal(Renderer.formatCitationDisplay('Interactive Learning').text, 'Source: Interactive Learning');
});

test('the WhatsApp share summary only carries a verified source line', () => {
  const unverified = Saved.formatLessonWhatsAppSummary({ topic: 'Photosynthesis', plainText: 'Plants make food.', citation: 'NCERT Class 8 Science - Photosynthesis in Higher Plants' });
  assert.doesNotMatch(unverified, /Class 8 Science - Photosynthesis/);
  const verified = Saved.formatLessonWhatsAppSummary({ topic: 'Forces', plainText: 'A push or pull.', citation: 'NCERT Class 8 Science - Exploring Forces' });
  assert.match(verified, /Source:\* NCERT Class 8 Science - Exploring Forces/);
});
