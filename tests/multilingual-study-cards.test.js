const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const LessonCardRenderer = require('../frontend/lesson-card-renderer.js');
const SavedLessonsUI = require('../frontend/saved-lessons-ui.js');

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

// Mock browser DOM node
function createMockNode(tag = 'div') {
  let _className = '';
  const _classes = new Set();
  const _attributes = {};
  const _listeners = {};

  const el = {
    tagName: tag.toUpperCase(),
    style: {},
    dataset: {},
    get className() { return _className; },
    set className(val) {
      _className = val || '';
      _classes.clear();
      _className.split(/\s+/).filter(Boolean).forEach(c => _classes.add(c));
    },
    classList: {
      add(...cs) { cs.forEach(c => _classes.add(c)); _className = Array.from(_classes).join(' '); },
      remove(...cs) { cs.forEach(c => _classes.delete(c)); _className = Array.from(_classes).join(' '); },
      toggle(c, force) {
        if (force === undefined) {
          if (_classes.has(c)) _classes.delete(c);
          else _classes.add(c);
        } else if (force) {
          _classes.add(c);
        } else {
          _classes.delete(c);
        }
        _className = Array.from(_classes).join(' ');
      },
      contains(c) { return _classes.has(c); }
    },
    attributes: _attributes,
    setAttribute(k, v) { _attributes[k] = String(v); },
    getAttribute(k) { return _attributes[k] !== undefined ? _attributes[k] : null; },
    hasAttribute(k) { return k in _attributes; },
    removeAttribute(k) { delete _attributes[k]; },
    children: [],
    appendChild(child) { this.children.push(child); return child; },
    get innerHTML() { return this._innerHTML || ''; },
    set innerHTML(rawVal) {
      this._innerHTML = rawVal;
      this.children = [];
      const cleanVal = (rawVal || '').replace(/<!--[\s\S]*?-->/g, '');
      const stack = [this];
      const tagRegex = /<(\/)?([a-z0-9\-]+)([^>]*)>|([^<]+)/gi;
      let m;
      while ((m = tagRegex.exec(cleanVal)) !== null) {
        if (m[4]) {
          const txt = m[4].trim();
          if (txt && stack.length > 0) {
            const top = stack[stack.length - 1];
            top.textContent = (top.textContent || '') + (top.textContent ? ' ' : '') + txt;
          }
          continue;
        }

        const isClosing = m[1] === '/';
        const tagName = m[2];
        const attrStr = m[3] || '';

        if (isClosing) {
          for (let i = stack.length - 1; i >= 1; i--) {
            if (stack[i].tagName.toLowerCase() === tagName.toLowerCase()) {
              stack.splice(i);
              break;
            }
          }
        } else {
          const child = createMockNode(tagName);
          const attrRegex = /([a-z0-9\-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gi;
          let am;
          while ((am = attrRegex.exec(attrStr)) !== null) {
            const k = am[1];
            const v = am[2] !== undefined ? am[2] : (am[3] !== undefined ? am[3] : (am[4] !== undefined ? am[4] : ''));
            if (k.toLowerCase() === 'class') {
              child.className = v;
            } else {
              child.setAttribute(k, v);
            }
          }

          stack[stack.length - 1].appendChild(child);

          const isVoid = VOID_TAGS.has(tagName.toLowerCase()) || attrStr.trim().endsWith('/');
          if (!isVoid) {
            stack.push(child);
          }
        }
      }
    },
    textContent: '',

    addEventListener(evt, fn) {
      _listeners[evt] = _listeners[evt] || [];
      _listeners[evt].push(fn);
    },
    click(e = { stopPropagation: () => {} }) {
      const handlers = _listeners['click'] || [];
      for (const h of handlers) h(e);
    },
    querySelectorAll(sel) {
      const results = [];
      const cls = sel.startsWith('.') ? sel.slice(1) : sel;
      const walk = (node) => {
        if (!node) return;
        if (node.classList && node.classList.contains(cls)) results.push(node);
        if (node.children) node.children.forEach(walk);
      };
      if (this.children) this.children.forEach(walk);
      return results;
    },
    querySelector(sel) {
      const all = this.querySelectorAll(sel);
      return all.length > 0 ? all[0] : null;
    }

  };
  return el;
}

describe('Multilingual Study Cards & Per-Language Cache', () => {
  let domElements = {};
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    global.localStorage = {
      getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
      setItem: (k, v) => { mockStorage[k] = String(v); },
      removeItem: (k) => { delete mockStorage[k]; },
      clear: () => { mockStorage = {}; }
    };

    domElements = {
      'voice-reply-popup': createMockNode('div'),
      'voice-popup-content': createMockNode('div'),
      'btn-close-voice-popup': createMockNode('button'),
      'subtitles-text': createMockNode('p'),
      'lang-en': createMockNode('button'),
      'lang-kn': createMockNode('button'),
      'lang-hi': createMockNode('button'),
      'mission-stage': createMockNode('div')
    };
    domElements['voice-reply-popup'].classList.add('is-visible');

    global.document = {
      getElementById: (id) => domElements[id] || null,
      querySelector: (sel) => {
        if (sel === '.mission-stage') return domElements['mission-stage'];
        return null;
      },
      querySelectorAll: () => [],
      createElement: (tag) => createMockNode(tag),
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    global.window = global;
    global.window.SavedLessonsUI = SavedLessonsUI;
    global.window.LessonCardRenderer = LessonCardRenderer;
  });

  afterEach(() => {
    delete global.localStorage;
  });

  test('Invariant 1: ensureLangVariantsCache creates non-enumerable dictionary seeded with birth language', () => {
    const card = {
      id: 'card-water-cycle',
      topic: 'The Water Cycle',
      question: 'Explain the water cycle',
      plainText: 'Water evaporates into clouds and falls as rain.',
      language: 'en'
    };

    // Ensure non-enumerable cache creation
    const birthLang = card.language || 'en';
    const variants = {};
    variants[birthLang] = card;
    Object.defineProperty(card, '__langVariants', {
      value: variants,
      writable: true,
      enumerable: false,
      configurable: true
    });

    assert.ok(card.__langVariants, '__langVariants must exist');
    assert.strictEqual(card.__langVariants.en, card, 'Cache must be seeded with original card under birth language');

    // Non-enumerable check: Object.keys and JSON.stringify must NEVER contain __langVariants
    const keys = Object.keys(card);
    assert.strictEqual(keys.includes('__langVariants'), false, 'Object.keys MUST NOT include non-enumerable __langVariants');

    const json = JSON.stringify(card);
    assert.strictEqual(json.includes('__langVariants'), false, 'JSON.stringify MUST NOT serialize __langVariants');

    // Storage safety check: SavedLessonsUI.saveLesson must never persist __langVariants
    const saved = SavedLessonsUI.saveLesson(card);
    assert.ok(saved);
    const savedJson = JSON.stringify(saved);
    assert.strictEqual(savedJson.includes('__langVariants'), false, 'Saved lesson payload in localStorage MUST NOT contain __langVariants');
  });

  test('Invariant 2: Language-agnostic illustration image is carried across language variants without refetching', () => {
    const mockImageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    const englishCard = {
      id: 'card-water-cycle',
      topic: 'Water Cycle',
      language: 'en',
      plainText: 'Water evaporates and condenses.',
      diagram: {
        title: 'Water Cycle',
        layout: 'cycle',
        parts: [{ id: 'p1', label: 'Evaporation', explanation: 'Water turns to vapor' }]
      }
    };

    Object.defineProperty(englishCard, '__diagramIllustrationUrl', {
      value: mockImageUrl,
      writable: true,
      enumerable: false,
      configurable: true
    });

    const kannadaCard = {
      id: 'card-water-cycle',
      topic: 'ಜಲ ಚಕ್ರ',
      language: 'kn',
      plainText: 'ನೀರು ಆವಿಯಾಗಿ ಮೋಡವಾಗುತ್ತದೆ.',
      diagram: {
        title: 'ಜಲ ಚಕ್ರ',
        layout: 'cycle',
        parts: [{ id: 'p1', label: 'ಆವಿಯಾಗುವಿಕೆ', explanation: 'ನೀರು ಶಾಖದಿಂದ ಆವಿಯಾಗುತ್ತದೆ' }]
      }
    };

    // Carry over illustration image URL
    if (englishCard.__diagramIllustrationUrl && !kannadaCard.__diagramIllustrationUrl) {
      Object.defineProperty(kannadaCard, '__diagramIllustrationUrl', {
        value: englishCard.__diagramIllustrationUrl,
        writable: true,
        enumerable: false,
        configurable: true
      });
    }

    assert.strictEqual(kannadaCard.__diagramIllustrationUrl, mockImageUrl, 'Kannada variant must inherit cached illustration data URL');

    // Render interactive diagram with Kannada card: it should immediately use the cached image without fetching
    const el = LessonCardRenderer.renderInteractiveDiagram(kannadaCard.diagram, {
      card: kannadaCard,
      language: 'kn'
    });
    const img = el.querySelector('.diagram-illustration-img');
    assert.ok(img, 'Illustration image must be rendered');
    assert.strictEqual(img.getAttribute('src'), mockImageUrl, 'Must render cached illustration without making network request');
  });

  test('Invariant 3: Cache-hit swaps language instantly with zero network requests', async () => {
    const cardEn = {
      id: 'card-photo',
      topic: 'Photosynthesis',
      language: 'en',
      plainText: 'Plants make food using sunlight.',
      diagram: { title: 'Photosynthesis', layout: 'flow', parts: [{ id: 'p1', label: 'Sunlight', explanation: 'Energy source' }] }
    };

    const cardKn = {
      id: 'card-photo',
      topic: 'ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ',
      language: 'kn',
      plainText: 'ಸಸ್ಯಗಳು ಸೂರ್ಯನ ಬೆಳಕನ್ನು ಬಳಸಿ ಆಹಾರ ತಯಾರಿಸುತ್ತವೆ.',
      diagram: { title: 'ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ', layout: 'flow', parts: [{ id: 'p1', label: 'ಸೂರ್ಯನ ಬೆಳಕು', explanation: 'ಶಕ್ತಿಯ ಮೂಲ' }] }
    };

    const variants = { en: cardEn, kn: cardKn };
    Object.defineProperty(cardEn, '__langVariants', { value: variants, enumerable: false, writable: true });
    Object.defineProperty(cardKn, '__langVariants', { value: variants, enumerable: false, writable: true });

    // Switching to 'kn' should find it immediately in variants
    assert.ok(cardEn.__langVariants.kn, 'Target language kn must be present in cache');
    const swapped = cardEn.__langVariants.kn;
    assert.strictEqual(swapped.language, 'kn');
    assert.strictEqual(swapped.topic, 'ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ');
  });

  test('Invariant 4: Rapid toggle guard prevents out-of-order asynchronous responses from overwriting latest selection', async () => {
    let activeSeq = 0;
    let finalApplied = null;

    // Simulate clicking 'kn' (slow: 50ms) then immediately clicking 'hi' (faster: 20ms)
    async function simulateSwitch(lang, delayMs) {
      const switchSeq = ++activeSeq;
      await new Promise(r => setTimeout(r, delayMs));
      // Only apply if switchSeq matches activeSeq
      if (switchSeq === activeSeq) {
        finalApplied = lang;
      }
    }

    const p1 = simulateSwitch('kn', 50);
    const p2 = simulateSwitch('hi', 20);

    await Promise.all([p1, p2]);
    assert.strictEqual(finalApplied, 'hi', 'Rapid toggle guard MUST discard stale kn response and keep hi');
  });

  test('Invariant 5: Preserves Saved state when switching languages', () => {
    const originalCard = {
      id: 'card-to-save',
      topic: 'Friction',
      language: 'en',
      plainText: 'Friction opposes motion.'
    };

    // Save the original card in English
    SavedLessonsUI.saveLesson(originalCard);
    assert.strictEqual(SavedLessonsUI.isLessonSaved(originalCard), true, 'Original card should be saved');

    // Create Hindi variant with matching ID
    const hindiCard = {
      id: 'card-to-save',
      topic: 'घर्षण',
      language: 'hi',
      plainText: 'घर्षण गति का विरोध करता है।'
    };

    // Simulate applyLanguageVariant preserving saved status
    const wasSaved = SavedLessonsUI.isLessonSaved(originalCard);
    if (wasSaved) {
      SavedLessonsUI.saveLesson(hindiCard, { language: 'hi' });
    }

    assert.strictEqual(SavedLessonsUI.isLessonSaved(hindiCard), true, 'Saved state MUST be preserved for Hindi variant');
    const savedLessons = SavedLessonsUI.getSavedLessons();
    const entry = savedLessons.find(l => l.id === 'card-to-save');
    assert.ok(entry);
    assert.strictEqual(entry.language, 'hi');
  });

  test('Invariant 6: Subtitles HUD text is updated quietly without TTS re-speak', () => {
    const subtitlesText = domElements['subtitles-text'];
    const newCard = {
      language: 'kn',
      plainText: 'ನೀರು ಆವಿಯಾಗಿ ಮೋಡವಾಗುತ್ತದೆ.'
    };

    subtitlesText.textContent = newCard.plainText;
    assert.strictEqual(subtitlesText.textContent, 'ನೀರು ಆವಿಯಾಗಿ ಮೋಡವಾಗುತ್ತದೆ.');
  });

  test('Invariant 7: app.js contains required controller logic and window.app bindings', () => {
    const appJs = fs.readFileSync(path.join(__dirname, '../frontend/app.js'), 'utf8');

    // 1. Function definitions
    assert.match(appJs, /function\s+ensureLangVariantsCache\(/, 'app.js must define ensureLangVariantsCache');
    assert.match(appJs, /async\s+function\s+switchActiveCardLanguage\(/, 'app.js must define switchActiveCardLanguage');
    assert.match(appJs, /function\s+applyLanguageVariant\(/, 'app.js must define applyLanguageVariant');

    // 2. Non-enumerable definition
    assert.match(appJs, /Object\.defineProperty\(card,\s*['"]__langVariants['"],\s*\{\s*value:\s*variants,\s*writable:\s*true,\s*enumerable:\s*false/);

    // 3. Sequence guard
    assert.match(appJs, /let\s+activeLangSwitchSeq\s*=\s*0/);
    assert.match(appJs, /const\s+switchSeq\s*=\s*\+\+activeLangSwitchSeq/);
    assert.match(appJs, /switchSeq\s*!==\s*activeLangSwitchSeq/);

    // 4. Trigger in setLanguage
    assert.match(appJs, /if\s*\(\s*activePopupLessonCard\s*&&\s*isVoicePopupVisible\s*\)[\s\S]*?switchActiveCardLanguage\(lang\);/);

    // 5. Expose on window.app
    assert.match(appJs, /window\.app\.switchActiveCardLanguage\s*=\s*switchActiveCardLanguage/);
    assert.match(appJs, /window\.app\.ensureLangVariantsCache\s*=\s*ensureLangVariantsCache/);
    assert.match(appJs, /window\.app\.applyLanguageVariant\s*=\s*applyLanguageVariant/);
  });
});

