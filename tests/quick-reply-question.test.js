const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ChatAgent, pickQuickReplyQuestion } = require('../frontend/chat-agent.js');

function createDomStub(lang = 'en') {
  const dispatched = [];
  const createEl = (tag) => {
    const el = {
      tagName: String(tag).toUpperCase(),
      className: '',
      textContent: '',
      disabled: false,
      attrs: {},
      children: [],
      listeners: {},
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return this.attrs[k] ?? null; },
      appendChild(child) { this.children.push(child); return child; },
      addEventListener(type, fn) {
        this.listeners[type] = this.listeners[type] || [];
        this.listeners[type].push(fn);
      },
      click() {
        (this.listeners.click || []).forEach((fn) => fn());
      },
      querySelector(sel) {
        return this.querySelectorAll(sel)[0] || null;
      },
      querySelectorAll(sel) {
        const out = [];
        const match = (node) => {
          if (!node || !node.tagName) return false;
          if (sel === 'button') return node.tagName === 'BUTTON';
          if (sel.startsWith('.')) return String(node.className || '').split(/\s+/).includes(sel.slice(1));
          return false;
        };
        const visit = (node) => {
          (node.children || []).forEach((c) => {
            if (match(c)) out.push(c);
            visit(c);
          });
        };
        visit(this);
        return out;
      }
    };
    return el;
  };

  return {
    dispatched,
    createEl,
    install() {
      global.window = { currentLang: lang };
      global.CustomEvent = class CustomEvent {
        constructor(type, init = {}) {
          this.type = type;
          this.detail = init.detail;
        }
      };
      global.document = {
        createElement: (tag) => createEl(tag),
        createTextNode: (txt) => ({ nodeType: 3, textContent: String(txt) }),
        getElementById: () => null,
        dispatchEvent: (ev) => dispatched.push(ev)
      };
    },
    cleanup() {
      delete global.window;
      delete global.CustomEvent;
      delete global.document;
    }
  };
}

describe('Quick-reply question heading above tappable chips', () => {
  it('picks the last "?" sentence by default', () => {
    const text = 'Plants make food using sunlight. Ready to try a quick example? Which subject shall we practise?';
    assert.equal(
      pickQuickReplyQuestion(text, ['Maths', 'Science', 'English']),
      'Which subject shall we practise?'
    );
  });

  it('prefers the "?" sentence with the highest word overlap when the last "?" sentence is rhetorical (run 49841)', () => {
    const text =
      "Hey! Let's kick off your exam prep with the subject you feel needs the most power-up right now. " +
      'Is it Math, Science, or maybe something else? ' +
      "Which one gets your adrenaline going—or the one that's making you blink twice?";
    assert.equal(
      pickQuickReplyQuestion(text, ['Math', 'Science', 'Something else']),
      'Is it Math, Science, or maybe something else?'
    );
  });

  it('returns empty string when there is no "?" sentence and trims over-long questions at a word boundary', () => {
    assert.equal(pickQuickReplyQuestion('Plants make food in their green leaves.', ['Yes', 'No']), '');
    const longQ = 'Would you like to explore ' + 'photosynthesis and cellular respiration in green plants '.repeat(4) + 'today?';
    const picked = pickQuickReplyQuestion(longQ, ['Yes', 'No']);
    assert.ok(picked.length <= 165, `Expected <= 165 chars, got ${picked.length}`);
    assert.ok(picked.endsWith('…?'));
  });

  it('renders .msg-quick-question with localized "Appu asks:" before chips, omits when no "?", and sends option on tap', () => {
    const dom = createDomStub('kn');
    dom.install();
    try {
      const bubble = dom.createEl('div');
      ChatAgent.prototype.renderQuickReplies.call(
        { language: 'kn' },
        {
          sender: 'appu',
          text: 'Is it Math, Science, or maybe something else? Which one gets your adrenaline going?',
          quickReplies: ['Math', 'Science', 'Something else']
        },
        bubble
      );

      const qEl = bubble.querySelector('.msg-quick-question');
      assert.ok(qEl, 'Expected .msg-quick-question element');
      const spans = qEl.children.filter((c) => c.tagName === 'SPAN');
      assert.equal(spans.length, 2);
      assert.equal(spans[0].getAttribute('aria-hidden'), 'true');
      assert.ok(spans[0].textContent.includes('ಅಪ್ಪು ಕೇಳುತ್ತದೆ:'));
      assert.equal(spans[1].textContent, 'Is it Math, Science, or maybe something else?');

      const chips = bubble.querySelectorAll('.quick-reply-chip');
      assert.equal(chips.length, 3);
      chips[1].click();
      assert.equal(dom.dispatched.length, 1);
      assert.equal(dom.dispatched[0].type, 'appu:quick-reply');
      assert.equal(dom.dispatched[0].detail.text, 'Science');

      // No "?" in text -> no .msg-quick-question heading, but chips still render
      const bubbleNoQ = dom.createEl('div');
      ChatAgent.prototype.renderQuickReplies.call(
        { language: 'en' },
        {
          sender: 'appu',
          text: 'Choose a subject below to begin.',
          quickReplies: ['Maths', 'Science']
        },
        bubbleNoQ
      );
      assert.equal(bubbleNoQ.querySelector('.msg-quick-question'), null);
      assert.equal(bubbleNoQ.querySelectorAll('.quick-reply-chip').length, 2);
    } finally {
      dom.cleanup();
    }
  });
});
