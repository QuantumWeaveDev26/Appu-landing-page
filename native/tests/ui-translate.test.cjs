const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/load.cjs');

const { translateUi } = load('i18n/uiTranslate.ts');
const web = require('../src/i18n/uiDict.json');
const app = require('../src/i18n/uiExtra.json');

describe('UI translation (en / hi / kn)', () => {
  it('leaves English untouched', () => {
    assert.equal(translateUi('New chat', 'en'), 'New chat');
  });

  it('translates sidebar labels shared with the website', () => {
    assert.equal(translateUi('New chat', 'hi'), web['New chat'][0]);
    assert.equal(translateUi('Recent chats', 'kn'), web['Recent chats'][1]);
    assert.equal(translateUi('Parent Zone', 'hi'), web['Parent Zone'][0]);
  });

  it('keeps leading and trailing icons', () => {
    assert.equal(translateUi('‹ Back', 'hi'), '‹ वापस');
    assert.equal(translateUi('Take the quiz ⚡', 'kn'), 'ಕ್ವಿಜ್ ಬರೆ ⚡');
    assert.equal(translateUi('🎉 Quiz complete', 'hi'), '🎉 क्विज़ पूरा');
  });

  it('keeps the numbers inside a phrase', () => {
    assert.equal(translateUi('Card 2 of 4 · 1 mastered', 'hi'), 'कार्ड 2 / 4 · 1 याद हुए');
    assert.equal(translateUi('3 free chats left', 'kn'), '3 ಉಚಿತ ಚಾಟ್‌ಗಳು ಉಳಿದಿವೆ');
    assert.equal(translateUi('📞 Voice call ended · 1:05', 'hi'), '📞 वॉइस कॉल ख़त्म · 1:05');
  });

  it('keeps sentence punctuation inside the phrase', () => {
    assert.equal(translateUi("Hi! I'm Appu.", 'hi'), 'नमस्ते! मैं अप्पू हूँ।');
  });

  it('leaves unknown text (e.g. lesson content) in its own words', () => {
    assert.equal(translateUi('Photosynthesis is how plants make food', 'hi'), 'Photosynthesis is how plants make food');
  });

  it('every app phrase has both Hindi and Kannada, with the same {n} slots', () => {
    for (const [key, [hi, kn]] of Object.entries(app)) {
      assert.ok(hi && kn, `missing translation for "${key}"`);
      const slots = (key.match(/\{n\}/g) || []).length;
      assert.equal((hi.match(/\{n\}/g) || []).length, slots, `hi slots for "${key}"`);
      assert.equal((kn.match(/\{n\}/g) || []).length, slots, `kn slots for "${key}"`);
      assert.match(hi, /[ऀ-ॿ]/, `Hindi should be Devanagari: "${key}"`);
      assert.match(kn, /[ಀ-೿]/, `Kannada should be Kannada script: "${key}"`);
    }
  });

  it('covers the main menu, lesson tabs and call screen', () => {
    const all = { ...web, ...app };
    for (const key of [
      'New chat', 'Recent chats', 'My Learning', 'My Progress', 'Learning missions', 'Explore prompts',
      'Parent Zone', 'Child Progress Report', 'Study reminders', 'Settings', 'Language', 'Sound effects',
      'Read answers aloud', 'Light mode', 'Take the tour', 'Sign in', 'Sign out',
      'Lesson', 'Quiz', 'Flashcards', 'Diagram', 'Study guide', 'Podcast',
      'Listening…', 'Thinking…', 'Appu is speaking', 'End call', 'Voice call with Appu',
      'What shall we learn today?', 'Ask Appu anything…', 'Save lesson', 'Listen', 'Share',
    ]) {
      assert.ok(all[key], `no translation for "${key}"`);
    }
  });
});
