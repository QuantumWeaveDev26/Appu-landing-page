const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// Minimal DOM mock setup for ChatAgent and note-share affordance tests
function setupChatDomMock() {
  const listeners = new Map();
  const elements = new Map();

  function createElement(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      id: '',
      className: '',
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); el.className = Array.from(this._classes).join(' '); },
        remove(c) { this._classes.delete(c); el.className = Array.from(this._classes).join(' '); },
        contains(c) { return this._classes.has(c); }
      },
      style: {},
      attributes: {},
      setAttribute(k, v) { this.attributes[k] = v; },
      getAttribute(k) { return this.attributes[k]; },
      value: '',
      _textContent: undefined,
      get textContent() {
        if (this._textContent !== undefined) return this._textContent;
        if (this.children && this.children.length > 0) {
          return this.children.map(c => c.textContent || '').join(' ');
        }
        if (this.innerHTML) {
          return this.innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
        return '';
      },
      set textContent(v) {
        this._textContent = v;
      },
      innerHTML: '',
      disabled: false,
      children: [],
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      querySelector(sel) {
        return this.querySelectorAll(sel)[0] || null;
      },
      querySelectorAll(sel) {
        const found = [];
        function walk(node) {
          if (sel.startsWith('.') && node.className && node.className.includes(sel.slice(1))) {
            found.push(node);
          }
          if (node.children) {
            for (const c of node.children) walk(c);
          }
        }
        walk(this);
        return found;
      },
      addEventListener(evt, handler) {
        const list = listeners.get(`${el.id || el.className}:${evt}`) || [];
        list.push(handler);
        listeners.set(`${el.id || el.className}:${evt}`, list);
      },
      async dispatchEvent(evt) {
        if (el.onclick) {
          await el.onclick(evt);
        }
        const list = listeners.get(`${el.id || el.className}:${evt.type}`) || [];
        for (const fn of list) {
          await fn(evt);
        }
      }
    };
    return el;
  }

  const messagesContainer = createElement('div');
  messagesContainer.id = 'chat-messages';
  elements.set('chat-messages', messagesContainer);

  const typingIndicator = createElement('div');
  typingIndicator.id = 'chat-typing';
  elements.set('chat-typing', typingIndicator);

  global.document = {
    getElementById(id) {
      return elements.get(id) || null;
    },
    createElement(tag) {
      return createElement(tag);
    }
  };

  let openedUrl = null;
  global.window = {
    document: global.document,
    open(url) {
      openedUrl = url;
    },
    getOpenedUrl() {
      return openedUrl;
    },
    clearOpenedUrl() {
      openedUrl = null;
    }
  };

  return { elements, listeners };
}

describe('In-Chat "Share study note to parent WhatsApp" Affordance', () => {
  let dom;
  let ChatAgent;
  let AppuBackendClient;

  beforeEach(() => {
    dom = setupChatDomMock();

    // Reset caches and require modules
    delete require.cache[require.resolve('../frontend/appu-backend-client.js')];
    delete require.cache[require.resolve('../frontend/chat-agent.js')];
    delete require.cache[require.resolve('../frontend/appu-session.js')];

    AppuBackendClient = require('../frontend/appu-backend-client.js');
    const { ChatAgent: AgentClass } = require('../frontend/chat-agent.js');
    ChatAgent = AgentClass;
    global.window.AppuBackendClient = AppuBackendClient;
    global.window.AppuSession = require('../frontend/appu-session.js');
  });

  afterEach(() => {
    global.window.clearOpenedUrl();
    global.window.AppuSession.clear();
  });

  test('after an assistant explanation turn, a .btn-share-whatsapp affordance is rendered', () => {
    const agent = new ChatAgent();
    agent.clearHistory();

    const msg = agent.addMessage('appu', 'Photosynthesis is the process by which green plants convert sunlight into chemical energy.');
    const container = dom.elements.get('chat-messages');

    const shareBtn = container.querySelector('.btn-share-whatsapp');
    assert.ok(shareBtn, '.btn-share-whatsapp button must be present on assistant explanation message');
  });

  test('UI copy / title clearly communicates sending note via WhatsApp', () => {
    const agent = new ChatAgent();
    agent.clearHistory();

    agent.addMessage('appu', 'Here is a quick concept recap on Newton laws of motion.');
    const container = dom.elements.get('chat-messages');
    const shareBtn = container.querySelector('.btn-share-whatsapp');

    assert.ok(shareBtn);
    const combinedText = (shareBtn.textContent + ' ' + (shareBtn.getAttribute('title') || '') + ' ' + (shareBtn.getAttribute('aria-label') || '')).toLowerCase();
    
    assert.match(combinedText, /whatsapp/, 'Must reference WhatsApp');
    assert.match(combinedText, /send|share/, 'Must reference send or share');
    assert.ok(
      shareBtn.textContent.includes('Send note to WhatsApp'),
      `Button copy must be "Send note to WhatsApp", got: "${shareBtn.textContent}"`
    );
  });

  test('clicking generates a clean wa.me/919740595677?text= link without requiring parent consent or phone', async () => {
    global.window.AppuSession.setSession({
      accessToken: 'test-token',
      childId: 'child-123',
      parentContext: {
        parentPhone: null,
        whatsappConsent: false,
        childName: 'Aarav'
      }
    });

    const agent = new ChatAgent();
    agent.clearHistory();

    agent.addMessage('appu', 'Gravity is the invisible force that pulls objects toward each other.');
    const container = dom.elements.get('chat-messages');
    const shareBtn = container.querySelector('.btn-share-whatsapp');

    assert.ok(shareBtn);
    await shareBtn.dispatchEvent({ type: 'click' });

    const openedUrl = global.window.getOpenedUrl();
    assert.ok(openedUrl, 'Clicking must open a WhatsApp link');
    assert.ok(openedUrl.startsWith('https://wa.me/919740595677?text='), `URL must start with https://wa.me/919740595677?text=, got: ${openedUrl}`);
    assert.ok(openedUrl.includes('Gravity'), 'Text must contain the explained concept');
  });

  test('clicking does NOT trigger modal 4 or alert when parent consent is absent or unauthenticated', async () => {
    global.window.AppuSession.clear();

    let modalOpened = false;
    let alertShown = false;
    global.window.alert = () => { alertShown = true; };
    global.window.ParentSetupUI = {
      openModal() {
        modalOpened = true;
      }
    };

    const agent = new ChatAgent();
    agent.clearHistory();

    agent.addMessage('appu', 'Water boils at 100 degrees Celsius at standard atmospheric pressure.');
    const container = dom.elements.get('chat-messages');
    const shareBtn = container.querySelector('.btn-share-whatsapp');

    await shareBtn.dispatchEvent({ type: 'click' });

    assert.equal(modalOpened, false, 'Must NOT open modal 4');
    assert.equal(alertShown, false, 'Must NOT show alert');
    const openedUrl = global.window.getOpenedUrl();
    assert.ok(openedUrl, 'Must open wa.me link directly');
    assert.ok(openedUrl.startsWith('https://wa.me/919740595677?text='), `URL must target 919740595677, got: ${openedUrl}`);
  });

  test('buildWhatsAppShareUrl defaults to 919740595677 and cleans non-digits', () => {
    const urlDefault = AppuBackendClient.buildWhatsAppShareUrl(undefined, 'Test note', 'Vihaan');
    assert.ok(urlDefault, 'Must build URL with default phone');
    assert.ok(urlDefault.startsWith('https://wa.me/919740595677?text='), `Default URL must target 919740595677, got: ${urlDefault}`);

    const urlFormatted = AppuBackendClient.buildWhatsAppShareUrl('+91 97405 95677', 'Test note', 'Vihaan');
    assert.ok(urlFormatted);
    assert.ok(urlFormatted.startsWith('https://wa.me/919740595677?text='), `Formatted phone URL must target 919740595677, got: ${urlFormatted}`);
  });

  test('shared note sanitization: internal tags stripped, trimmed under 500 chars, no image bytes', () => {
    const rawExplanation = '<think>internal reasoning</think><action>eval</action><b>Mitosis</b> is the process of cell division where a single cell divides into two identical daughter cells. '.repeat(10) + 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    const url = AppuBackendClient.buildWhatsAppShareUrl('919740595677', rawExplanation, 'Vihaan');
    assert.ok(url);

    const parsed = new URL(url);
    const textParam = parsed.searchParams.get('text');

    assert.ok(textParam.length < 500, `Shared text length (${textParam.length}) must be strictly under 500 characters`);
    assert.ok(!textParam.includes('<think>'), 'Must strip <think> tag');
    assert.ok(!textParam.includes('internal reasoning'), 'Must strip internal reasoning content');
    assert.ok(!textParam.includes('data:image'), 'Must NEVER include data:image bytes');
    assert.ok(!textParam.includes('base64'), 'Must NEVER include base64 bytes');
    assert.ok(textParam.includes('Mitosis'), 'Must preserve educational explanation content');
  });
});
