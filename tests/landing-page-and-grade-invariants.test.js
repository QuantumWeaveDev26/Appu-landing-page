const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FRONTEND = path.join(__dirname, '..', 'frontend');
const html = fs.readFileSync(path.join(FRONTEND, 'index.html'), 'utf8');
const landingCss = fs.readFileSync(path.join(FRONTEND, 'landing-page.css'), 'utf8');
const LandingPage = require(path.join(FRONTEND, 'landing-page.js'));
const LessonCardRenderer = require(path.join(FRONTEND, 'lesson-card-renderer.js'));
function createMockElement(tag = 'div', id = '') {
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
    removeAttribute(k) { delete this.attributes[k]; },
    children: [],
    appendChild(ch) {
      this.children.push(ch);
      ch.parentElement = this;
      return ch;
    },
    querySelector(sel) {
      if (sel.startsWith('.')) {
        const targetCls = sel.slice(1);
        if (this.classList.contains(targetCls)) return this;
        for (const ch of this.children) {
          const res = ch.querySelector ? ch.querySelector(sel) : null;
          if (res) return res;
        }
      }
      return null;
    },
    querySelectorAll(sel) { return []; },
    addEventListener() {},
    removeEventListener() {},
    textContent: '',
    _html: '',
    get innerHTML() { return this._html || this.textContent; },
    set innerHTML(val) {
      this._html = val;
      this.textContent = val.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  };
  return el;
}

global.document = {
  createElement: (t) => createMockElement(t),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};

const SavedLessonsUI = require(path.join(FRONTEND, 'saved-lessons-ui.js'));

describe('PRIORITY 1: New Marketing Landing Page & Design Mockup Invariants', () => {
  test('index.html contains #marketing-landing as the front door container before #app-shell', () => {
    const landingIdx = html.indexOf('id="marketing-landing"');
    const appShellIdx = html.indexOf('id="app-shell"');
    assert.ok(landingIdx !== -1, '#marketing-landing must be defined in index.html');
    assert.ok(appShellIdx !== -1, '#app-shell must be defined in index.html');
    assert.ok(landingIdx < appShellIdx, '#marketing-landing must appear before #app-shell in DOM order');
  });

  test('Header contains APPU AI brand logo, language dropdown, and Sign in button', () => {
    assert.ok(html.includes('class="landing-brand-title">APPU AI</span>'), 'Brand title must be APPU AI');
    assert.ok(html.includes('— by IGr Academy'), 'Brand subtext must mention by IGr Academy');
    assert.ok(html.includes('src="assets/igr-logo.png"'), 'Must use assets/igr-logo.png');
    assert.ok(html.includes('id="landing-lang-btn"'), 'Language dropdown trigger button must exist');
    assert.ok(html.includes('id="landing-btn-signin"'), 'Sign in CTA button must exist');
    assert.ok(html.includes('Sign in</span>'), 'Button must display Sign in copy');
  });

  test('Hero section contains exact kicker, headline, subtext, Class 5 badge, and primary CTA', () => {
    assert.ok(html.includes('HYPER-PERSONALISED LEARNING'), 'Must contain kicker HYPER-PERSONALISED LEARNING');
    assert.ok(html.includes('Every student is different.'), 'Headline part 1 must match');
    assert.ok(html.includes('Learning should be too.'), 'Headline part 2 must match');
    assert.ok(html.includes('Meet APPU, your AI mentor for academic excellence.'), 'Hero subtext must match');
    assert.ok(html.includes('Class 5 onwards'), 'Must contain Class 5 onwards badge');
    assert.ok(html.includes('id="landing-btn-try-free"'), 'Try APPU free CTA must exist');
    assert.ok(html.includes('Try APPU free'), 'CTA button copy must be Try APPU free');
    assert.ok(html.includes('No sign-up needed to try'), 'CTA helper copy must state No sign-up needed to try');
  });

  test('Hero visual contains authorized Puneeth likeness, speech bubble, and nameplate', () => {
    assert.ok(html.includes('src="assets/appu-cutout-new.png"'), 'Must use authorized Puneeth likeness asset');
    assert.ok(html.includes('"Let\'s learn your way."'), 'Speech bubble must state "Let\'s learn your way."');
    assert.ok(html.includes('class="landing-speech-bubble"'), 'Speech bubble container must exist');
    assert.ok(html.includes('class="landing-mentor-nameplate"'), 'Nameplate container must exist');
    assert.ok(html.includes('APPU</strong>'), 'Nameplate must show APPU');
    assert.ok(html.includes('Your AI learning mentor</span>'), 'Nameplate must show Your AI learning mentor');
  });

  test('Value proposition band renders the three pillars with clean separators', () => {
    assert.ok(html.includes('Understand clearly'), 'Value band pillar 1');
    assert.ok(html.includes('Practise confidently'), 'Value band pillar 2');
    assert.ok(html.includes('Learn at your pace'), 'Value band pillar 3');
  });

  test('"Start with one question." section renders working interactive input, mic, send arrow, and chips', () => {
    assert.ok(html.includes('Start with one question.'), 'Section heading must be Start with one question.');
    assert.ok(html.includes('id="landing-question-input"'), 'Question input must exist');
    assert.ok(html.includes('placeholder="What would you like to understand?"'), 'Placeholder must match mockup');
    assert.ok(html.includes('id="landing-btn-mic"'), 'Interactive mic button must exist');
    assert.ok(html.includes('id="landing-btn-send"'), 'Send arrow button must exist');
    assert.ok(html.includes('Type or speak in English, Kannada or Hindi'), 'Helper copy must match');
    assert.ok(html.includes('Why is the sky blue?'), 'Must have starter prompt chip for sky blue');
    assert.ok(html.includes('How does photosynthesis work?'), 'Must have starter prompt chip for photosynthesis');
  });

  test('landing-page.css defines crisp light theme, fluid typography, and multi-screen responsiveness', () => {
    assert.ok(landingCss.includes('body.view-landing'), 'Must define body.view-landing style');
    assert.ok(landingCss.includes('background: #ffffff !important;'), 'Must enforce light white background for landing view');
    assert.ok(landingCss.includes('@media (max-width: 1024px)'), 'Must include tablet breakpoint');
    assert.ok(landingCss.includes('@media (max-width: 768px)'), 'Must include mobile breakpoint');
    assert.ok(landingCss.includes('@media (max-width: 420px)'), 'Must include small phones breakpoint');
    assert.ok(landingCss.includes('@media (prefers-reduced-motion: reduce)'), 'Must support prefers-reduced-motion');
  });

  test('App shell contains Home button in topbar-actions to return to landing page', () => {
    assert.ok(html.includes('id="btn-back-to-landing"'), '#btn-back-to-landing must be defined in topbar');
    assert.ok(html.includes('class="topbar-home-btn'), 'Must have class topbar-home-btn');
  });
});

describe('PRIORITY 2: "Class 6 Everywhere" Anonymous Neutral Fallback Invariants', () => {
  beforeEach(() => {
    if (typeof global.window !== 'undefined') {
      delete global.window.getActiveChildGrade;
      delete global.window.parentSetupUI;
    }
  });

  test('when grade is not provided (anonymous), fromVisualizerPayload produces neutral citation without Class 6', () => {
    const payload = {
      topic: 'Law of Conservation of Energy',
      quiz: [
        { q: 'Can energy be created or destroyed?', options: ['Yes', 'No'], answerIndex: 1 }
      ],
      keyPoints: ['Energy is transformed, never created from nothing.']
    };

    // Anonymous call: no grade parameter passed
    const card = LessonCardRenderer.fromVisualizerPayload(payload, 'Energy cannot be created or destroyed.');
    assert.ok(card);
    assert.ok(card.quizItems);
    assert.equal(card.quizItems[0].citation, 'Interactive Learning', 'Anonymous quiz citation must be Interactive Learning, never Class 6');
    assert.equal(card.studyGuide.grade, '', 'Anonymous studyGuide.grade must be empty string, never Class 6');
  });

  test('when grade IS explicitly known (signed-in child grade 8), fromVisualizerPayload reflects Class 8', () => {
    const payload = {
      topic: 'Cell Structure and Functions',
      quiz: [
        { q: 'What is the powerhouse of the cell?', options: ['Mitochondria', 'Nucleus'], answerIndex: 0 }
      ],
      keyPoints: ['Mitochondria generates ATP.']
    };

    const card = LessonCardRenderer.fromVisualizerPayload(payload, 'The mitochondria produces cellular energy.', '8');
    assert.ok(card);
    assert.equal(card.quizItems[0].citation, 'Class 8 Curriculum', 'Explicit grade 8 should produce Class 8 Curriculum');
    assert.equal(card.studyGuide.grade, '8', 'Explicit grade 8 should be stored in studyGuide');
  });

  test('buildMinimalAnswerCard omits Class 6 when grade is anonymous', () => {
    const card = LessonCardRenderer.buildMinimalAnswerCard('What is friction?', 'Friction is a force that opposes motion.');
    assert.ok(card);
    assert.equal(card.studyGuide.grade, '', 'buildMinimalAnswerCard studyGuide.grade must be empty when anonymous');
  });

  test('renderStudyGuide renders "Interactive Learning" instead of "Class 6" when user is anonymous', () => {
    const guide = {
      topic: 'Photosynthesis',
      grade: '6', // Old card or fallback that had '6'
      keyPoints: ['Plants make glucose'],
      definitions: [{ term: 'Chlorophyll', definition: 'Green pigment' }]
    };

    const el = LessonCardRenderer.renderStudyGuide(guide);
    assert.ok(el.innerHTML.includes('guide-grade-pill'), 'Grade pill must be rendered');
    assert.ok(!el.innerHTML.includes('Class 6'), 'Anonymous study guide pill must NEVER say Class 6');
    assert.ok(el.innerHTML.includes('Interactive Learning'), 'Anonymous study guide pill must say Interactive Learning');
  });

  test('SavedLessonsUI renders "Appu Lesson" tag when item.grade is not set or anonymous', () => {
    const item = {
      id: 'sl_test_123',
      topic: 'Gravity and Orbits',
      plainText: 'Gravity pulls objects toward each other.',
      grade: null,
      timestamp: Date.now()
    };

    const cardEl = SavedLessonsUI.renderSavedCard(item);
    assert.ok(cardEl.innerHTML.includes('saved-card-tag'), 'Saved card tag must exist');
    assert.ok(cardEl.innerHTML.includes('Appu Lesson'), 'Tag must display Appu Lesson when grade is null');
    assert.ok(!cardEl.innerHTML.includes('Class 6'), 'Tag must NOT display Class 6');
  });
});
