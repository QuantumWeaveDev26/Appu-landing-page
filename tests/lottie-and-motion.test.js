const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const LottieCatalog = require('../frontend/lottie-catalog.js');
const LessonCardRenderer = require('../frontend/lesson-card-renderer.js');

// Mock browser DOM node for Node.js test environment
function createMockNode(tag = 'div', id = '') {
  let _className = '';
  const _classes = new Set();

  const el = {
    tagName: tag.toUpperCase(),
    id: id || '',
    style: {},
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
    querySelectorAll(selector) {
      const results = [];
      const cleanSelector = selector.replace(/^\./, '');
      const findInSub = (list) => {
        list.forEach(node => {
          if (node.classList && node.classList.contains(cleanSelector)) {
            results.push(node);
          }
          if (node.children) findInSub(node.children);
          if (node._subElements) findInSub(node._subElements);
        });
      };
      findInSub([this]);
      return results;
    },
    querySelector(selector) {
      const all = this.querySelectorAll(selector);
      return all.length > 0 ? all[0] : null;
    },
    addEventListener() {},
    removeEventListener() {}
  };

  return el;
}

// Set up global browser mocks for tests
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: (tag) => createMockNode(tag),
    querySelectorAll: () => [],
    querySelector: () => null
  };
}

describe('PACK D: Lottie Catalog & Educational Animation Engine', () => {
  test('LottieCatalog defines all 9 curated educational subject categories', () => {
    assert.ok(LottieCatalog, 'LottieCatalog should be defined');
    const categories = LottieCatalog.CATEGORIES;
    assert.ok(categories, 'CATEGORIES should be present');

    const expectedKeys = [
      'biology', 'space', 'physics', 'chemistry',
      'math', 'geography', 'history', 'science', 'idea'
    ];

    expectedKeys.forEach(k => {
      assert.ok(categories[k], `Category ${k} must exist`);
      assert.ok(categories[k].label, `${k} must have a label`);
      assert.ok(categories[k].emoji, `${k} must have an emoji reaction accent`);
      assert.ok(categories[k].accentColor, `${k} must have an accent color`);
      assert.ok(categories[k].description, `${k} must have a description`);
    });
  });

  test('getCategoryForLesson correctly derives subject category from topics and cards', () => {
    // 1. Biology test
    const bioCard = { topic: 'Photosynthesis in Plants', blocks: [{ text: 'Chloroplasts absorb sun rays' }] };
    assert.equal(LottieCatalog.getCategoryForLesson(bioCard).id, 'biology');

    // 2. Space test
    const spaceCard = { topic: 'Solar System and Planetary Orbits' };
    assert.equal(LottieCatalog.getCategoryForLesson(spaceCard).id, 'space');

    // 3. Physics test
    const physCard = { topic: 'Friction and Laws of Motion' };
    assert.equal(LottieCatalog.getCategoryForLesson(physCard).id, 'physics');

    // 4. Chemistry test
    const chemCard = { topic: 'Acids, Bases, and Chemical Reactions' };
    assert.equal(LottieCatalog.getCategoryForLesson(chemCard).id, 'chemistry');

    // 5. Math test
    const mathCard = { topic: 'Geometry, Triangles, and Angles' };
    assert.equal(LottieCatalog.getCategoryForLesson(mathCard).id, 'math');

    // 6. Geography test
    const geoCard = { topic: 'Water Cycle, Oceans, and Climate Zones' };
    assert.equal(LottieCatalog.getCategoryForLesson(geoCard).id, 'geography');

    // 7. History test
    const histCard = { topic: 'Ancient Civilization, Harappa, and Empires' };
    assert.equal(LottieCatalog.getCategoryForLesson(histCard).id, 'history');

    // 8. Science test
    const sciCard = { topic: 'Laboratory Experiment and Scientific Method' };
    assert.equal(LottieCatalog.getCategoryForLesson(sciCard).id, 'science');

    // 9. Fallback test
    const unknownCard = { topic: 'Abstract thinking and general overview' };
    assert.equal(LottieCatalog.getCategoryForLesson(unknownCard).id, 'idea');
  });

  test('getAnimatedSVG generates clean, self-contained SVG for every category', () => {
    const keys = Object.keys(LottieCatalog.CATEGORIES);
    keys.forEach(k => {
      const svg = LottieCatalog.getAnimatedSVG(k, { size: 120 });
      assert.ok(svg.includes('<svg'), `SVG output for ${k} must contain <svg`);
      assert.ok(svg.includes('</svg>'), `SVG output for ${k} must contain </svg>`);
      assert.ok(svg.includes(`lottie-category-${k}`), `SVG output for ${k} must contain category class`);
      assert.ok(svg.includes('viewBox="0 0 160 160"'), `SVG output for ${k} must have standard viewBox`);
      // Zero external tracking scripts
      assert.ok(!svg.includes('<script'), `SVG output for ${k} must not contain script tags`);
    });
  });

  test('getLottieJSON exports canonical Bodymovin/Lottie JSON structure', () => {
    const json = LottieCatalog.getLottieJSON('biology');
    assert.equal(json.v, '5.7.4');
    assert.equal(json.fr, 30);
    assert.equal(json.w, 160);
    assert.equal(json.h, 160);
    assert.ok(Array.isArray(json.layers));
  });

  test('mountAnimation mounts SVG into container with data-category attribute', () => {
    const mockContainer = createMockNode('div');
    const cat = LottieCatalog.mountAnimation(mockContainer, 'space', { size: 100 });
    assert.equal(cat.id, 'space');
    assert.equal(mockContainer.getAttribute('data-category'), 'space');
    assert.ok(mockContainer.classList.contains('lottie-mounted'));
    assert.ok(mockContainer.innerHTML.includes('lottie-category-space'));
  });
});

describe('PACK D: Lesson Card Renderer & Motion Integration', () => {
  test('LessonCardRenderer exports getLottieCatalog and resolveCategoryForCard', () => {
    assert.equal(typeof LessonCardRenderer.getLottieCatalog, 'function');
    assert.equal(typeof LessonCardRenderer.resolveCategoryForCard, 'function');
    const cat = LessonCardRenderer.resolveCategoryForCard(LessonCardRenderer.SAMPLE_CARD);
    assert.equal(cat.id, 'biology');
  });

  test('SAMPLE_CARD hook block renders category sticker and Watch mini-panel', () => {
    const el = LessonCardRenderer.render(LessonCardRenderer.SAMPLE_CARD);
    // 5 canonical child blocks preserved
    assert.equal(el.children.length, 5);

    const hookBlock = el.children[0];
    assert.ok(hookBlock.classList.contains('lesson-block-hook'));

    // Hook block HTML contains sticker with emoji 🌱 and Watch panel
    const html = hookBlock.innerHTML;
    assert.ok(html.includes('lesson-topic-sticker'), 'Must render lesson-topic-sticker');
    assert.ok(html.includes('🌱'), 'Must render biology emoji 🌱');
    assert.ok(html.includes('Biology &amp; Life Science') || html.includes('Biology & Life Science'));
    assert.ok(html.includes('lesson-watch-panel'), 'Must render lesson-watch-panel');
    assert.ok(html.includes('60 FPS'), 'Must display 60 FPS badge');
    assert.ok(html.includes('lottie-category-biology'), 'Must mount biology SVG animation');
  });

  test('buildConceptTreeHTML adds --node-index to branch cards for staggered entrance', () => {
    const branches = [
      { label: 'Sunlight', children: ['Photons', 'Chlorophyll'] },
      { label: 'Water', children: ['Roots', 'Xylem'] },
      { label: 'CO2', children: ['Stomata'] }
    ];
    const treeHTML = LessonCardRenderer.buildConceptTreeHTML('Photosynthesis', branches);
    assert.ok(treeHTML.includes('style="--node-index: 0;"'));
    assert.ok(treeHTML.includes('style="--node-index: 1;"'));
    assert.ok(treeHTML.includes('style="--node-index: 2;"'));
  });

  test('renderInteractiveDiagram adds --node-index to diagram nodes and slots', () => {
    const diagram = {
      title: 'Water Cycle',
      parts: [
        { id: 'evap', label: 'Evaporation', explanation: 'Water turns to vapor' },
        { id: 'cond', label: 'Condensation', explanation: 'Vapor forms clouds' },
        { id: 'prec', label: 'Precipitation', explanation: 'Rain falls' }
      ]
    };
    const el = LessonCardRenderer.renderInteractiveDiagram(diagram);
    const html = el.innerHTML;
    assert.ok(html.includes('style="--node-index: 0;"'));
    assert.ok(html.includes('style="--node-index: 1;"'));
    assert.ok(html.includes('style="--node-index: 2;"'));
  });
});

describe('PACK D: DOM & CSS Motion Invariants', () => {
  const htmlPath = path.join(__dirname, '../frontend/index.html');
  const cssPath = path.join(__dirname, '../frontend/style.css');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  test('index.html contains .stage-particles with 6 GPU-animated floating particles', () => {
    assert.ok(html.includes('class="stage-particles"'));
    assert.ok(html.includes('class="particle p-1"'));
    assert.ok(html.includes('class="particle p-2"'));
    assert.ok(html.includes('class="particle p-3"'));
    assert.ok(html.includes('class="particle p-4"'));
    assert.ok(html.includes('class="particle p-5"'));
    assert.ok(html.includes('class="particle p-6"'));
  });

  test('index.html includes lottie-catalog.js before lesson-card-renderer.js', () => {
    const lottieIdx = html.indexOf('lottie-catalog.js?v=20260928-09');
    const rendererIdx = html.indexOf('lesson-card-renderer.js?v=20260928-09');
    assert.ok(lottieIdx !== -1, 'lottie-catalog.js must be loaded with v=20260928-09');
    assert.ok(rendererIdx !== -1, 'lesson-card-renderer.js must be loaded with v=20260928-09');
    assert.ok(lottieIdx < rendererIdx, 'lottie-catalog.js must be loaded before lesson-card-renderer.js');
  });

  test('style.css defines living diagram staggered entrance and pulse-glow hotspot rules', () => {
    assert.ok(css.includes('@keyframes nodeStaggerEnter'));
    assert.ok(css.includes('animation: nodeStaggerEnter'));
    assert.ok(css.includes('--node-index'));
    assert.ok(css.includes('@keyframes hotspotPulseGlow'));
    assert.ok(css.includes('.diagram-node.pulse-glow'));
  });

  test('style.css defines smooth study tab entrance transition', () => {
    assert.ok(css.includes('@keyframes studyTabEnter'));
    assert.ok(css.includes('animation: studyTabEnter'));
  });

  test('style.css defines floating particles with translate3d and prefers-reduced-motion override', () => {
    assert.ok(css.includes('@keyframes floatParticle'));
    assert.ok(css.includes('translate3d'));
    assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
    assert.ok(css.includes('.stage-particles .particle'));
  });
});
