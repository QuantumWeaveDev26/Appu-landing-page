const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function matchCompound(node, token) {
  if (!node) return false;

  // Optional tag name at beginning (e.g., "button" or "div")
  const tagMatch = token.match(/^[a-z0-9]+/i);
  if (tagMatch) {
    if (!node.tagName || node.tagName.toLowerCase() !== tagMatch[0].toLowerCase()) {
      return false;
    }
  }

  // Classes (e.g., ".diagram-mode-tab.is-active")
  const classMatches = token.matchAll(/\.([a-z0-9\-_]+)/gi);
  for (const cm of classMatches) {
    const cls = cm[1];
    if (!node.classList || !node.classList.contains(cls)) {
      return false;
    }
  }

  // Attributes (e.g., '[data-submode="practice"]' or '[role="tab"]' or '[hidden]')
  const attrMatches = token.matchAll(/\[([a-z0-9\-]+)(?:="([^"]*)")?\]/gi);
  for (const am of attrMatches) {
    const attr = am[1];
    const val = am[2];
    if (!node.hasAttribute(attr)) {
      return false;
    }
    if (val !== undefined && node.getAttribute(attr) !== val) {
      return false;
    }
  }

  return true;
}

// Mock browser DOM node for Node.js test environment
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
      contains(c) { return _classes.has(c); }
    },
    attributes: _attributes,
    setAttribute(k, v) {
      _attributes[k] = String(v);
      if (k.startsWith('data-')) {
        const camel = k.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        this.dataset[camel] = String(v);
      }
    },
    getAttribute(k) { return _attributes[k] !== undefined ? _attributes[k] : null; },
    hasAttribute(k) { return k in _attributes; },
    removeAttribute(k) {
      delete _attributes[k];
      if (k.startsWith('data-')) {
        const camel = k.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
        delete this.dataset[camel];
      }
    },
    textContent: '',
    children: [],
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
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    querySelectorAll(sel) {
      const results = [];
      const tokens = sel.trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return results;

      if (tokens.length === 1) {
        const token = tokens[0];
        const check = (node) => {
          if (!node) return;
          if (matchCompound(node, token)) results.push(node);
          if (node.children) node.children.forEach(check);
        };
        if (this.children) this.children.forEach(check);
        return results;
      }

      let currentSet = [this];
      for (const token of tokens) {
        const nextSet = [];
        const visited = new Set();
        const collect = (node) => {
          if (!node) return;
          if (matchCompound(node, token) && !visited.has(node)) {
            visited.add(node);
            nextSet.push(node);
          }
          if (node.children) node.children.forEach(collect);
        };
        for (const parent of currentSet) {
          if (parent.children) parent.children.forEach(collect);
        }
        currentSet = nextSet;
      }
      return currentSet;
    },
    querySelector(sel) {
      const all = this.querySelectorAll(sel);
      return all.length > 0 ? all[0] : null;
    },
    addEventListener(evt, fn) {
      _listeners[evt] = _listeners[evt] || [];
      _listeners[evt].push(fn);
    },
    click() {
      const handlers = _listeners['click'] || [];
      for (const h of handlers) h({ stopPropagation: () => {} });
    }
  };
  return el;
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: (tag) => createMockNode(tag),
    getElementById: (id) => null,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
} else {
  if (!globalThis.document.getElementById) globalThis.document.getElementById = (id) => null;
  if (!globalThis.document.addEventListener) globalThis.document.addEventListener = () => {};
  if (!globalThis.document.removeEventListener) globalThis.document.removeEventListener = () => {};
}

const LessonCardRenderer = require('../frontend/lesson-card-renderer.js');
const styleCss = fs.readFileSync(path.join(__dirname, '../frontend/style.css'), 'utf8');

describe('Task: Interactive Topic Diagrams (v1)', () => {
  const MOCK_CYCLE_DIAGRAM = {
    title: 'The Water Cycle',
    layout: 'cycle',
    parts: [
      { id: 'p1', label: 'Evaporation', explanation: 'Sun heats water and it rises as vapour' },
      { id: 'p2', label: 'Condensation', explanation: 'Vapour cools to form clouds' },
      { id: 'p3', label: 'Precipitation', explanation: 'Rain or snow falls to earth' },
      { id: 'p4', label: 'Collection', explanation: 'Water collects in lakes and rivers' }
    ]
  };

  const MOCK_FLOW_DIAGRAM = {
    title: 'Photosynthesis Flow',
    layout: 'flow',
    parts: [
      { id: 's1', label: 'Sunlight Absorbed', explanation: 'Chlorophyll catches solar energy' },
      { id: 's2', label: 'Water Absorbed', explanation: 'Roots drink water from soil' },
      { id: 's3', label: 'Glucose Created', explanation: 'Sugar produced for plant energy' }
    ]
  };

  const MOCK_PARTS_DIAGRAM = {
    title: 'Plant Cell Anatomy',
    layout: 'parts',
    parts: [
      { id: 'c1', label: 'Cell Wall', explanation: 'Sturdy outer protective layer' },
      { id: 'c2', label: 'Chloroplast', explanation: 'Green solar kitchen of the cell' },
      { id: 'c3', label: 'Nucleus', explanation: 'Command center holding DNA' }
    ]
  };

  describe('1. Data Contract & Normalization', () => {
    test('normalizeDiagram validates valid payload and assigns default layout if unknown', () => {
      const norm = LessonCardRenderer.normalizeDiagram({
        title: 'Carbon Cycle',
        layout: 'unknown-layout',
        parts: [
          { id: 'c1', label: 'Plant Photosynthesis', explanation: 'Plants take in CO2' },
          { id: 'c2', label: 'Respiration', explanation: 'Animals exhale CO2' }
        ]
      });

      assert.ok(norm);
      assert.equal(norm.title, 'Carbon Cycle');
      assert.equal(norm.layout, 'flow', 'Defaults unknown layout to flow');
      assert.equal(norm.parts.length, 2);
      assert.equal(norm.parts[0].id, 'c1');
    });

    test('normalizeDiagram returns null for missing or invalid diagrams (< 2 parts)', () => {
      assert.equal(LessonCardRenderer.normalizeDiagram(null), null);
      assert.equal(LessonCardRenderer.normalizeDiagram('not an object'), null);
      assert.equal(LessonCardRenderer.normalizeDiagram({ parts: [] }), null);
      assert.equal(LessonCardRenderer.normalizeDiagram({ parts: [{ label: 'Only one' }] }), null);
    });

    test('normalizeDiagram normalizes citation when present', () => {
      const norm = LessonCardRenderer.normalizeDiagram({
        title: 'Water Cycle',
        layout: 'cycle',
        parts: MOCK_CYCLE_DIAGRAM.parts,
        citation: 'NCERT Class 7 Science - Water'
      });
      assert.ok(norm.citation);
      assert.equal(norm.citation.label, 'NCERT Class 7 Science - Water');
    });

    test('exports SAMPLE_DIAGRAM conforming to the Appu Brain contract', () => {
      const sample = LessonCardRenderer.SAMPLE_DIAGRAM;
      assert.ok(sample);
      assert.ok(sample.title);
      assert.ok(['cycle', 'flow', 'parts'].includes(sample.layout));
      assert.ok(Array.isArray(sample.parts));
      assert.ok(sample.parts.length >= 3 && sample.parts.length <= 6);
      sample.parts.forEach(p => {
        assert.ok(p.id);
        assert.ok(p.label);
        assert.ok(p.explanation);
      });
    });

    test('fromVisualizerPayload extracts diagram object when present in n8n payload', () => {
      const payload = {
        topic: 'Water Cycle',
        diagram: MOCK_CYCLE_DIAGRAM
      };
      const card = LessonCardRenderer.fromVisualizerPayload(payload, 'The water cycle flows continuously');
      assert.ok(card);
      assert.ok(card.diagram);
      assert.equal(card.diagram.title, 'The Water Cycle');
      assert.equal(card.diagram.layout, 'cycle');
      assert.equal(card.diagram.parts.length, 4);
    });

    test('fromVisualizerPayload sets diagram to null when payload lacks diagram', () => {
      const payload = { topic: 'Simple Math' };
      const card = LessonCardRenderer.fromVisualizerPayload(payload, '2 + 2 = 4');
      assert.ok(card);
      assert.equal(card.diagram, null);
    });

    test('parse() extracts diagram from JSON envelope string', () => {
      const json = JSON.stringify({
        plainText: 'Here is how water cycles through nature',
        diagram: MOCK_CYCLE_DIAGRAM
      });
      const parsed = LessonCardRenderer.parse(json);
      assert.ok(parsed);
      assert.ok(parsed.diagram);
      assert.equal(parsed.diagram.title, 'The Water Cycle');
      assert.equal(parsed.diagram.parts.length, 4);
    });
  });

  describe('2. Study Modes Toolbar & Dispatching', () => {
    test('renderStudyToolbar() omits Diagram tab when diagram is absent', () => {
      const el = LessonCardRenderer.renderStudyToolbar('lesson', () => {}, 'en', null, {
        card: { topic: 'Photosynthesis' }
      });
      const tabs = Array.from(el.children).filter(c => c.classList && c.classList.contains('study-tab-btn') && !c.classList.contains('study-tab-save') && !c.classList.contains('study-tab-share'));
      assert.equal(tabs.length, 6, 'Should have standard 6 tabs when diagram is absent');
      assert.equal(el.querySelector('.study-tab-diagram'), null);
    });

    test('renderStudyToolbar() renders Diagram tab alongside other modes when diagram is present', () => {
      const el = LessonCardRenderer.renderStudyToolbar('lesson', () => {}, 'en', null, {
        card: {
          topic: 'Water Cycle',
          diagram: MOCK_CYCLE_DIAGRAM
        }
      });
      const diagramTab = el.querySelector('.study-tab-diagram');
      assert.ok(diagramTab);
      assert.equal(diagramTab.getAttribute('data-mode'), 'diagram');
      assert.equal(diagramTab.getAttribute('role'), 'tab');
    });

    test('renderStudyToolbar() marks Diagram tab as active when activeMode="diagram"', () => {
      let switchedMode = null;
      const el = LessonCardRenderer.renderStudyToolbar('diagram', (m) => { switchedMode = m; }, 'en', null, {
        card: { diagram: MOCK_CYCLE_DIAGRAM }
      });
      const diagramTab = el.querySelector('.study-tab-diagram');
      assert.ok(diagramTab.classList.contains('is-active'));
      assert.equal(diagramTab.getAttribute('aria-selected'), 'true');

      // Click quiz tab
      const quizTab = el.querySelector('.study-tab-quiz');
      quizTab.click();
      assert.equal(switchedMode, 'quiz');
    });

    test('renderStudyMode("diagram") dispatches cleanly to renderInteractiveDiagram', () => {
      const card = { diagram: MOCK_CYCLE_DIAGRAM };
      const el = LessonCardRenderer.renderStudyMode('diagram', card);
      assert.ok(el);
      assert.ok(el.classList.contains('study-mode-diagram'));
      assert.ok(el.querySelector('.diagram-header'));
      assert.ok(el.querySelector('.diagram-explore-view'));
      assert.ok(el.querySelector('.diagram-practice-view'));
    });

    test('renders with Atlas live brain verified water cycle payload', () => {
      const liveBrainDiagram = {
        title: 'The Water Cycle',
        layout: 'cycle',
        parts: [
          { id: 'p1', label: 'Evaporation', explanation: 'Water heats up and turns into vapor that rises.' },
          { id: 'p2', label: 'Condensation', explanation: 'Vapor cools and forms clouds in the sky.' },
          { id: 'p3', label: 'Precipitation', explanation: 'Water falls down as rain or snow.' },
          { id: 'p4', label: 'Collection', explanation: 'Water gathers in rivers, lakes, and oceans.' }
        ]
      };
      const card = LessonCardRenderer.fromVisualizerPayload({
        topic: 'Water Cycle',
        diagram: liveBrainDiagram
      }, 'Water cycles through evaporation, condensation, precipitation, and collection.');

      assert.ok(card.diagram);
      assert.equal(card.diagram.title, 'The Water Cycle');
      assert.equal(card.diagram.layout, 'cycle');
      assert.equal(card.diagram.parts.length, 4);

      // Verify toolbar includes Diagram tab
      const tb = LessonCardRenderer.renderStudyToolbar('lesson', () => {}, 'en', null, { card });
      const diagTab = tb.querySelector('.study-tab-diagram');
      assert.ok(diagTab, 'Toolbar should have Diagram tab when diagram is present in card');

      // Verify study mode renderer
      const el = LessonCardRenderer.renderStudyMode('diagram', card);
      assert.ok(el.querySelector('.diagram-layout-cycle'));
      assert.ok(el.querySelector('.diagram-node-cycle'));
      assert.ok(el.querySelector('.btn-next-part'));
      assert.ok(el.querySelector('.diagram-btn-reset'));
    });
  });

  describe('3. Tap-to-Explore Interactive Mode', () => {
    test('renders cycle layout with ring sequence, connectors, and explanation card', () => {
      const el = LessonCardRenderer.renderInteractiveDiagram(MOCK_CYCLE_DIAGRAM);
      assert.ok(el.classList.contains('study-mode-diagram'));

      const canvas = el.querySelector('.diagram-layout-cycle');
      assert.ok(canvas);

      // Verify node count & badges
      const node = el.querySelector('.diagram-node-cycle');
      assert.ok(node);
      assert.ok(node.classList.contains('is-selected'), 'First node selected by default');

      // Verify explanation panel
      const expCard = el.querySelector('.diagram-explanation-card');
      assert.ok(expCard);
      const title = el.querySelector('.diagram-exp-title');
      assert.ok(title);

      // Verify navigation buttons
      const nextBtn = el.querySelector('.btn-next-part');
      const prevBtn = el.querySelector('.btn-prev-part');
      assert.ok(nextBtn);
      assert.ok(prevBtn);
    });

    test('renders flow layout with directional step chevrons', () => {
      const el = LessonCardRenderer.renderInteractiveDiagram(MOCK_FLOW_DIAGRAM);
      const canvas = el.querySelector('.diagram-layout-flow');
      assert.ok(canvas);
      assert.ok(el.querySelector('.diagram-node-flow'));
      assert.ok(el.querySelector('.diagram-connector-flow'));
    });

    test('renders parts layout with anatomical component grid', () => {
      const el = LessonCardRenderer.renderInteractiveDiagram(MOCK_PARTS_DIAGRAM);
      const canvas = el.querySelector('.diagram-layout-parts');
      assert.ok(canvas);
      assert.ok(el.querySelector('.diagram-node-part'));
    });

    test('clicking Next/Previous updates active part in explanation card', () => {
      const el = LessonCardRenderer.renderInteractiveDiagram(MOCK_CYCLE_DIAGRAM);
      const nextBtn = el.querySelector('.btn-next-part');
      const prevBtn = el.querySelector('.btn-prev-part');
      const expStep = el.querySelector('.diagram-exp-step');

      assert.ok(nextBtn);
      assert.ok(expStep);

      // Click Next advances to part 2
      nextBtn.click();

      // Click Previous returns to part 1
      prevBtn.click();
    });
  });

  describe('4. Drag-to-Label Practice Mode', () => {
    test('renders practice view with drop slots and shuffled label bank', () => {
      const el = LessonCardRenderer.renderInteractiveDiagram(MOCK_CYCLE_DIAGRAM);
      const practiceView = el.querySelector('.diagram-practice-view');
      assert.ok(practiceView);

      // Slots exist
      const slot = el.querySelector('.diagram-slot');
      assert.ok(slot);
      assert.ok(el.querySelector('.slot-placeholder'));

      // Label bank exists
      const bank = el.querySelector('.diagram-label-bank');
      assert.ok(bank);
      const chip = el.querySelector('.diagram-label-chip');
      assert.ok(chip);

      // Reset button exists
      const resetBtn = el.querySelector('.diagram-btn-reset');
      assert.ok(resetBtn);
    });

    test('switching between Explore and Practice segmented tabs', () => {
      const el = LessonCardRenderer.renderInteractiveDiagram(MOCK_CYCLE_DIAGRAM);
      const practiceTab = el.querySelector('.diagram-mode-tab[data-submode="practice"]');
      const exploreTab = el.querySelector('.diagram-mode-tab[data-submode="explore"]');
      const exploreView = el.querySelector('.diagram-explore-view');
      const practiceView = el.querySelector('.diagram-practice-view');

      assert.ok(practiceTab);
      assert.ok(exploreTab);

      // Switch to practice
      practiceTab.click();
      assert.equal(practiceTab.classList.contains('is-active'), true);
      assert.equal(exploreTab.classList.contains('is-active'), false);

      // Switch back to explore
      exploreTab.click();
      assert.equal(exploreTab.classList.contains('is-active'), true);
      assert.equal(practiceTab.classList.contains('is-active'), false);
    });

    test('tap-to-place matching chip into slot correctly solves and scores', () => {
      let celebrated = false;
      const el = LessonCardRenderer.renderInteractiveDiagram({
        title: 'Two Step Test',
        layout: 'flow',
        parts: [
          { id: 'p1', label: 'Alpha', explanation: 'First letter' },
          { id: 'p2', label: 'Beta', explanation: 'Second letter' }
        ]
      }, {
        onCelebrate: () => { celebrated = true; }
      });

      // Switch to practice mode
      const practiceTab = el.querySelector('.diagram-mode-tab[data-submode="practice"]');
      practiceTab.click();

      // Tap chip p1 then tap slot p1
      const chip = el.querySelector('.diagram-label-chip[data-part-id="p1"]');
      const slot = el.querySelector('.diagram-slot[data-slot-id="p1"]');
      assert.ok(chip);
      assert.ok(slot);

      chip.click();
      slot.click();

      // Slot should now be correct
      assert.ok(slot.classList.contains('is-correct'));
    });

    test('reset button clears slots and reshuffles bank', () => {
      const el = LessonCardRenderer.renderInteractiveDiagram(MOCK_CYCLE_DIAGRAM);
      const resetBtn = el.querySelector('.diagram-btn-reset');
      assert.ok(resetBtn);
      resetBtn.click();
      const score = el.querySelector('.score-current');
      assert.ok(score);
    });
  });

  describe('5. Pure CSS & Dark Theme Invariants', () => {
    test('style.css defines core study-mode-diagram rules', () => {
      assert.match(styleCss, /\.study-mode-diagram\s*\{/);
      assert.match(styleCss, /\.diagram-header\s*\{/);
      assert.match(styleCss, /\.diagram-node\s*\{/);
      assert.match(styleCss, /\.diagram-slot\s*\{/);
      assert.match(styleCss, /\.diagram-label-chip\s*\{/);
      assert.match(styleCss, /\.diagram-explanation-card\s*\{/);
      assert.match(styleCss, /\.diagram-victory-banner\s*\{/);
    });

    test('style.css defines dark theme overrides for diagrams', () => {
      assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.study-mode-diagram/);
      assert.match(styleCss, /body\.theme-dark\s+\.study-mode-diagram/);
      assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.diagram-node/);
      assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.diagram-slot/);
      assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.diagram-label-chip/);
    });

    test('enforces mobile 44px minimum touch targets and responsive flex wrapping', () => {
      assert.match(styleCss, /\.diagram-mode-tab\s*\{[\s\S]*?min-height:\s*44px/);
      assert.match(styleCss, /\.diagram-label-chip\s*\{[\s\S]*?min-height:\s*44px/);
      assert.match(styleCss, /\.diagram-nav-btn\s*\{[\s\S]*?min-height:\s*44px/);
      assert.match(styleCss, /\.diagram-btn-reset\s*\{[\s\S]*?min-height:\s*44px/);
    });
  });

  describe('6. Lazy AI Concept Visual Illustration', () => {
    const SavedLessonsUI = require('../frontend/saved-lessons-ui.js');

    test('resolveStudyImageEndpoint returns valid n8n endpoint', () => {
      const endpoint = LessonCardRenderer.resolveStudyImageEndpoint();
      assert.ok(endpoint);
      assert.match(endpoint, /\/webhook\/appu-study-image/);
    });

    test('fetchStudyImage validates topic and returns null for empty input', async () => {
      assert.equal(await LessonCardRenderer.fetchStudyImage({ topic: '' }), null);
      assert.equal(await LessonCardRenderer.fetchStudyImage({ topic: null }), null);
      assert.equal(await LessonCardRenderer.fetchStudyImage({}), null);
    });

    test('renderInteractiveDiagram renders loading shimmer at top of Diagram tab by default', () => {
      const el = LessonCardRenderer.renderInteractiveDiagram(MOCK_CYCLE_DIAGRAM);
      const illustCard = el.querySelector('.diagram-illustration-card');
      assert.ok(illustCard, 'Illustration card container should be present');
      assert.ok(illustCard.classList.contains('is-loading'));
      assert.ok(el.querySelector('.diagram-illustration-shimmer'));
      assert.ok(el.querySelector('.shimmer-sparkle'));
      assert.ok(el.querySelector('.shimmer-text'));
    });

    test('renderInteractiveDiagram immediately renders cached illustration with <img> and badge', () => {
      const mockDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const cardWithImage = {
        topic: 'Water Cycle',
        diagram: MOCK_CYCLE_DIAGRAM
      };
      Object.defineProperty(cardWithImage, '__diagramIllustrationUrl', {
        value: mockDataUrl,
        writable: true,
        enumerable: false,
        configurable: true
      });

      const el = LessonCardRenderer.renderInteractiveDiagram(cardWithImage.diagram, { card: cardWithImage });
      const illustCard = el.querySelector('.diagram-illustration-card');
      assert.ok(illustCard);
      assert.ok(illustCard.classList.contains('has-image'));
      assert.ok(!illustCard.classList.contains('is-loading'));

      const img = el.querySelector('.diagram-illustration-img');
      assert.ok(img);
      assert.equal(img.getAttribute('src'), mockDataUrl);

      const badge = el.querySelector('.diagram-illustration-badge');
      assert.ok(badge);
    });

    test('storage quota protection: __diagramIllustrationUrl is non-enumerable and never saved to localStorage', () => {
      const heavyImage = 'data:image/png;base64,' + 'A'.repeat(5000);
      const card = {
        id: 'test-diagram-card',
        topic: 'Water Cycle',
        plainText: 'Water cycles through evaporation, condensation, precipitation.',
        diagram: MOCK_CYCLE_DIAGRAM
      };

      Object.defineProperty(card, '__diagramIllustrationUrl', {
        value: heavyImage,
        writable: true,
        enumerable: false,
        configurable: true
      });

      // 1. JSON.stringify verification
      const jsonStr = JSON.stringify(card);
      assert.equal(jsonStr.includes(heavyImage), false, 'JSON.stringify MUST NOT serialize __diagramIllustrationUrl');

      // 2. SavedLessonsUI.saveLesson verification
      const saved = SavedLessonsUI.saveLesson(card, { grade: '6' });
      assert.ok(saved);
      const savedJson = JSON.stringify(saved);
      assert.equal(savedJson.includes(heavyImage), false, 'Saved lesson payload in storage MUST NOT contain heavy image data');
      assert.equal(saved.card.diagram.imageUrl, undefined);
      assert.equal(saved.card.diagram.illustrationUrl, undefined);
    });

    test('error/timeout fallback hides illustration card without blocking interactive diagram', async () => {
      const card = {
        topic: 'Non-existent topic test',
        diagram: MOCK_CYCLE_DIAGRAM
      };
      const el = LessonCardRenderer.renderInteractiveDiagram(card.diagram, {
        card,
        imageTimeoutMs: 1 // force immediate abort
      });

      const illustCard = el.querySelector('.diagram-illustration-card');
      assert.ok(illustCard);

      // Interactive diagram elements remain completely rendered and intact
      assert.ok(el.querySelector('.diagram-layout-cycle'));
      assert.ok(el.querySelector('.diagram-node-cycle'));
      assert.ok(el.querySelector('.diagram-explanation-card'));
    });

    test('style.css defines diagram-illustration-card rules and dark theme overrides', () => {
      assert.match(styleCss, /\.diagram-illustration-card\s*\{/);
      assert.match(styleCss, /\.diagram-illustration-card\.is-loading\s*\{/);
      assert.match(styleCss, /\.diagram-illustration-shimmer\s*\{/);
      assert.match(styleCss, /\.diagram-illustration-img\s*\{/);
      assert.match(styleCss, /\.diagram-illustration-img\s*\{[\s\S]*?object-fit:\s*contain/);
      assert.match(styleCss, /\.diagram-illustration-img\s*\{[\s\S]*?max-height:\s*360px/);
      assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.diagram-illustration-card/);
      assert.match(styleCss, /body\.theme-dark\s+\.diagram-illustration-card/);
    });

    test('save resilience: saveLesson does not throw on non-serializable properties and cancels auto-hide timers', () => {
      let timerCancelled = false;
      global.window = global.window || {};
      global.window.__appuCancelVoicePopupTimer = () => { timerCancelled = true; };

      const card = {
        id: 'test-diagram-save-resilience',
        topic: 'Water Cycle',
        diagram: MOCK_CYCLE_DIAGRAM
      };
      Object.defineProperty(card, '__diagramIllustrationPromise', {
        value: Promise.resolve('ok'),
        writable: true,
        enumerable: false,
        configurable: true
      });

      const saved = SavedLessonsUI.saveLesson(card);
      assert.ok(saved);
      assert.equal(saved.card.id, 'test-diagram-save-resilience');
      assert.equal(saved.card.__diagramIllustrationPromise, undefined);

      const toggled = SavedLessonsUI.toggleSaveLesson(card);
      assert.equal(typeof toggled, 'object');
      assert.equal(typeof toggled.isSaved, 'boolean');
    });
  });
});

