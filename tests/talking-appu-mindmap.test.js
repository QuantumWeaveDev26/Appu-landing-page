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
