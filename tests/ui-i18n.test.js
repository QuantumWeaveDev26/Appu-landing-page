const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I18n = require('../frontend/ui-i18n.js');

test('translates UI strings and keeps the numbers', () => {
  assert.equal(I18n.translate('Learning Missions', 'hi'), 'सीखने के मिशन');
  assert.equal(I18n.translate('Learning Missions', 'kn'), 'ಕಲಿಕೆಯ ಮಿಷನ್‌ಗಳು');
  assert.equal(I18n.translate('3 Days', 'hi'), '3 दिन');
  assert.equal(I18n.translate('120 / 150 XP', 'kn'), '120 / 150 XP');
  assert.equal(I18n.translate('Grade 9', 'kn'), 'ತರಗತಿ 9');
  assert.equal(I18n.translate('Something new', 'hi'), 'Something new');
});

test('every entry has a Hindi and a Kannada text with the same number slots', () => {
  for (const [key, [hi, kn]] of Object.entries(I18n.DICT)) {
    const slots = (key.match(/\{n\}/g) || []).length;
    assert.ok(hi && kn, key);
    assert.equal((hi.match(/\{n\}/g) || []).length, slots, `hi: ${key}`);
    assert.equal((kn.match(/\{n\}/g) || []).length, slots, `kn: ${key}`);
  }
});

test('language switch runs the translator, and the page loads it before app.js', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'app.js'), 'utf8');
  assert.match(app, /window\.AppuI18n\.apply\(lang\)/);
  const html = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'index.html'), 'utf8');
  assert.ok(html.indexOf('ui-i18n.js') > 0 && html.indexOf('ui-i18n.js') < html.indexOf('src="app.js'));
});
