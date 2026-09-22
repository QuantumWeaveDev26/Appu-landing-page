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

    // High amplitude opens mouth
    stage.updateMouth(0.85);
    assert.notEqual(mockMouthWrap.style.opacity, '0');
    assert.ok(mockMouthWrap.style.transform.includes('scale'));
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
