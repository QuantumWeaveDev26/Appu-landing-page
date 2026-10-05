const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const LessonCardRenderer = require('../frontend/lesson-card-renderer.js');

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
    hasAttribute(k) { return k in this.attributes; },
    removeAttribute(k) {
      delete this.attributes[k];
      if (k === 'hidden') this.hidden = false;
    },
    hidden: false,
    textContent: '',
    children: [],
    _subElements: [],
    _innerHTML: '',
    get innerHTML() { return this._innerHTML; },
    set innerHTML(val) {
      this._innerHTML = val;
      this._subElements = [];
      const classMatches = val.matchAll(/class="([^"]+)"/g);
      for (const m of classMatches) {
        const classes = m[1].split(/\s+/);
        for (const cls of classes) {
          const sub = createMockNode('div');
          sub.classList.add(cls);
          this._subElements.push(sub);
        }
      }
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    querySelector(sel) {
      const cls = sel.startsWith('.') ? sel.slice(1) : sel;
      for (const ch of this.children) {
        if (ch.classList.contains(cls)) return ch;
        if (ch._subElements) {
          for (const sub of ch._subElements) {
            if (sub.classList.contains(cls)) return sub;
          }
        }
      }
      if (this._subElements) {
        for (const sub of this._subElements) {
          if (sub.classList.contains(cls)) return sub;
        }
      }
      const node = createMockNode('div');
      node.classList.add(cls);
      if (!this._subElements) this._subElements = [];
      this._subElements.push(node);
      return node;
    },
    querySelectorAll(sel) {
      const cls = sel.startsWith('.') ? sel.slice(1) : sel;
      const res = [];
      for (const ch of this.children) {
        if (ch.classList.contains(cls)) res.push(ch);
      }
      if (this._subElements) {
        for (const sub of this._subElements) {
          if (sub.classList.contains(cls)) res.push(sub);
        }
      }
      return res;
    },
    _listeners: {},
    addEventListener(evt, fn) {
      this._listeners[evt] = this._listeners[evt] || [];
      this._listeners[evt].push(fn);
    },
    click() {
      const handlers = this._listeners['click'] || [];
      for (const h of handlers) h();
    }
  };
  return el;
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: (tag) => createMockNode(tag)
  };
}

describe('Change 2: Unique Visual Responses (Photosynthesis & Science)', () => {
  test('exports PHOTOSYNTHESIS_DIAGRAM, getCuratedCartoonIllustration, formatKidVoiceHTML, buildVisualResponseCard', () => {
    assert.ok(LessonCardRenderer.PHOTOSYNTHESIS_DIAGRAM);
    assert.equal(LessonCardRenderer.PHOTOSYNTHESIS_DIAGRAM.layout, 'flow');
    assert.equal(LessonCardRenderer.PHOTOSYNTHESIS_DIAGRAM.parts.length, 5);
    assert.equal(typeof LessonCardRenderer.getCuratedCartoonIllustration, 'function');
    assert.equal(typeof LessonCardRenderer.formatKidVoiceHTML, 'function');
    assert.equal(typeof LessonCardRenderer.buildCartoonExplanatoryDiagramHTML, 'function');
    assert.equal(typeof LessonCardRenderer.buildVisualResponseCard, 'function');
  });

  test('getCuratedCartoonIllustration returns cartoon svg path for photosynthesis topics', () => {
    assert.equal(LessonCardRenderer.getCuratedCartoonIllustration('photosynthesis'), './photosynthesis-cartoon.svg');
    assert.equal(LessonCardRenderer.getCuratedCartoonIllustration('How leaves make food'), './photosynthesis-cartoon.svg');
    assert.equal(LessonCardRenderer.getCuratedCartoonIllustration('Chloroplast structure'), './photosynthesis-cartoon.svg');
    assert.equal(LessonCardRenderer.getCuratedCartoonIllustration('Friction on a ramp'), null);
  });

  test('formatKidVoiceHTML wraps science keywords in playful colored pills', () => {
    const raw = 'Sunlight energy splits water into oxygen while carbon dioxide forms glucose sugar.';
    const formatted = LessonCardRenderer.formatKidVoiceHTML(raw);
    assert.ok(formatted.includes('kw-pill kw-sun'));
    assert.ok(formatted.includes('kw-pill kw-water'));
    assert.ok(formatted.includes('kw-pill kw-oxygen'));
    assert.ok(formatted.includes('kw-pill kw-co2'));
    assert.ok(formatted.includes('kw-pill kw-sugar'));
  });

  test('formatKidVoiceHTML supports Kannada and Hindi keywords', () => {
    const kn = 'ಸಸ್ಯಗಳು ಸೂರ್ಯನ ಬೆಳಕು ಮತ್ತು ನೀರು ಬಳಸಿ ಗ್ಲುಕೋಸ್ ಆಹಾರ ತಯಾರಿಸುತ್ತವೆ.';
    const knFormatted = LessonCardRenderer.formatKidVoiceHTML(kn);
    assert.ok(knFormatted.includes('kw-pill kw-sun'));
    assert.ok(knFormatted.includes('kw-pill kw-water'));
    assert.ok(knFormatted.includes('kw-pill kw-sugar'));

    const hi = 'पौधे धूप और पानी से ग्लूकोज भोजन बनाते हैं.';
    const hiFormatted = LessonCardRenderer.formatKidVoiceHTML(hi);
    assert.ok(hiFormatted.includes('kw-pill kw-sun'));
    assert.ok(hiFormatted.includes('kw-pill kw-water'));
    assert.ok(hiFormatted.includes('kw-pill kw-sugar'));
  });

  test('buildCartoonExplanatoryDiagramHTML creates steps strip with emojis and explainer bubble', () => {
    const html = LessonCardRenderer.buildCartoonExplanatoryDiagramHTML(LessonCardRenderer.PHOTOSYNTHESIS_DIAGRAM);
    assert.ok(html.includes('cartoon-explanatory-diagram'));
    assert.ok(html.includes('cartoon-diagram-titlebar'));
    assert.ok(html.includes('cartoon-steps-strip'));
    assert.ok(html.includes('cartoon-step-card'));
    assert.ok(html.includes('Step 1'));
    assert.ok(html.includes('Sunlight Energy'));
    assert.ok(html.includes('cartoon-explainer-bubble'));
    assert.ok(html.includes('explainer-appu-emoji'));
  });

  test('buildVisualResponseCard builds a rich visual response card for photosynthesis with all study modes', () => {
    const q = 'explain photosynthesis in detail';
    const a = 'Plants make food using sunlight, water, and CO2.';
    const card = LessonCardRenderer.buildVisualResponseCard(q, a, '7');

    assert.ok(card.isRich);
    assert.equal(card.topic, 'Photosynthesis');
    assert.ok(card.diagram);
    assert.equal(card.diagram.parts.length, 5);
    assert.ok(card.blocks.some(b => b.type === 'hook'));
    assert.ok(card.blocks.some(b => b.type === 'diagram'));
    assert.ok(card.blocks.some(b => b.type === 'steps'));
    assert.ok(card.blocks.some(b => b.type === 'check'));
    assert.ok(card.quizItems);
    assert.ok(card.flashcards);
    assert.ok(card.studyGuide);
    assert.ok(card.podcastScript);
  });

  test('buildVisualResponseCard supports multilingual variants (Kannada & Hindi)', () => {
    const cardKn = LessonCardRenderer.buildVisualResponseCard('ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ', 'ಆಹಾರ ತಯಾರಿಕೆ', '7', { language: 'kn' });
    assert.equal(cardKn.diagram.title, 'ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ಹೇಗೆ ನಡೆಯುತ್ತದೆ');
    assert.equal(cardKn.diagram.parts[0].label, 'ಸೂರ್ಯನ ಬೆಳಕು');

    const cardHi = LessonCardRenderer.buildVisualResponseCard('प्रकाश संश्लेषण', 'भोजन निर्माण', '7', { language: 'hi' });
    assert.equal(cardHi.diagram.title, 'प्रकाश संश्लेषण कैसे काम करता है');
    assert.equal(cardHi.diagram.parts[0].label, 'सूर्य का प्रकाश');
  });

  test('render() displays Appu speech card, cartoon hero, and animated diagram in visual response', () => {
    const card = LessonCardRenderer.buildVisualResponseCard('photosynthesis', 'Plants use light and water', '7');
    const el = LessonCardRenderer.render(card);

    assert.ok(el.classList.contains('appu-lesson-card'));
    const hook = el.children.find(c => c.className.includes('lesson-block-hook'));
    assert.ok(hook, 'Hook block must exist');
    assert.ok(hook.innerHTML.includes('appu-kid-speech-card'), 'Must contain Appu kid speech card');
    assert.ok(hook.innerHTML.includes('lesson-hero-media-card'), 'Must contain hero media card');
    assert.ok(hook.innerHTML.includes('cartoon-hero-card'), 'Must be styled as cartoon hero card');

    const diag = el.children.find(c => c.className.includes('lesson-block-diagram'));
    assert.ok(diag, 'Diagram block must exist');
    assert.ok(diag.innerHTML.includes('cartoon-explanatory-diagram'), 'Must contain cartoon explanatory diagram');
    assert.ok(diag.innerHTML.includes('Concept Mind Map'), 'Must preserve Concept Mind Map badge');
    assert.ok(diag.innerHTML.includes('Live Visual'), 'Must preserve Live Visual badge');
  });
});
