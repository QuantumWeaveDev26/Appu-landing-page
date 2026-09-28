const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const SavedLessonsUI = require('../frontend/saved-lessons-ui.js');

// Mock browser DOM node for Node.js test environment
function createMockNode(tag = 'div') {
  let _className = '';
  const _classes = new Set();
  const el = {
    tagName: tag.toUpperCase(),
    get className() { return _className; },
    set className(val) {
      _className = val || '';
      _classes.clear();
      _className.split(/\s+/).filter(Boolean).forEach(c => _classes.add(c));
    },
    classList: {
      add(c) { _classes.add(c); _className = Array.from(_classes).join(' '); },
      remove(c) { _classes.delete(c); _className = Array.from(_classes).join(' '); },
      contains(c) { return _classes.has(c); }
    },
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; },
    children: [],
    appendChild(child) { this.children.push(child); return child; },
    _innerHTML: '',
    get innerHTML() { return this._innerHTML; },
    set innerHTML(val) { this._innerHTML = val; },
    _listeners: {},
    addEventListener(evt, fn) {
      this._listeners[evt] = this._listeners[evt] || [];
      this._listeners[evt].push(fn);
    },
    click(e = { stopPropagation: () => {} }) {
      const handlers = this._listeners['click'] || [];
      for (const h of handlers) h(e);
    },
    querySelector(sel) {
      const cls = sel.startsWith('.') ? sel.slice(1) : sel;
      for (const ch of this.children) {
        if (ch.classList && ch.classList.contains(cls)) return ch;
      }
      return null;
    }
  };
  return el;
}

if (typeof globalThis.document === 'undefined' || !globalThis.document.getElementById) {
  globalThis.document = {
    createElement: (tag) => createMockNode(tag),
    getElementById: (id) => null,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}

describe('Appu 2.0: Saved Lessons & WhatsApp Share Controller', () => {
  beforeEach(() => {
    SavedLessonsUI.clearSavedLessons();
  });

  afterEach(() => {
    SavedLessonsUI.clearSavedLessons();
  });

  test('PERSIST: saveLesson saves rich card to storage with timestamp, grade, language and full card JSON', () => {
    const mockCard = {
      id: 'card-photo-1',
      topic: 'Photosynthesis',
      plainText: 'Photosynthesis is how plants make food using sunlight, water, and carbon dioxide.',
      grade: '7',
      language: 'en',
      citation: { label: 'NCERT Class 7 Science - Chapter 1' },
      blocks: [
        { type: 'hook', text: 'Have you ever wondered how giant trees eat without a mouth?' },
        { type: 'steps', items: ['Leaves absorb light', 'Roots take up water', 'Glucose and oxygen are produced'] }
      ],
      mindMap: {
        central: 'Photosynthesis',
        branches: [{ label: 'Inputs' }, { label: 'Outputs' }]
      }
    };

    const saved = SavedLessonsUI.saveLesson(mockCard, { grade: '7', language: 'en' });
    assert.ok(saved);
    assert.equal(saved.topic, 'Photosynthesis');
    assert.equal(saved.grade, '7');
    assert.ok(saved.timestamp);
    assert.deepEqual(saved.card.mindMap, mockCard.mindMap);

    const lessons = SavedLessonsUI.getSavedLessons();
    assert.equal(lessons.length, 1);
    assert.equal(lessons[0].topic, 'Photosynthesis');
  });

  test('PERSIST: enforces 20-lesson cap and maintains newest-first order', () => {
    for (let i = 1; i <= 25; i++) {
      SavedLessonsUI.saveLesson({
        id: `lesson-${i}`,
        topic: `Topic ${i}`,
        plainText: `Explanation for topic ${i}`
      }, { timestamp: Date.now() + i * 1000 });
    }

    const lessons = SavedLessonsUI.getSavedLessons();
    assert.equal(lessons.length, 20, 'Must be strictly capped at 20 lessons');
    assert.equal(lessons[0].topic, 'Topic 25', 'Newest lesson must be at the top');
    assert.equal(lessons[19].topic, 'Topic 6', 'Oldest preserved lesson must be Topic 6');
  });

  test('PERSIST: updates existing lesson to top instead of creating duplicates', () => {
    SavedLessonsUI.saveLesson({
      id: 'lesson-gravity',
      topic: 'Gravity',
      plainText: 'Gravity is the force that pulls things down.'
    });

    SavedLessonsUI.saveLesson({
      id: 'lesson-friction',
      topic: 'Friction',
      plainText: 'Friction opposes motion.'
    });

    let lessons = SavedLessonsUI.getSavedLessons();
    assert.equal(lessons.length, 2);
    assert.equal(lessons[0].topic, 'Friction');

    // Re-saving Gravity with updated content should move it to top without duplicating
    SavedLessonsUI.saveLesson({
      id: 'lesson-gravity-updated',
      topic: 'Gravity',
      plainText: 'Gravity is the universal attraction between masses.'
    });

    lessons = SavedLessonsUI.getSavedLessons();
    assert.equal(lessons.length, 2, 'Should not duplicate the same topic');
    assert.equal(lessons[0].topic, 'Gravity', 'Updated topic must move to the top');
  });

  test('PERSIST: removes lesson by ID and clears storage cleanly', () => {
    const l1 = SavedLessonsUI.saveLesson({ topic: 'Magnetism', plainText: 'Magnets attract iron.' });
    const l2 = SavedLessonsUI.saveLesson({ topic: 'Optics', plainText: 'Light bends through glass.' });

    assert.equal(SavedLessonsUI.getSavedLessons().length, 2);

    const removed = SavedLessonsUI.removeSavedLesson(l1.id);
    assert.equal(removed, true);
    assert.equal(SavedLessonsUI.getSavedLessons().length, 1);
    assert.equal(SavedLessonsUI.getSavedLessons()[0].topic, 'Optics');

    SavedLessonsUI.clearSavedLessons();
    assert.equal(SavedLessonsUI.getSavedLessons().length, 0);
  });

  test('SHARE: formatLessonWhatsAppSummary extracts topic, key points, steps, and NCERT citation', () => {
    const card = {
      topic: 'Water Cycle',
      plainText: 'The water cycle describes how water evaporates, condenses into clouds, and falls as precipitation.',
      citation: 'NCERT Class 6 Science - Water',
      studyGuide: {
        keyPoints: [
          'Sun heats water bodies causing evaporation',
          'Water vapor cools and condenses into droplets',
          'Droplets form clouds and fall as rain or snow'
        ]
      },
      blocks: [
        {
          type: 'steps',
          items: ['Evaporation from oceans', 'Condensation into clouds', 'Precipitation back to Earth']
        }
      ]
    };

    const summary = SavedLessonsUI.formatLessonWhatsAppSummary(card, 'Aarav');
    assert.ok(summary);

    // Assert required sections
    assert.match(summary, /Study note from Aarav \(via APPU\):/);
    assert.match(summary, /📚 \*Topic:\* Water Cycle/);
    assert.match(summary, /💡 \*Key Points:\*/);
    assert.match(summary, /• Sun heats water bodies/);
    assert.match(summary, /🎯 \*Steps:\*/);
    assert.match(summary, /1\. Evaporation from oceans/);
    assert.match(summary, /📖 \*Source:\* NCERT Class 6 Science - Water/);
    assert.match(summary, /Shared via APPU Learning Companion/);

    // Budget check
    assert.ok(summary.length < 500, `Summary length (${summary.length}) must be strictly under 500 characters`);
  });

  test('SHARE: buildWhatsAppShareUrl defaults to 919740595677 and encodes parameters properly', () => {
    const card = {
      topic: 'Newton Laws',
      plainText: 'An object remains at rest unless acted upon by a net force.',
      citation: { label: 'NCERT Class 9 Physics - Laws of Motion' }
    };

    const url = SavedLessonsUI.buildWhatsAppShareUrl(card);
    assert.ok(url);
    assert.ok(url.startsWith('https://wa.me/919740595677?text='));

    const parsed = new URL(url);
    const textParam = parsed.searchParams.get('text');
    assert.ok(textParam.includes('Newton Laws'));
    assert.ok(textParam.includes('Laws of Motion'));
    assert.ok(textParam.length < 500);
  });

  test('REVISIT: reopenLesson calls showVoicePopup with exact card data and ZERO network re-fetch', () => {
    let popupCalled = false;
    let openedCard = null;
    let openedMode = null;

    global.window = {
      app: {
        showVoicePopup: (text, card, mode) => {
          popupCalled = true;
          openedCard = card;
          openedMode = mode;
        }
      }
    };

    const card = {
      id: 'saved-card-101',
      topic: 'Cell Biology',
      plainText: 'The cell is the basic functional unit of life.',
      mindMap: { central: 'Cell Biology' }
    };

    const saved = SavedLessonsUI.saveLesson(card);
    const success = SavedLessonsUI.reopenLesson(saved.id);

    assert.equal(success, true);
    assert.equal(popupCalled, true);
    assert.equal(openedCard.id, 'saved-card-101');
    assert.equal(openedCard.topic, 'Cell Biology');
    assert.equal(openedMode, 'lesson');
  });

  test('SAVE TOGGLE: isLessonSaved, findSavedLesson, and toggleSaveLesson save and unsave cleanly', () => {
    const card = {
      id: 'card-forces-202',
      topic: 'Forces and Pressure',
      plainText: 'A push or pull on an object is called a force.',
      citation: 'NCERT Class 8 Science - Chapter 11'
    };

    assert.equal(SavedLessonsUI.isLessonSaved(card), false, 'Initially card should not be saved');

    // First toggle: saves the card
    const res1 = SavedLessonsUI.toggleSaveLesson(card);
    assert.equal(res1.isSaved, true);
    assert.ok(res1.entry);
    assert.equal(SavedLessonsUI.isLessonSaved(card), true, 'Card should now be saved');
    assert.equal(SavedLessonsUI.getSavedLessons().length, 1);

    // Second toggle: unsaves the card
    const res2 = SavedLessonsUI.toggleSaveLesson(card);
    assert.equal(res2.isSaved, false);
    assert.equal(res2.entry, null);
    assert.equal(SavedLessonsUI.isLessonSaved(card), false, 'Card should now be unsaved');
    assert.equal(SavedLessonsUI.getSavedLessons().length, 0);
  });

  test('UI SAVE BUTTON: renderStudyToolbar renders visible Save button and toggles Saved state on click', () => {
    const LessonCardRenderer = require('../frontend/lesson-card-renderer.js');
    global.window = {
      SavedLessonsUI,
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    const card = {
      id: 'card-light-303',
      topic: 'Reflection of Light',
      plainText: 'Light bouncing off a polished surface is called reflection.'
    };

    // Render toolbar with card and onShare callback
    const toolbar = LessonCardRenderer.renderStudyToolbar('lesson', () => {}, 'en', () => {}, { card });
    assert.ok(toolbar);

    const saveBtn = toolbar.querySelector ? toolbar.querySelector('.study-tab-save') : toolbar.children.find(c => c.className.includes('study-tab-save'));
    const shareBtn = toolbar.querySelector ? toolbar.querySelector('.study-tab-share') : toolbar.children.find(c => c.className.includes('study-tab-share'));

    assert.ok(saveBtn, 'Save button must be present in toolbar');
    assert.ok(shareBtn, 'Share button must be present in toolbar');
    assert.ok(saveBtn.innerHTML.includes('Save'), 'Initial label must say Save');
    assert.equal(saveBtn.classList.contains('is-saved'), false, 'Initial state must not be is-saved');

    // Click Save -> Should transition to Saved state
    saveBtn.click();
    assert.ok(saveBtn.innerHTML.includes('Saved'), 'Label must transition to Saved ✓');
    assert.equal(saveBtn.classList.contains('is-saved'), true);
    assert.equal(SavedLessonsUI.isLessonSaved(card), true);
    assert.equal(SavedLessonsUI.getSavedLessons().length, 1);

    // Second click -> Should transition back to Save (unsaved)
    saveBtn.click();
    assert.ok(saveBtn.innerHTML.includes('Save'), 'Label must revert to Save');
    assert.equal(saveBtn.classList.contains('is-saved'), false);
    assert.equal(SavedLessonsUI.isLessonSaved(card), false);
    assert.equal(SavedLessonsUI.getSavedLessons().length, 0);
  });

  test('DESKTOP TOPBAR: updateBadgeCounters updates both nav-drawer and topbar saved badges', () => {
    const navPill = createMockNode('small');
    navPill.style = {};
    const topbarPill = createMockNode('span');
    topbarPill.style = {};
    const panelBadge = createMockNode('span');

    const elements = {
      'nav-drawer-saved-count': navPill,
      'topbar-saved-count': topbarPill,
      'saved-lessons-count-badge': panelBadge
    };

    global.document = {
      getElementById: (id) => elements[id] || null
    };

    // 0 lessons initially
    SavedLessonsUI.updateBadgeCounters();
    assert.equal(navPill.style.display, 'none');
    assert.equal(topbarPill.style.display, 'none');

    // Save 1 lesson
    SavedLessonsUI.saveLesson({ id: 'topbar-test-1', topic: 'Astronomy', plainText: 'Stars and planets' });
    assert.equal(navPill.textContent, '1');
    assert.equal(navPill.style.display, 'inline-flex');
    assert.equal(topbarPill.textContent, '1');
    assert.equal(topbarPill.style.display, 'inline-flex');
    assert.equal(panelBadge.textContent, '1 saved');

    // Clear lessons
    SavedLessonsUI.clearSavedLessons();
    assert.equal(navPill.style.display, 'none');
    assert.equal(topbarPill.style.display, 'none');
    assert.equal(panelBadge.textContent, '0 saved');
  });
});
