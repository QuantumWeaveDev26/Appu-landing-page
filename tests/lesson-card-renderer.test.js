const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const LessonCardRenderer = require('../frontend/lesson-card-renderer.js');

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
    hasAttribute(k) { return k in this.attributes; },
    removeAttribute(k) {
      delete this.attributes[k];
      if (k === 'hidden') this.hidden = false;
    },
    hidden: false,
    textContent: '',
    children: [],
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
      // Search inside appended children
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

// Global document mock for renderer in Node.js
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: (tag) => createMockNode(tag)
  };
}

describe('APPU Lesson-Card Renderer Unit Tests', () => {
  test('LessonCardRenderer exports parse, render, renderFallbackDiagram, and SAMPLE_CARD', () => {
    assert.ok(LessonCardRenderer);
    assert.equal(typeof LessonCardRenderer.parse, 'function');
    assert.equal(typeof LessonCardRenderer.render, 'function');
    assert.equal(typeof LessonCardRenderer.renderFallbackDiagram, 'function');
    assert.ok(LessonCardRenderer.SAMPLE_CARD);
    assert.equal(LessonCardRenderer.SAMPLE_CARD.mood, 'explaining');
    assert.equal(LessonCardRenderer.SAMPLE_CARD.gradeTone, 'junior');
    assert.equal(LessonCardRenderer.SAMPLE_CARD.blocks.length, 5);
  });

  describe('parse() - Safe contract & fallbacks', () => {
    test('null or empty input returns safe non-rich object without throwing', () => {
      const r1 = LessonCardRenderer.parse(null);
      assert.equal(r1.isRich, false);
      assert.deepEqual(r1.blocks, []);
      assert.equal(r1.plainText, '');

      const r2 = LessonCardRenderer.parse('');
      assert.equal(r2.isRich, false);
      assert.equal(r2.plainText, '');
    });

    test('plain text string returns safe non-rich object with preserved plainText', () => {
      const text = 'Photosynthesis is how green plants turn sunlight into energy.';
      const res = LessonCardRenderer.parse(text);
      assert.equal(res.isRich, false);
      assert.equal(res.plainText, text);
      assert.deepEqual(res.blocks, []);
    });

    test('parses JSON code-block containing valid lesson-card envelope', () => {
      const jsonCard = {
        mood: 'explaining',
        gradeTone: 'middle',
        blocks: [
          { type: 'hook', text: 'Did you know electricity travels at the speed of light?' }
        ],
        plainText: 'Electricity moves almost at light speed.'
      };
      const markdown = '```json\n' + JSON.stringify(jsonCard) + '\n```';
      const res = LessonCardRenderer.parse(markdown);

      assert.equal(res.isRich, true);
      assert.equal(res.mood, 'explaining');
      assert.equal(res.gradeTone, 'middle');
      assert.equal(res.blocks.length, 1);
      assert.equal(res.plainText, 'Electricity moves almost at light speed.');
    });

    test('malformed JSON string degrades cleanly to plain text without crashing', () => {
      const badJson = '{"mood": "explaining", "blocks": [malformed json}';
      const res = LessonCardRenderer.parse(badJson);
      assert.equal(res.isRich, false);
      assert.equal(res.plainText, badJson);
      assert.deepEqual(res.blocks, []);
    });

    test('gradeTone validates junior, middle, senior; defaults unknown to junior', () => {
      const obj = {
        blocks: [{ type: 'hook', text: 'test' }],
        gradeTone: 'unknown-grade',
        plainText: 'test plain'
      };
      const res = LessonCardRenderer.parse(obj);
      assert.equal(res.gradeTone, 'junior');
    });
  });

  describe('render() - Block rendering & interaction', () => {
    test('non-rich or empty blocks renders clean plainText block fallback', () => {
      const card = {
        isRich: false,
        plainText: 'Simple plain text explanation for student.',
        blocks: []
      };
      const el = LessonCardRenderer.render(card);
      assert.ok(el.classList.contains('appu-lesson-card'));
      assert.equal(el.children.length, 1);
      assert.ok(el.children[0].classList.contains('lesson-block-plain'));
      assert.equal(el.children[0].children[0].textContent, 'Simple plain text explanation for student.');
    });

    test('renders all 5 block types in SAMPLE_CARD top-to-bottom', () => {
      const card = LessonCardRenderer.SAMPLE_CARD;
      const el = LessonCardRenderer.render(card);

      assert.ok(el.classList.contains('appu-lesson-card'));
      assert.ok(el.classList.contains('grade-junior'));
      assert.equal(el.getAttribute('data-mood'), 'explaining');

      // Check block counts
      assert.equal(el.children.length, 5);
      const classes = el.children.map(c => c.className);
      assert.ok(classes[0].includes('lesson-block-hook'));
      assert.ok(classes[1].includes('lesson-block-diagram'));
      assert.ok(classes[2].includes('lesson-block-steps'));
      assert.ok(classes[3].includes('lesson-block-analogy'));
      assert.ok(classes[4].includes('lesson-block-check'));
    });

    test('check block reveals answer and triggers onCelebrate callback on button click', () => {
      let celebrated = false;
      const card = {
        mood: 'celebrating',
        gradeTone: 'junior',
        blocks: [
          { type: 'check', q: 'What is 7 x 8?', a: '56' }
        ],
        plainText: '7 x 8 is 56'
      };

      const el = LessonCardRenderer.render(card, {
        onCelebrate: () => { celebrated = true; }
      });

      const checkBlock = el.children[0];
      assert.ok(checkBlock.classList.contains('lesson-block-check'));

      // Simulate reveal button click
      const revealBtn = checkBlock.querySelector('.check-reveal-btn');
      const answerBox = checkBlock.querySelector('.check-answer-box');
      answerBox.setAttribute('hidden', 'true');
      answerBox.hidden = true;

      revealBtn.click();
      assert.equal(celebrated, true, 'onCelebrate callback must be invoked when answer is revealed');
      assert.equal(answerBox.hasAttribute('hidden'), false);
    });
  });

  describe('renderFallbackDiagram() - Semantic offline flowchart', () => {
    test('converts simple flowchart statements into structured flow items with from/to nodes', () => {
      const spec = 'flowchart LR; Sun-->Leaf; Water-->Leaf; Leaf-->Sugar';
      const html = LessonCardRenderer.renderFallbackDiagram(spec);

      assert.ok(html.includes('diagram-flow-fallback'));
      assert.ok(html.includes('from-node'));
      assert.ok(html.includes('to-node'));
      assert.ok(html.includes('Sun'));
      assert.ok(html.includes('Leaf'));
      assert.ok(html.includes('Sugar'));
    });

    test('empty or invalid spec returns empty string or pre block without crashing', () => {
      const h1 = LessonCardRenderer.renderFallbackDiagram('');
      assert.equal(h1, '');

      const h2 = LessonCardRenderer.renderFallbackDiagram(null);
      assert.equal(h2, '');
    });
  });

  describe('Sample Photosynthesis Demo Card Contract', () => {
    test('SAMPLE_CARD conforms to docs/next-level-visuals-plan.md specification', () => {
      const card = LessonCardRenderer.SAMPLE_CARD;
      assert.equal(card.mood, 'explaining');
      assert.equal(card.gradeTone, 'junior');
      assert.ok(Array.isArray(card.blocks));
      assert.equal(card.blocks.length, 5);

      const [hook, diagram, steps, analogy, check] = card.blocks;
      assert.equal(hook.type, 'hook');
      assert.ok(hook.text.includes('plant eats without a mouth'));

      assert.equal(diagram.type, 'diagram');
      assert.equal(diagram.kind, 'mermaid');
      assert.ok(diagram.spec.includes('flowchart LR'));

      assert.equal(steps.type, 'steps');
      assert.equal(steps.items.length, 4);

      assert.equal(analogy.type, 'analogy');
      assert.ok(analogy.text.includes('solar-powered kitchen'));

      assert.equal(check.type, 'check');
      assert.equal(check.a, 'Oxygen');

      assert.ok(card.plainText.length > 50);

      // Verify study mode data contracts attached to SAMPLE_CARD
      assert.ok(Array.isArray(card.quizItems));
      assert.ok(Array.isArray(card.flashcards));
      assert.ok(card.studyGuide && typeof card.studyGuide === 'object');
      assert.ok(card.mindMap && typeof card.mindMap === 'object');
      assert.ok(card.podcastScript && typeof card.podcastScript === 'object');
    });
  });

  describe('Study Output Modes Contract & Rendering', () => {
    test('exports all 5 sample data contracts matching n8n payload specification', () => {
      assert.ok(Array.isArray(LessonCardRenderer.SAMPLE_QUIZ_ITEMS));
      assert.ok(LessonCardRenderer.SAMPLE_QUIZ_ITEMS.length >= 3);
      const q = LessonCardRenderer.SAMPLE_QUIZ_ITEMS[0];
      assert.ok(q.question);
      assert.ok(Array.isArray(q.options) && q.options.length === 4);
      assert.equal(typeof q.correctIndex, 'number');
      assert.ok(q.explanation);
      assert.ok(q.citation.includes('NCERT'));

      assert.ok(Array.isArray(LessonCardRenderer.SAMPLE_FLASHCARDS));
      assert.ok(LessonCardRenderer.SAMPLE_FLASHCARDS.length >= 3);
      const fc = LessonCardRenderer.SAMPLE_FLASHCARDS[0];
      assert.ok(fc.front);
      assert.ok(fc.back);
      assert.ok(fc.explanation);

      assert.ok(LessonCardRenderer.SAMPLE_STUDY_GUIDE);
      assert.ok(Array.isArray(LessonCardRenderer.SAMPLE_STUDY_GUIDE.keyPoints));
      assert.ok(Array.isArray(LessonCardRenderer.SAMPLE_STUDY_GUIDE.definitions));
      assert.ok(Array.isArray(LessonCardRenderer.SAMPLE_STUDY_GUIDE.mustRemember));

      assert.ok(LessonCardRenderer.SAMPLE_MIND_MAP);
      assert.ok(LessonCardRenderer.SAMPLE_MIND_MAP.title);
      assert.ok(LessonCardRenderer.SAMPLE_MIND_MAP.spec.includes('flowchart'));

      assert.ok(LessonCardRenderer.SAMPLE_PODCAST_SCRIPT);
      assert.ok(LessonCardRenderer.SAMPLE_PODCAST_SCRIPT.title);
      assert.ok(LessonCardRenderer.SAMPLE_PODCAST_SCRIPT.duration);
      assert.ok(LessonCardRenderer.SAMPLE_PODCAST_SCRIPT.script);
      assert.ok(LessonCardRenderer.SAMPLE_PODCAST_SCRIPT.caption);
    });

    test('renderQuiz() renders MCQ mini-game, handles answer clicks, and shows feedback', () => {
      let celebrated = false;
      const el = LessonCardRenderer.renderQuiz(LessonCardRenderer.SAMPLE_QUIZ_ITEMS, {
        onCelebrate: () => { celebrated = true; }
      });

      assert.ok(el.classList.contains('study-mode-quiz'));
      const qBox = el.querySelector('.quiz-question-box');
      assert.ok(qBox);

      // Click the correct option (index 1 for q1)
      const correctBtn = el.querySelector('.quiz-opt-btn-1');
      assert.ok(correctBtn);
      correctBtn.click();

      assert.equal(celebrated, true, 'onCelebrate should fire on correct answer');
      const feedback = el.querySelector('.quiz-feedback-box');
      assert.ok(feedback);
    });

    test('renderFlashcards() renders 3D flipcard deck with tap-to-flip and navigation', () => {
      const el = LessonCardRenderer.renderFlashcards(LessonCardRenderer.SAMPLE_FLASHCARDS);
      assert.ok(el.classList.contains('study-mode-flashcards'));

      const flipper = el.querySelector('.flashcard-flipper');
      const scene = el.querySelector('.flashcard-scene');
      assert.ok(flipper);
      assert.ok(scene);

      // Simulate flip
      scene.click();
      assert.ok(flipper.classList.contains('is-flipped'));

      // Rating buttons exist
      const gotBtn = el.querySelector('.btn-fc-got');
      const reviewBtn = el.querySelector('.btn-fc-review');
      assert.ok(gotBtn);
      assert.ok(reviewBtn);
    });

    test('renderStudyGuide() renders structured sections: key points, definitions, must-remember', () => {
      const el = LessonCardRenderer.renderStudyGuide(LessonCardRenderer.SAMPLE_STUDY_GUIDE);
      assert.ok(el.classList.contains('study-mode-guide'));
      assert.ok(el.querySelector('.guide-keypoints'));
      assert.ok(el.querySelector('.guide-definitions'));
      assert.ok(el.querySelector('.guide-mustremember'));
    });

    test('renderMindMap() renders canvas wrap and flowchart nodes', () => {
      const el = LessonCardRenderer.renderMindMap(LessonCardRenderer.SAMPLE_MIND_MAP);
      assert.ok(el.classList.contains('study-mode-mindmap'));
      assert.ok(el.querySelector('.mindmap-canvas-wrap'));
    });

    test('renderPodcast() renders player card with play button, equalizer, and live caption', () => {
      const el = LessonCardRenderer.renderPodcast(LessonCardRenderer.SAMPLE_PODCAST_SCRIPT);
      assert.ok(el.classList.contains('study-mode-podcast'));
      assert.ok(el.querySelector('.podcast-player-card'));
      assert.ok(el.querySelector('.podcast-play-btn'));
      assert.ok(el.querySelector('.podcast-equalizer'));
      assert.ok(el.querySelector('.podcast-caption-box'));
    });

    test('renderStudyToolbar() renders all 6 mode tabs with accessible attributes', () => {
      let switchedMode = null;
      const el = LessonCardRenderer.renderStudyToolbar('quiz', (m) => { switchedMode = m; });
      assert.ok(el.classList.contains('study-modes-toolbar'));
      const tabs = el.children;
      assert.equal(tabs.length, 6);

      const quizTab = el.querySelector('.study-tab-quiz');
      assert.ok(quizTab.classList.contains('is-active'));
      assert.equal(quizTab.getAttribute('aria-selected'), 'true');

      const flashcardsTab = el.querySelector('.study-tab-flashcards');
      flashcardsTab.click();
      assert.equal(switchedMode, 'flashcards');
    });

    test('renderStudyMode() dispatches cleanly to each requested mode', () => {
      const quizEl = LessonCardRenderer.renderStudyMode('quiz');
      assert.ok(quizEl.classList.contains('study-mode-quiz'));

      const fcEl = LessonCardRenderer.renderStudyMode('flashcards');
      assert.ok(fcEl.classList.contains('study-mode-flashcards'));

      const guideEl = LessonCardRenderer.renderStudyMode('guide');
      assert.ok(guideEl.classList.contains('study-mode-guide'));

      const mmEl = LessonCardRenderer.renderStudyMode('mindmap');
      assert.ok(mmEl.classList.contains('study-mode-mindmap'));

      const podEl = LessonCardRenderer.renderStudyMode('podcast');
      assert.ok(podEl.classList.contains('study-mode-podcast'));
    });
  });
});
