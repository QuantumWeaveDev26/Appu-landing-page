const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const LessonCardRenderer = require('../frontend/lesson-card-renderer.js');
const AvatarStage = require('../frontend/avatar-stage.js');

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
      const idMatches = val.matchAll(/id="([^"]+)"/g);
      for (const m of idMatches) {
        const sub = createMockNode('div', m[1]);
        this._subElements.push(sub);
      }
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    insertBefore(newChild, refChild) {
      const idx = this.children.indexOf(refChild);
      if (idx !== -1) {
        this.children.splice(idx, 0, newChild);
      } else {
        this.children.unshift(newChild);
      }
      return newChild;
    },
    querySelector(sel) {
      if (sel.startsWith('#')) {
        const targetId = sel.slice(1);
        if (this.id === targetId) return this;
        for (const ch of this.children) {
          const res = ch.querySelector(sel);
          if (res) return res;
        }
        if (this._subElements) {
          for (const sub of this._subElements) {
            if (sub.id === targetId) return sub;
          }
        }
        return null;
      }
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
      return null;
    },
    querySelectorAll(sel) {
      const results = [];
      const cls = sel.startsWith('.') ? sel.slice(1) : sel;
      for (const ch of this.children) {
        if (ch.classList.contains(cls)) results.push(ch);
      }
      return results;
    },
    _listeners: {},
    addEventListener(evt, fn) {
      this._listeners[evt] = this._listeners[evt] || [];
      this._listeners[evt].push(fn);
    },
    click() {
      if (this._listeners['click']) {
        this._listeners['click'].forEach(fn => fn({ preventDefault: () => {} }));
      }
    }
  };
  return el;
}

// Global document mock
if (typeof globalThis.document === 'undefined') {
  const elements = new Map();
  globalThis.document = {
    createElement: (tag) => createMockNode(tag),
    getElementById: (id) => {
      if (!elements.has(id)) {
        elements.set(id, createMockNode('div', id));
      }
      return elements.get(id);
    },
    querySelector: () => null,
    querySelectorAll: () => []
  };
}

describe('Task A: Mind Map as Default in Answers (Teacher Directive)', () => {
  test('LessonCardRenderer.parse preserves mindMap, quizItems, flashcards, studyGuide contracts', () => {
    const rawCard = {
      mood: 'explaining',
      gradeTone: 'junior',
      blocks: [
        { type: 'hook', text: 'How do plants make food?' },
        { type: 'steps', items: ['Sunlight', 'Water', 'CO2'] }
      ],
      plainText: 'Plants make food via photosynthesis.',
      mindMap: {
        title: 'Photosynthesis Concept Map',
        summary: 'Trace inputs and outputs',
        spec: 'flowchart TD; Sun-->Leaf'
      },
      quizItems: [{ question: 'What is made?' }],
      flashcards: [{ front: 'Stomata' }],
      studyGuide: { topic: 'Plant Energy' },
      podcastScript: { title: 'Audio Summary' }
    };

    const parsed = LessonCardRenderer.parse(rawCard);
    assert.equal(parsed.isRich, true);
    assert.ok(parsed.mindMap, 'mindMap contract must be preserved on parsed object');
    assert.equal(parsed.mindMap.title, 'Photosynthesis Concept Map');
    assert.ok(Array.isArray(parsed.quizItems));
    assert.ok(Array.isArray(parsed.flashcards));
    assert.ok(parsed.studyGuide);
    assert.ok(parsed.podcastScript);
  });

  test('render() renders Concept Mind Map prominently in lesson cards by default', () => {
    const cardWithDiagram = LessonCardRenderer.SAMPLE_CARD;
    const el = LessonCardRenderer.render(cardWithDiagram);

    assert.ok(el.classList.contains('appu-lesson-card'));
    // Second block is the prominent concept mind map
    const diagBlock = el.children.find(c => c.className.includes('lesson-block-diagram') || c.className.includes('lesson-block-mindmap'));
    assert.ok(diagBlock, 'Lesson card MUST contain a prominent concept mind map block by default');
    assert.ok(diagBlock.innerHTML.includes('Concept Mind Map'), 'Must display prominent Concept Mind Map badge');
    assert.ok(diagBlock.innerHTML.includes('Live Visual'), 'Must display Live Visual badge');
  });

  test('render() automatically injects prominent Mind Map if blocks lack a diagram but mindMap exists', () => {
    const n8nStyleCard = {
      mood: 'explaining',
      gradeTone: 'middle',
      blocks: [
        { type: 'hook', text: 'What is gravity?' },
        { type: 'steps', items: ['Mass attracts mass', 'Planets orbit sun'] }
      ],
      plainText: 'Gravity attracts objects with mass.',
      mindMap: {
        title: 'Gravitational Force Map',
        summary: 'Mass, distance, and orbital mechanics',
        spec: 'flowchart TD; Mass-->Gravity; Gravity-->Orbits'
      }
    };

    const el = LessonCardRenderer.render(n8nStyleCard);
    assert.ok(el.classList.contains('appu-lesson-card'));

    // Verify injected mind map block exists
    const injectedMap = el.children.find(c => c.className.includes('lesson-block-mindmap-default') || c.className.includes('study-mode-mindmap'));
    assert.ok(injectedMap, 'Mind Map must be automatically injected as default visual when mindMap contract is present');
  });

  test('buildMermaidFromBranches constructs valid Mermaid flowchart TD from central node and branches', () => {
    const central = 'Water Cycle';
    const branches = [
      { label: 'Evaporation', children: ['Ocean water heats up', 'Vapor rises'] },
      { label: 'Condensation', children: ['Clouds form in sky'] },
      { label: 'Precipitation', children: ['Rain falls down'] }
    ];

    const spec = LessonCardRenderer.buildMermaidFromBranches(central, branches);
    assert.ok(spec.startsWith('flowchart TD'));
    assert.ok(spec.includes('ROOT["Water Cycle"]'));
    assert.ok(spec.includes('B1["Evaporation"]'));
    assert.ok(spec.includes('C1_1["Ocean water heats up"]'));
    assert.ok(spec.includes('B2["Condensation"]'));
    assert.ok(spec.includes('B3["Precipitation"]'));
  });

  test('fromVisualizerPayload transforms n8n payload into canonical LessonCard with all study modes', () => {
    const samplePayload = {
      topic: 'How Does Rain Happen?',
      mindMap: {
        central: 'Rain Formation',
        branches: [
          { label: 'Evaporation', children: ['Water turns to vapor'] },
          { label: 'Condensation', children: ['Water drops gather'] }
        ],
        mermaid: 'flowchart TD\n  A[Rain Formation] --> B[Evaporation]\n  A --> C[Condensation]'
      },
      steps: [
        '1. Sun warms surface water.',
        '2. Vapor rises and cools.',
        '3. Rain falls to earth.'
      ],
      analogy: 'Rain is like nature recycling its own bathwater.',
      keyPoints: ['Water evaporates', 'Vapor cools into clouds', 'Heavy drops fall as rain'],
      quiz: [
        {
          q: 'What powers evaporation?',
          options: ['Sunlight heat', 'Wind gusts', 'Moonlight', 'Soil nutrients'],
          answerIndex: 0,
          explain: 'Solar thermal radiation warms liquid water molecules.'
        }
      ],
      flashcards: [
        { front: 'What is evaporation?', back: 'Liquid water changing to water vapor.' }
      ]
    };

    const answerText = 'Rain happens when water evaporates, condenses into clouds, and falls down.';
    const card = LessonCardRenderer.fromVisualizerPayload(samplePayload, answerText, '6');

    assert.equal(card.isRich, true);
    assert.equal(card.plainText, answerText);
    assert.equal(card.gradeTone, 'middle');
    assert.ok(card.mindMap);
    assert.equal(card.mindMap.title, 'How Does Rain Happen?');
    assert.ok(card.mindMap.spec.includes('Rain Formation'));

    // Verify blocks
    assert.ok(card.blocks.some(b => b.type === 'analogy'));
    assert.ok(card.blocks.some(b => b.type === 'diagram'));
    assert.ok(card.blocks.some(b => b.type === 'steps'));
    assert.ok(card.blocks.some(b => b.type === 'check'));

    // Verify study modes
    assert.ok(Array.isArray(card.quizItems));
    assert.equal(card.quizItems[0].correctIndex, 0);
    assert.ok(Array.isArray(card.flashcards));
    assert.ok(card.studyGuide);
    assert.ok(card.podcastScript);
  });

  test('createLoadingCard creates placeholder with shimmer diagram block', () => {
    const loadingCard = LessonCardRenderer.createLoadingCard('How do birds fly?', 'Birds fly using aerodynamic lift.', '7');
    assert.equal(loadingCard.isRich, true);
    assert.equal(loadingCard.isLoading, true);
    assert.equal(loadingCard.plainText, 'Birds fly using aerodynamic lift.');
    assert.equal(loadingCard.blocks.length, 1);
    assert.equal(loadingCard.blocks[0].kind, 'shimmer');
    assert.equal(loadingCard.blocks[0].loading, true);

    // Verify rendering of shimmer diagram block
    const el = LessonCardRenderer.render(loadingCard);
    assert.ok(el.classList.contains('appu-lesson-card'));
    const diag = el.children.find(c => c.className.includes('diagram-block-loading'));
    assert.ok(diag, 'Must render diagram-block-loading while generating');
    assert.ok(diag.innerHTML.includes('diagram-shimmer-loading'), 'Must contain diagram-shimmer-loading element');
    assert.ok(diag.innerHTML.includes('Generating...'), 'Must display Generating badge');
  });

  test('renderFallbackDiagram parses newline-separated Mermaid and maps bracket node labels', () => {
    const spec = `flowchart TD
      A[Sun] --> B[Plant Leaf]
      B --> C[Sugar]`;
    const html = LessonCardRenderer.renderFallbackDiagram(spec);
    assert.ok(html.includes('diagram-flow-fallback'));
    assert.ok(html.includes('Sun'));
    assert.ok(html.includes('Plant Leaf'));
    assert.ok(html.includes('Sugar'));
  });

  test('fetchStudyVisualizer returns parsed card on 200 response and handles failure gracefully', async () => {
    const originalFetch = globalThis.fetch;

    // Test successful response
    globalThis.fetch = async (url, opts) => {
      assert.ok(url.includes('appu-study-visualizer'));
      const body = JSON.parse(opts.body);
      assert.equal(body.question, 'Why is grass green?');
      assert.equal(body.grade, '6');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          topic: 'Chlorophyll and Grass',
          mindMap: { central: 'Chlorophyll', branches: [] },
          steps: ['Grass absorbs light', 'Reflects green'],
          analogy: 'Leaves wear green coats.',
          keyPoints: ['Chlorophyll is green'],
          quiz: [],
          flashcards: []
        })
      };
    };

    const card = await LessonCardRenderer.fetchStudyVisualizer({
      question: 'Why is grass green?',
      answer: 'Grass has chlorophyll which reflects green light.',
      grade: '6'
    });
    assert.ok(card);
    assert.equal(card.mindMap.title, 'Chlorophyll and Grass');

    // Test error/timeout response
    globalThis.fetch = async () => {
      return { ok: false, status: 500 };
    };

    const failedCard = await LessonCardRenderer.fetchStudyVisualizer({
      question: 'Broken endpoint test',
      answer: 'Test'
    });
    assert.equal(failedCard, null, 'Must return null gracefully on error');

    // Restore fetch
    globalThis.fetch = originalFetch;
  });

  test('parseMermaidToBranches extracts central node and branches from mermaid flowchart', () => {
    const spec = `flowchart TD
      A[Photosynthesis] --> B[Definition]
      A --> C[Key Ingredients]
      C --> C1[Sunlight]
      C --> C2[Water]`;
    const parsed = LessonCardRenderer.parseMermaidToBranches(spec);
    assert.ok(parsed);
    assert.equal(parsed.central, 'Photosynthesis');
    assert.equal(parsed.branches.length, 2);
    assert.equal(parsed.branches[0].label, 'Definition');
    assert.equal(parsed.branches[1].label, 'Key Ingredients');
    assert.equal(parsed.branches[1].children.length, 2);
    assert.equal(parsed.branches[1].children[0], 'Sunlight');
  });

  test('buildConceptTreeHTML generates clean semantic tree HTML with central hub and branch cards', () => {
    const central = 'Photosynthesis';
    const branches = [
      { label: 'Inputs', children: ['Sunlight', 'Water', 'CO2'] },
      { label: 'Outputs', children: ['Glucose', 'Oxygen'] }
    ];
    const html = LessonCardRenderer.buildConceptTreeHTML(central, branches, { isDedicatedTab: true });
    assert.ok(html.includes('concept-tree-wrapper'));
    assert.ok(html.includes('Photosynthesis'));
    assert.ok(html.includes('Inputs'));
    assert.ok(html.includes('Sunlight'));
    assert.ok(html.includes('Outputs'));
    assert.ok(html.includes('Glucose'));
    assert.ok(html.includes('concept-branch-card'));
  });

  test('renderMindMap() renders dedicated large Concept Tree view with live visual badge and view switcher', () => {
    const mapData = {
      title: 'Water Cycle Map',
      summary: 'Trace the path of water',
      central: 'Water Cycle',
      branches: [
        { label: 'Evaporation', children: ['Water heats up', 'Turns to vapor'] },
        { label: 'Precipitation', children: ['Clouds fill up', 'Rain falls'] }
      ],
      spec: 'flowchart TD\n  A[Water Cycle] --> B[Evaporation]\n  A --> C[Precipitation]'
    };
    const el = LessonCardRenderer.renderMindMap(mapData);
    assert.ok(el.classList.contains('study-mode-mindmap'));
    assert.ok(el.innerHTML.includes('Concept Tree'));
    assert.ok(el.innerHTML.includes('Live Visual'));
    assert.ok(el.innerHTML.includes('Water Cycle'));
    assert.ok(el.innerHTML.includes('Evaporation'));
  });

  test('renderFallbackDiagram groups 1-to-many links into Concept Tree without repetitive central node pairs', () => {
    const spec = `flowchart TD
      Photosynthesis-->Where It Happens
      Photosynthesis-->Main Ingredients
      Photosynthesis-->Process Steps
      Photosynthesis-->Products & Importance`;

    const html = LessonCardRenderer.renderFallbackDiagram(spec);
    assert.ok(html.includes('diagram-concept-tree-fallback') || html.includes('concept-tree-wrapper'));
    assert.ok(html.includes('central-node-pill'));
    assert.ok(html.includes('Photosynthesis'));
    assert.ok(html.includes('Where It Happens'));
    assert.ok(html.includes('Main Ingredients'));
    assert.ok(html.includes('Process Steps'));
    assert.ok(html.includes('Products &amp; Importance') || html.includes('Products & Importance'));

    // Verify Photosynthesis is NOT repeated 4 times as repetitive flow-link-item rows
    const matches = html.match(/Photosynthesis/g) || [];
    assert.equal(matches.length, 1, 'Central concept must appear exactly once at the top of the tree');
  });

  test('purgeMermaidErrorElements is exposed and executes safely without throwing', () => {
    assert.equal(typeof LessonCardRenderer.purgeMermaidErrorElements, 'function');
    assert.doesNotThrow(() => {
      LessonCardRenderer.purgeMermaidErrorElements();
    });
  });
});

describe('Task B: Build-Light "Talking Appu" Engine', () => {
  test('VoiceEngine exposes getSpeechAmplitude and returns 0 when idle', () => {
    const voiceCode = fs.readFileSync(path.resolve(__dirname, '../frontend/voice-engine.js'), 'utf8');
    assert.ok(voiceCode.includes('getSpeechAmplitude()'), 'VoiceEngine must implement getSpeechAmplitude()');
    assert.ok(voiceCode.includes('initAudioAnalyser()'), 'VoiceEngine must implement initAudioAnalyser()');
  });

  test('AvatarStage initializes talking facial mesh and elements', () => {
    const stage = new AvatarStage();
    assert.ok(stage);
    assert.equal(typeof stage.setVoiceEngine, 'function');
    assert.equal(typeof stage.startSpeechAnimation, 'function');
    assert.equal(typeof stage.resetAvatarToRest, 'function');
    assert.equal(typeof stage.triggerBlink, 'function');
    assert.equal(typeof stage.setAvatarProvider, 'function');
  });

  test('AvatarStage setState("speaking") triggers speech animation and setState("idle") resets to still', () => {
    const stage = new AvatarStage();

    // Mock VoiceEngine
    let amplitude = 0.75;
    stage.setVoiceEngine({
      getSpeechAmplitude: () => amplitude
    });

    stage.setState('speaking');
    assert.equal(stage.currentState, 'speaking');
    assert.equal(stage._animatingSpeech, true, 'Speech animation loop must start on speaking state');

    // Switch back to idle
    stage.setState('idle');
    assert.equal(stage.currentState, 'idle');
    assert.equal(stage._animatingSpeech, false, 'Speech animation must cleanly halt when idle');
    assert.equal(stage._smoothAmplitude, 0, 'Amplitude must return to 0 when idle');
  });

  test('Mouth aperture responds proportionally to audio amplitude', () => {
    const stage = new AvatarStage();
    const mockMouthWrap = createMockNode('div', 'avatar-mouth-wrap');
    stage.mouthWrap = mockMouthWrap;

    // Amplitude below noise threshold (< 0.05) keeps mouth closed
    stage.updateMouth(0.02);
    assert.equal(mockMouthWrap.style.opacity, '0');
    assert.ok(mockMouthWrap.style.transform.includes('scaleY(0)'));

    // High amplitude opens mouth with subtle natural shadow (never harsh opaque bar)
    stage.updateMouth(0.85);
    assert.notEqual(mockMouthWrap.style.opacity, '0');
    assert.ok(mockMouthWrap.style.transform.includes('scale'));
    assert.ok(parseFloat(mockMouthWrap.style.opacity) <= 0.7, 'Mouth aperture must be softly transparent, never harsh opaque block');
  });

  test('Head bob applies gentle translation and tilt', () => {
    const stage = new AvatarStage();
    const mockFrame = createMockNode('div', 'avatar-model-frame');
    stage.modelFrame = mockFrame;

    stage.updateHeadBob(0.65);
    assert.ok(mockFrame.style.transform.includes('translate3d'), 'Must apply translate3d for GPU acceleration');
    assert.ok(mockFrame.style.transform.includes('rotate'), 'Must apply gentle tilt rotation');
  });
});

describe('Task C: Modular Avatar Architecture', () => {
  test('setAvatarProvider allows external WebRTC streaming avatar pilots (HeyGen/D-ID) to attach', () => {
    const stage = new AvatarStage();
    let providerInitialized = false;
    let providerStateReceived = null;
    let providerDestroyed = false;

    const mockHeyGenProvider = {
      init: ({ stage: s }) => { providerInitialized = true; },
      onStateChange: (st) => { providerStateReceived = st; },
      destroy: () => { providerDestroyed = true; }
    };

    stage.setAvatarProvider(mockHeyGenProvider);
    assert.equal(providerInitialized, true);

    stage.setState('speaking');
    assert.equal(providerStateReceived, 'speaking');

    // Replacing provider destroys previous one
    stage.setAvatarProvider(null);
    assert.equal(providerDestroyed, true);
  });
});

describe('Task D: NCERT Citations & Grounded Curriculum Source Pills', () => {
  test('normalizeCitation correctly normalizes object, string, and missing citations', () => {
    // Missing / invalid
    assert.equal(LessonCardRenderer.normalizeCitation(null), null);
    assert.equal(LessonCardRenderer.normalizeCitation(undefined), null);
    assert.equal(LessonCardRenderer.normalizeCitation(''), null);
    assert.equal(LessonCardRenderer.normalizeCitation('   '), null);

    // String
    assert.deepEqual(LessonCardRenderer.normalizeCitation('NCERT Class 7 Science'), {
      label: 'NCERT Class 7 Science'
    });

    // Object with label
    const fullObj = {
      label: 'NCERT Class 7 Science - Nutrition in Animals',
      class: 7,
      subject: 'Science',
      chapter: 'Nutrition in Animals'
    };
    assert.deepEqual(LessonCardRenderer.normalizeCitation(fullObj), fullObj);

    // Object without label but with class and subject
    const partialObj = { class: 8, subject: 'Maths', chapter: 'Rational Numbers' };
    const normalized = LessonCardRenderer.normalizeCitation(partialObj);
    assert.ok(normalized);
    assert.equal(normalized.label, 'NCERT Class 8 Maths - Rational Numbers');
  });

  test('fromVisualizerPayload extracts top-level citation and propagates to card, mindMap, studyGuide, and quiz items', () => {
    const payloadWithCitation = {
      topic: 'Digestive System in Animals',
      citation: {
        label: 'NCERT Class 7 Science - Nutrition in Animals',
        class: 7,
        subject: 'Science',
        chapter: 'Nutrition in Animals'
      },
      mindMap: {
        central: 'Digestive System',
        branches: [
          { label: 'Buccal Cavity', children: ['Teeth', 'Saliva'] },
          { label: 'Stomach', children: ['Hydrochloric acid', 'Digestive juices'] }
        ]
      },
      steps: ['Ingestion', 'Digestion', 'Absorption', 'Assimilation', 'Egestion'],
      analogy: 'The digestive system is like an automated breakdown factory.',
      keyPoints: ['Nutrients are absorbed in small intestine', 'Villi increase surface area'],
      quiz: [
        {
          q: 'Where does carbohydrate digestion begin?',
          options: ['Mouth', 'Stomach', 'Small Intestine', 'Large Intestine'],
          answerIndex: 0,
          explain: 'Salivary amylase begins starch breakdown in the mouth.'
        }
      ]
    };

    const card = LessonCardRenderer.fromVisualizerPayload(payloadWithCitation, 'Digestion breakdown', '7');
    assert.ok(card);
    assert.ok(card.citation, 'card must contain citation');
    assert.equal(card.citation.label, 'NCERT Class 7 Science - Nutrition in Animals');
    assert.ok(card.mindMap.citation, 'mindMap must contain citation');
    assert.equal(card.mindMap.citation.label, 'NCERT Class 7 Science - Nutrition in Animals');
    assert.ok(card.studyGuide.citation, 'studyGuide must contain citation');
    assert.equal(card.studyGuide.citation.label, 'NCERT Class 7 Science - Nutrition in Animals');
    assert.ok(card.quizItems[0].citation, 'quiz item must inherit citation');
    assert.equal(card.quizItems[0].citation, 'NCERT Class 7 Science - Nutrition in Animals');
  });

  test('render() displays lesson-citation-pill in diagram-header when citation is present', () => {
    const card = {
      mood: 'explaining',
      gradeTone: 'middle',
      citation: { label: 'NCERT Class 7 Science - Nutrition in Animals' },
      blocks: [
        {
          type: 'diagram',
          title: 'Human Digestion',
          central: 'Digestion',
          branches: [{ label: 'Stomach', children: ['Acid'] }]
        }
      ],
      plainText: 'Digestion breaks down food.'
    };

    const el = LessonCardRenderer.render(card);
    const diag = el.querySelector('.lesson-block-diagram');
    assert.ok(diag, 'Must contain diagram block');
    assert.ok(diag.innerHTML.includes('lesson-citation-pill'), 'Diagram header must contain lesson-citation-pill');
    assert.ok(diag.innerHTML.includes('NCERT Class 7 Science - Nutrition in Animals'), 'Must include citation text');
    assert.ok(diag.innerHTML.includes('Source:'), 'Must include Source: label');
  });

  test('render() gracefully omits citation pill when citation is null or missing', () => {
    const cardWithoutCitation = {
      mood: 'explaining',
      gradeTone: 'junior',
      citation: null,
      blocks: [
        {
          type: 'diagram',
          title: 'Forces',
          central: 'Force',
          branches: [{ label: 'Push', children: [] }]
        }
      ],
      plainText: 'A push or pull is a force.'
    };

    const el = LessonCardRenderer.render(cardWithoutCitation);
    const diag = el.querySelector('.lesson-block-diagram');
    assert.ok(diag);
    assert.ok(!diag.innerHTML.includes('lesson-citation-pill'), 'Must omit lesson-citation-pill when citation is absent');
  });

  test('renderMindMap() renders citation pill in mindmap-badge-row when present, omits when absent', () => {
    const mapWithCit = {
      title: 'Respiration Map',
      central: 'Respiration',
      branches: [{ label: 'Aerobic', children: [] }],
      citation: { label: 'NCERT Class 7 Science - Respiration in Organisms' }
    };
    const el1 = LessonCardRenderer.renderMindMap(mapWithCit);
    assert.ok(el1.innerHTML.includes('lesson-citation-pill'));
    assert.ok(el1.innerHTML.includes('NCERT Class 7 Science - Respiration in Organisms'));

    const mapNoCit = {
      title: 'Simple Map',
      central: 'Simple',
      branches: []
    };
    const el2 = LessonCardRenderer.renderMindMap(mapNoCit);
    assert.ok(!el2.innerHTML.includes('lesson-citation-pill'), 'Should omit pill when citation is missing');
  });

  test('renderQuiz() displays citation pill in explain drawer with Source: prefix', () => {
    const quizItems = [
      {
        id: 'q1',
        question: 'Which organ produces bile?',
        options: ['Liver', 'Pancreas', 'Stomach', 'Kidney'],
        correctIndex: 0,
        explanation: 'The liver secretes bile which helps digest fats.',
        citation: 'NCERT Class 7 Science - Nutrition in Animals'
      }
    ];

    const el = LessonCardRenderer.renderQuiz(quizItems);
    const btn0 = el.querySelector('.quiz-opt-btn-0');
    assert.ok(btn0, 'Option button 0 must exist');
    btn0.click();

    assert.ok(el.innerHTML.includes('quiz-citation-pill'), 'Quiz feedback box must show quiz-citation-pill');
    assert.ok(el.innerHTML.includes('Source: NCERT Class 7 Science - Nutrition in Animals'), 'Must format with Source: prefix');
  });

  test('renderStudyGuide() renders citation pill in guide-badge-row when present', () => {
    const guideWithCit = {
      topic: 'Acids and Bases',
      grade: 'Class 7',
      keyPoints: ['Acids taste sour', 'Bases feel soapy'],
      citation: { label: 'NCERT Class 7 Science - Acids, Bases and Salts' }
    };

    const el = LessonCardRenderer.renderStudyGuide(guideWithCit);
    assert.ok(el.innerHTML.includes('guide-badge-row'));
    assert.ok(el.innerHTML.includes('lesson-citation-pill'));
    assert.ok(el.innerHTML.includes('NCERT Class 7 Science - Acids, Bases and Salts'));
  });
});

describe('Task E: Notes Tutor & Document Upload Teaching', () => {
  test('resolveNotesTutorEndpoint returns valid endpoint and respects window override', () => {
    const endpoint = LessonCardRenderer.resolveNotesTutorEndpoint();
    assert.ok(endpoint.includes('appu-notes-tutor'));

    // Test window override
    const originalWin = globalThis.window;
    globalThis.window = { __APPU_NOTES_TUTOR_URL__: 'https://custom-proxy.internal/notes-tutor' };
    assert.equal(LessonCardRenderer.resolveNotesTutorEndpoint(), 'https://custom-proxy.internal/notes-tutor');
    globalThis.window = originalWin;
  });

  test('formatCitationDisplay handles upload citations with fa-file-lines and isUpload: true', () => {
    const uploadCit = { label: 'Your uploaded notes', source: 'upload' };
    const formatted = LessonCardRenderer.formatCitationDisplay(uploadCit);
    assert.ok(formatted);
    assert.equal(formatted.isUpload, true);
    assert.equal(formatted.icon, 'fa-file-lines');
    assert.equal(formatted.text, 'Your uploaded notes');

    // NCERT citation check
    const ncertCit = { label: 'NCERT Class 7 Science - Nutrition in Animals' };
    const formattedNcert = LessonCardRenderer.formatCitationDisplay(ncertCit);
    assert.ok(formattedNcert);
    assert.equal(formattedNcert.isUpload, false);
    assert.equal(formattedNcert.icon, 'fa-book-bookmark');
    assert.equal(formattedNcert.text, 'Source: NCERT Class 7 Science - Nutrition in Animals');
  });

  test('fetchNotesTutor returns null if documentText is missing or empty', async () => {
    assert.equal(await LessonCardRenderer.fetchNotesTutor({ documentText: '' }), null);
    assert.equal(await LessonCardRenderer.fetchNotesTutor({ documentText: '   ' }), null);
    assert.equal(await LessonCardRenderer.fetchNotesTutor({}), null);
  });

  test('fetchNotesTutor caps documentText to 16,000 characters and parses response', async () => {
    const originalFetch = globalThis.fetch;
    let capturedBody = null;

    globalThis.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          answer: 'Photosynthesis is how plants convert solar energy into glucose.',
          topic: 'Photosynthesis in Leaves',
          citation: { label: 'Your uploaded notes', source: 'upload' },
          mindMap: {
            central: 'Photosynthesis',
            branches: [
              { label: 'Inputs', children: ['Light', 'CO2', 'Water'] },
              { label: 'Outputs', children: ['Glucose', 'Oxygen'] }
            ]
          },
          steps: ['Light capture', 'Water splitting', 'Calvin cycle'],
          analogy: 'Leaves are solar-powered sugar factories.',
          keyPoints: ['Chloroplasts trap photons', 'Stomata absorb CO2'],
          quiz: [
            {
              q: 'What is the primary product of photosynthesis?',
              options: ['Glucose', 'Methane', 'Nitrogen', 'Salt'],
              answerIndex: 0,
              explain: 'Plants produce glucose for fuel.'
            }
          ],
          flashcards: [
            { front: 'Stomata', back: 'Microscopic pores for gas exchange' }
          ]
        })
      };
    };

    const longDoc = 'Word '.repeat(5000); // ~25,000 chars
    const result = await LessonCardRenderer.fetchNotesTutor({
      question: 'Explain this chapter',
      documentText: longDoc,
      grade: '7',
      language: 'en'
    });

    assert.ok(result);
    assert.equal(capturedBody.documentText.length, 16000, 'Must cap documentText at 16,000 characters');
    assert.equal(capturedBody.grade, '7');
    assert.equal(capturedBody.language, 'en');

    assert.equal(result.answer, 'Photosynthesis is how plants convert solar energy into glucose.');
    assert.ok(result.lessonCard);
    assert.equal(result.lessonCard.mindMap.central, 'Photosynthesis');
    assert.equal(result.lessonCard.citation.label, 'Your uploaded notes');
    assert.equal(result.lessonCard.quizItems.length, 1);
    assert.equal(result.lessonCard.flashcards.length, 1);

    globalThis.fetch = originalFetch;
  });

  test('fetchNotesTutor handles network failure or non-200 gracefully without throwing', async () => {
    const originalFetch = globalThis.fetch;

    // 500 error
    globalThis.fetch = async () => ({ ok: false, status: 500 });
    const failRes = await LessonCardRenderer.fetchNotesTutor({
      question: 'Testing failure',
      documentText: 'Some notes text'
    });
    assert.equal(failRes, null);

    // Network error / throw
    globalThis.fetch = async () => { throw new Error('Network offline'); };
    const throwRes = await LessonCardRenderer.fetchNotesTutor({
      question: 'Testing network drop',
      documentText: 'Some notes text'
    });
    assert.equal(throwRes, null);

    globalThis.fetch = originalFetch;
  });

  test('render() and renderMindMap() apply is-upload-source class and fa-file-lines for uploaded notes', () => {
    const uploadCard = {
      isRich: true,
      mood: 'explaining',
      gradeTone: 'middle',
      citation: { label: 'Your uploaded notes', source: 'upload' },
      blocks: [
        {
          type: 'diagram',
          title: 'Notes Concept Tree',
          central: 'Cell Division',
          branches: [{ label: 'Mitosis', children: ['Prophase', 'Metaphase'] }],
          citation: { label: 'Your uploaded notes', source: 'upload' }
        }
      ],
      plainText: 'Cells divide through mitosis.'
    };

    const el = LessonCardRenderer.render(uploadCard);
    const diag = el.querySelector('.lesson-block-diagram');
    assert.ok(diag, 'Must contain diagram block');
    assert.ok(diag.innerHTML.includes('is-upload-source'), 'Must include is-upload-source class');
    assert.ok(diag.innerHTML.includes('fa-file-lines'), 'Must include fa-file-lines icon for upload');
    assert.ok(diag.innerHTML.includes('Your uploaded notes'), 'Must render citation label');

    // Test renderMindMap
    const mapEl = LessonCardRenderer.renderMindMap({
      title: 'Notes Concept Tree',
      central: 'Cell Division',
      branches: [{ label: 'Mitosis', children: [] }],
      citation: { label: 'Your uploaded notes', source: 'upload' }
    });
    assert.ok(mapEl.innerHTML.includes('is-upload-source'));
    assert.ok(mapEl.innerHTML.includes('fa-file-lines'));
  });

  test('renderQuiz() applies is-upload-source class and fa-file-lines for uploaded notes', () => {
    const quizItems = [
      {
        id: 'q1',
        question: 'What phase comes after prophase?',
        options: ['Metaphase', 'Anaphase', 'Telophase', 'Interphase'],
        correctIndex: 0,
        explanation: 'Chromosomes align along the metaphase plate.',
        citation: { label: 'Your uploaded notes', source: 'upload' }
      }
    ];

    const el = LessonCardRenderer.renderQuiz(quizItems);
    const btn0 = el.querySelector('.quiz-opt-btn-0');
    assert.ok(btn0);
    btn0.click();

    assert.ok(el.innerHTML.includes('is-upload-source'), 'Quiz explanation must include is-upload-source');
    assert.ok(el.innerHTML.includes('fa-file-lines'), 'Quiz explanation must include fa-file-lines');
    assert.ok(el.innerHTML.includes('Your uploaded notes'));
  });

  test('index.html contains required upload buttons, banners, and modal elements', () => {
    const fs = require('fs');
    const path = require('path');
    const html = fs.readFileSync(path.join(__dirname, '../frontend/index.html'), 'utf8');

    // Upload affordances
    assert.ok(html.includes('id="btn-upload-notes"'), 'Must contain dock upload notes button');
    assert.ok(html.includes('id="btn-chat-upload-notes"'), 'Must contain chat drawer upload notes button');

    // Active document banners
    assert.ok(html.includes('id="active-doc-banner-dock"'), 'Must contain dock active document banner');
    assert.ok(html.includes('id="active-doc-banner-drawer"'), 'Must contain drawer active document banner');
    assert.ok(html.includes('id="btn-clear-doc-dock"'), 'Must contain dock clear document button');
    assert.ok(html.includes('id="btn-clear-doc-drawer"'), 'Must contain drawer clear document button');

    // Notes upload modal
    assert.ok(html.includes('id="notes-upload-modal"'), 'Must contain notes upload modal');
    assert.ok(html.includes('id="notes-dropzone"'), 'Must contain notes file dropzone');
    assert.ok(html.includes('id="notes-paste-input"'), 'Must contain notes paste textarea');
    assert.ok(html.includes('id="btn-submit-notes"'), 'Must contain submit notes button');

    // pdf.js library
    assert.ok(html.includes('pdf.min.js'), 'Must include pdf.js library script');
  });
});
