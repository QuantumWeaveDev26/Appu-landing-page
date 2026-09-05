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

  test('UI copy / title clearly communicates that it opens WhatsApp on this device to send TO parent', () => {
    const agent = new ChatAgent();
    agent.clearHistory();

    agent.addMessage('appu', 'Here is a quick concept recap on Newton laws of motion.');
    const container = dom.elements.get('chat-messages');
    const shareBtn = container.querySelector('.btn-share-whatsapp');

    assert.ok(shareBtn);
    const combinedText = (shareBtn.textContent + ' ' + (shareBtn.getAttribute('title') || '') + ' ' + (shareBtn.getAttribute('aria-label') || '')).toLowerCase();
    
    // Explicit sender semantics: sends TO parent
    assert.match(combinedText, /parent/, 'Must reference parent');
    assert.match(combinedText, /whatsapp/, 'Must reference WhatsApp');
    // Clearly conveys user sending to parent (e.g. "Send note to Parent WhatsApp", "Opens your WhatsApp")
    assert.ok(
      combinedText.includes('parent') && (combinedText.includes('send') || combinedText.includes('share')),
      'Must clearly communicate sending/sharing note to parent'
    );
  });

  test('when parent WhatsApp is consented, clicking generates a clean wa.me/<parentPhone>?text= link', async () => {
    global.window.AppuSession.setSession({
      accessToken: 'test-token',
      childId: 'child-123',
      parentContext: {
        parentPhone: '+919876543210',
        whatsappConsent: true,
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
    assert.ok(openedUrl.startsWith('https://wa.me/919876543210?text='), `URL must start with https://wa.me/919876543210?text=, got: ${openedUrl}`);
    assert.ok(openedUrl.includes('Gravity'), 'Text must contain the explained concept');
  });

  test('when parent WhatsApp is NOT consented, clicking shows an informative prompt to enable in settings', async () => {
    global.window.AppuSession.setSession({
      accessToken: 'test-token',
      childId: 'child-123',
      parentContext: {
        parentPhone: '+919876543210',
        whatsappConsent: false // Consent NOT given
      }
    });

    let promptMessage = '';
    global.window.alert = (msg) => { promptMessage = msg; };
    global.window.ParentSetupUI = {
      openModal(step) {
        promptMessage = `Parent setup opened at step ${step}`;
      }
    };

    const agent = new ChatAgent();
    agent.clearHistory();

    agent.addMessage('appu', 'Water boils at 100 degrees Celsius at standard atmospheric pressure.');
    const container = dom.elements.get('chat-messages');
    const shareBtn = container.querySelector('.btn-share-whatsapp');

    await shareBtn.dispatchEvent({ type: 'click' });

    assert.equal(global.window.getOpenedUrl(), null, 'Must NOT open wa.me link when consent is false');
    assert.ok(promptMessage.length > 0, 'Must show a friendly prompt or modal directing parent to connect WhatsApp');
  });

  test('shared note sanitization: internal tags stripped, trimmed under 500 chars, no image bytes', () => {
    const rawExplanation = '<think>internal reasoning</think><action>eval</action><b>Mitosis</b> is the process of cell division where a single cell divides into two identical daughter cells. '.repeat(10) + 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    const url = AppuBackendClient.buildWhatsAppShareUrl('+919876543210', rawExplanation, 'Vihaan');
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
