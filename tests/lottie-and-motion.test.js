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

  test('SAMPLE_CARD hook block renders category sticker (Watch panel disabled)', () => {
    const el = LessonCardRenderer.render(LessonCardRenderer.SAMPLE_CARD);
    // 5 canonical child blocks preserved
    assert.equal(el.children.length, 5);

    const hookBlock = el.children[0];
    assert.ok(hookBlock.classList.contains('lesson-block-hook'));

    // Hook block renders the subject sticker; the Lottie "Watch" panel is temporarily
    // disabled (its animation was not painting, leaving a plain amber stage).
    const html = hookBlock.innerHTML;
    assert.ok(html.includes('lesson-topic-sticker'), 'Must render lesson-topic-sticker');
    assert.ok(html.includes('🌱'), 'Must render biology emoji 🌱');
    assert.ok(html.includes('Biology &amp; Life Science') || html.includes('Biology & Life Science'));
    assert.ok(!html.includes('lesson-watch-panel'), 'Watch panel is disabled for now');
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
    // Version-agnostic: the exact ?v= release pin is enforced by page-structure.test.py.
    const lottieIdx = html.search(/lottie-catalog\.js\?v=\d{8}-\d{2}/);
    const rendererIdx = html.search(/lesson-card-renderer\.js\?v=\d{8}-\d{2}/);
    assert.ok(lottieIdx !== -1, 'lottie-catalog.js must be loaded with a ?v= cache-bust');
    assert.ok(rendererIdx !== -1, 'lesson-card-renderer.js must be loaded with a ?v= cache-bust');
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

  test('style.css defines prominent AI hero card and real photo gallery styles', () => {
    assert.ok(css.includes('.lesson-hero-media-card'));
    assert.ok(css.includes('.hero-image-frame'));
    assert.ok(css.includes('.lesson-photos-gallery'));
    assert.ok(css.includes('.photo-card'));
    assert.ok(css.includes('@keyframes galleryPopIn'));
  });
});

describe('RICH MEDIA: Real Photos Gallery (Openverse) & AI Hero Integration', () => {
  test('LessonCardRenderer exports fetchOpenversePhotos', () => {
    assert.equal(typeof LessonCardRenderer.fetchOpenversePhotos, 'function');
  });

  test('fetchOpenversePhotos returns null safely for empty or single char query', async () => {
    const res1 = await LessonCardRenderer.fetchOpenversePhotos({ topic: '' });
    assert.equal(res1, null);

    const res2 = await LessonCardRenderer.fetchOpenversePhotos({ topic: '?' });
    assert.equal(res2, null);
  });

  test('fetchOpenversePhotos enforces mature=false and extracts CC attribution', async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl = '';

    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return {
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'test-1',
              title: 'Leaf Cell in Sunlight',
              url: 'https://example.com/photo1.jpg',
              thumbnail: 'https://example.com/thumb1.jpg',
              creator: 'Dr. Jane Botany',
              license: 'by',
              license_version: '2.0',
              license_url: 'https://creativecommons.org/licenses/by/2.0/',
              foreign_landing_url: 'https://flickr.com/photos/123'
            },
            {
              id: 'test-2',
              title: 'Chloroplast Stomata',
              url: 'https://example.com/photo2.jpg',
              thumbnail: 'https://example.com/thumb2.jpg',
              creator: 'BioCommons',
              license: 'by-sa',
              license_version: '4.0',
              license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
              foreign_landing_url: 'https://commons.wikimedia.org/456'
            }
          ]
        })
      };
    };

    try {
      const result = await LessonCardRenderer.fetchOpenversePhotos({ topic: 'What is photosynthesis?' });
      assert.ok(result, 'Result should be present');
      assert.ok(capturedUrl.includes('mature=false'), 'Must enforce mature=false strictly for kid safety');
      assert.ok(capturedUrl.includes('source=wikimedia'), 'Must lock source to wikimedia to prevent inappropriate Flickr leaks');
      assert.ok(capturedUrl.includes('license_type=commercial%2Cmodification') || capturedUrl.includes('license_type=commercial,modification'));
      assert.ok(capturedUrl.includes('photosynthesis'));
      assert.equal(result.photos.length, 2);
      assert.equal(result.photos[0].creator, 'Dr. Jane Botany');
      assert.equal(result.photos[0].license, 'CC BY 2.0');
      assert.equal(result.photos[0].foreignLandingUrl, 'https://flickr.com/photos/123');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('fetchOpenversePhotos falls back cleanly to null if < 2 results found', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 'only-one',
            title: 'Lone Image',
            url: 'https://example.com/1.jpg'
          }
        ]
      })
    });

    try {
      const result = await LessonCardRenderer.fetchOpenversePhotos({ topic: 'Obscure abstract math item' });
      assert.equal(result, null, 'Must fall back to null when sparse to avoid broken gallery');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('SAMPLE_CARD hook block includes AI hero media card and real photos gallery placeholder', () => {
    const el = LessonCardRenderer.render(LessonCardRenderer.SAMPLE_CARD);
    assert.equal(el.children.length, 5, '5 child blocks invariant preserved');

    const hookBlock = el.children[0];
    const html = hookBlock.innerHTML;
    assert.ok(html.includes('lesson-hero-media-card'), 'Must render AI hero media card');
    assert.ok(html.includes('lesson-photos-gallery'), 'Must render photos gallery container');
    assert.ok(html.includes('Real World Field Photos'), 'Must include gallery title');
    assert.ok(html.includes('CC Safe'), 'Must include CC Safe verified badge');
  });

  test('LottieCatalog has valid Bodymovin JSON files on disk for all 9 categories', () => {
    const lottieDir = path.join(__dirname, '../frontend/assets/lottie');
    const categories = ['biology', 'space', 'physics', 'chemistry', 'math', 'geography', 'history', 'science', 'idea'];

    categories.forEach(cat => {
      const filePath = path.join(lottieDir, `${cat}.json`);
      assert.ok(fs.existsSync(filePath), `Lottie file for ${cat} must exist on disk`);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      assert.equal(content.v, '5.7.4');
      assert.ok(content.fr >= 30);
      assert.ok(Array.isArray(content.layers));
      assert.ok(content.layers.length >= 2, `${cat} must have multiple animation layers`);
      // Under 150KB constraint
      const sizeKb = fs.statSync(filePath).size / 1024;
      assert.ok(sizeKb < 150, `${cat}.json (${sizeKb.toFixed(1)}KB) must be under 150KB`);
    });
  });
});

