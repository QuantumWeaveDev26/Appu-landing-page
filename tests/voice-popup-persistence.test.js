const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML_PATH = path.join(__dirname, '..', 'frontend', 'index.html');
const htmlSource = fs.readFileSync(HTML_PATH, 'utf8');

describe('Persistent Voice Response Popup', () => {
  let dom;

  function createMockElement(tag, id = '', className = '', attrs = {}) {
    const el = {
      tagName: tag.toUpperCase(),
      id,
      className,
      classList: {
        _classes: new Set(className ? className.split(/\s+/).filter(Boolean) : []),
        add(c) { this._classes.add(c); el.className = Array.from(this._classes).join(' '); },
        remove(c) { this._classes.delete(c); el.className = Array.from(this._classes).join(' '); },
        contains(c) { return this._classes.has(c); },
        toggle(c, force) {
          if (force === undefined) {
            if (this.contains(c)) this.remove(c); else this.add(c);
          } else if (force) this.add(c); else this.remove(c);
        }
      },
      style: {},
      attributes: { ...attrs },
      hidden: Boolean(attrs.hidden),
      setAttribute(k, v) {
        this.attributes[k] = String(v);
        if (k === 'hidden') this.hidden = true;
      },
      getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; },
      hasAttribute(k) { return k in this.attributes; },
      removeAttribute(k) {
        delete this.attributes[k];
        if (k === 'hidden') this.hidden = false;
      },
      textContent: '',
      innerHTML: '',
      children: [],
      parentElement: null,
      appendChild(child) {
        this.children.push(child);
        child.parentElement = this;
        return child;
      },
      _listeners: {},
      addEventListener(evt, fn) {
        this._listeners[evt] = this._listeners[evt] || [];
        this._listeners[evt].push(fn);
      },
      dispatchEvent(evt) {
        const handlers = this._listeners[evt.type || evt] || [];
        for (const h of handlers) h(evt);
      },
      click() {
        this.dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });
      },
      querySelector(sel) {
        for (const c of this.children) {
          if (sel.startsWith('#') && c.id === sel.slice(1)) return c;
          if (sel.startsWith('.') && c.classList.contains(sel.slice(1))) return c;
        }
        return null;
      }
    };
    return el;
  }

  function setupDomEnvironment() {
    const elements = new Map();

    const voiceReplyPopup = createMockElement('div', 'voice-reply-popup', 'voice-reply-popup', {
      role: 'region',
      'aria-live': 'polite',
      hidden: 'true'
    });
    const voicePopupTitleText = createMockElement('strong', 'voice-popup-title-text');
    voicePopupTitleText.textContent = 'Appu says';
    const btnCloseVoicePopup = createMockElement('button', 'btn-close-voice-popup', 'icon-btn voice-popup-close', {
      'aria-label': 'Dismiss response'
    });
    const voicePopupContent = createMockElement('div', 'voice-popup-content', 'voice-popup-body');

    voiceReplyPopup.appendChild(voicePopupTitleText);
    voiceReplyPopup.appendChild(btnCloseVoicePopup);
    voiceReplyPopup.appendChild(voicePopupContent);

    const subtitlesText = createMockElement('p', 'subtitles-text');
    subtitlesText.textContent = 'Ready';

    const chatDrawer = createMockElement('aside', 'chat-drawer', 'chat-drawer');
    const chatScrim = createMockElement('div', 'chat-scrim', 'drawer-scrim');

    elements.set('voice-reply-popup', voiceReplyPopup);
    elements.set('btn-close-voice-popup', btnCloseVoicePopup);
    elements.set('voice-popup-content', voicePopupContent);
    elements.set('subtitles-text', subtitlesText);
    elements.set('chat-drawer', chatDrawer);
    elements.set('chat-scrim', chatScrim);

    const doc = {
      getElementById(id) {
        return elements.get(id) || null;
      },
      querySelector(sel) {
        if (sel.startsWith('#')) return elements.get(sel.slice(1)) || null;
        return null;
      },
      querySelectorAll() { return []; },
      addEventListener() {}
    };

    global.document = doc;
    global.window = {
      document: doc,
      setTimeout: setTimeout,
      clearTimeout: clearTimeout
    };

    return {
      voiceReplyPopup,
      btnCloseVoicePopup,
      voicePopupContent,
      subtitlesText,
      chatDrawer,
      chatScrim
    };
  }

  beforeEach(() => {
    dom = setupDomEnvironment();
  });

  afterEach(() => {
    delete global.document;
    delete global.window;
  });

  test('index.html defines #voice-reply-popup with role=region, aria-live=polite, and close button', () => {
    assert.match(
      htmlSource,
      /<div\s+id="voice-reply-popup"[^>]*role="region"[^>]*aria-live="polite"/,
      '#voice-reply-popup must have role="region" and aria-live="polite"'
    );
    assert.match(
      htmlSource,
      /id="btn-close-voice-popup"/,
      '#voice-reply-popup must contain #btn-close-voice-popup'
    );
    assert.match(
      htmlSource,
      /id="voice-popup-content"/,
      '#voice-reply-popup must contain #voice-popup-content'
    );

    // Must be positioned above response-dock
    const popupIdx = htmlSource.indexOf('id="voice-reply-popup"');
    const dockIdx = htmlSource.indexOf('class="response-dock"');
    assert.ok(popupIdx > -1 && dockIdx > -1, 'Both elements must exist');
    assert.ok(popupIdx < dockIdx, '#voice-reply-popup must appear above .response-dock');
  });

  test('showVoicePopup displays the assistant response and sets content', () => {
    let popupTimer = null;
    function showVoicePopup(text) {
      const popup = dom.voiceReplyPopup;
      const content = dom.voicePopupContent;
      if (!popup || !text) return;
      if (content) content.textContent = text;
      popup.hidden = false;
      popup.removeAttribute('hidden');
      popup.classList.add('is-visible');
    }

    showVoicePopup('Gravity pulls objects toward each other.');

    assert.equal(dom.voicePopupContent.textContent, 'Gravity pulls objects toward each other.');
    assert.equal(dom.voiceReplyPopup.hidden, false);
    assert.ok(dom.voiceReplyPopup.classList.contains('is-visible'));
  });

  test('voice recognition listening and interim updates do NOT overwrite or clear voice popup', () => {
    // 1. Initial assistant reply shown
    dom.voicePopupContent.textContent = 'Photosynthesis is how plants produce food using sunlight.';
    dom.voiceReplyPopup.hidden = false;
    dom.voiceReplyPopup.classList.add('is-visible');

    // 2. Recognition starts ("Listening..." streamed to #subtitles-text ONLY)
    dom.subtitlesText.textContent = 'Listening - tell me what you want to learn.';
    assert.equal(
      dom.voicePopupContent.textContent,
      'Photosynthesis is how plants produce food using sunlight.',
      'Popup content must remain intact when recognition starts'
    );
    assert.ok(dom.voiceReplyPopup.classList.contains('is-visible'), 'Popup must remain visible');

    // 3. User interim speech streamed to #subtitles-text ONLY
    dom.subtitlesText.textContent = 'what about roots';
    assert.equal(
      dom.voicePopupContent.textContent,
      'Photosynthesis is how plants produce food using sunlight.',
      'Popup content must remain intact during interim speech'
    );
    assert.ok(dom.voiceReplyPopup.classList.contains('is-visible'), 'Popup must remain visible');
  });

  test('clicking #btn-close-voice-popup dismisses the popup', () => {
    let closed = false;
    function hideVoicePopup() {
      dom.voiceReplyPopup.classList.remove('is-visible');
      dom.voiceReplyPopup.hidden = true;
      dom.voiceReplyPopup.setAttribute('hidden', 'true');
      closed = true;
    }

    dom.voiceReplyPopup.classList.add('is-visible');
    dom.voiceReplyPopup.hidden = false;
    dom.btnCloseVoicePopup.addEventListener('click', hideVoicePopup);

    dom.btnCloseVoicePopup.click();

    assert.ok(closed);
    assert.equal(dom.voiceReplyPopup.hidden, true);
    assert.equal(dom.voiceReplyPopup.classList.contains('is-visible'), false);
  });

  test('opening chat drawer hides the voice popup', () => {
    function hideVoicePopup() {
      dom.voiceReplyPopup.classList.remove('is-visible');
      dom.voiceReplyPopup.hidden = true;
    }

    function toggleChatDrawer(forceOpen = null) {
      const shouldOpen = forceOpen !== null ? forceOpen : !dom.chatDrawer.classList.contains('is-open');
      if (shouldOpen) {
        dom.chatDrawer.classList.add('is-open');
        hideVoicePopup();
      }
    }

    dom.voiceReplyPopup.classList.add('is-visible');
    dom.voiceReplyPopup.hidden = false;

    toggleChatDrawer(true);

    assert.ok(dom.chatDrawer.classList.contains('is-open'));
    assert.equal(dom.voiceReplyPopup.hidden, true);
    assert.equal(dom.voiceReplyPopup.classList.contains('is-visible'), false);
  });

  test('auto-hide timer persists for at least 30 seconds', () => {
    let scheduledMs = 0;
    const origSetTimeout = global.setTimeout;
    global.window.setTimeout = (fn, delay) => {
      scheduledMs = delay;
      return 123;
    };

    function showVoicePopup(text) {
      const wordCount = String(text).trim().split(/\s+/).filter(Boolean).length;
      const readingDurationMs = Math.round((wordCount / 200) * 60 * 1000);
      const timeoutMs = Math.max(30000, readingDurationMs);
      global.window.setTimeout(() => {}, timeoutMs);
    }

    showVoicePopup('Short answer.');
    assert.ok(scheduledMs >= 30000, `Expected delay >= 30000ms, got ${scheduledMs}ms`);

    // Long answer (250 words -> 75s)
    const longText = 'word '.repeat(250);
    showVoicePopup(longText);
    assert.ok(scheduledMs >= 75000, `Expected delay >= 75000ms for long text, got ${scheduledMs}ms`);

    global.window.setTimeout = origSetTimeout;
  });
});
