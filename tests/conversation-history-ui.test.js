const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Require chat-history controller module
const { ChatHistoryController } = require('../frontend/chat-history.js');

function createMockElement(tag = 'div', id = '') {
  return {
    tagName: tag.toUpperCase(),
    id,
    className: '',
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); },
      toggle(c, force) {
        if (force === undefined) {
          if (this.contains(c)) this.remove(c); else this.add(c);
        } else if (force) {
          this.add(c);
        } else {
          this.remove(c);
        }
      }
    },
    hidden: false,
    innerHTML: '',
    textContent: '',
    children: [],
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k]; },
    hasAttribute(k) { return k in this.attributes; },
    removeAttribute(k) { delete this.attributes[k]; },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    _listeners: {},
    addEventListener(event, fn) {
      this._listeners[event] = this._listeners[event] || [];
      this._listeners[event].push(fn);
    },
    click() {
      const handlers = this._listeners['click'] || [];
      for (const handler of handlers) handler({ preventDefault() {} });
    }
  };
}

function makeController(options = {}) {
  const conversations = options.conversations || [];
  const messages = options.messages || [];

  let activeSession = options.session !== undefined
    ? options.session
    : { accessToken: 'test-token', childId: 'child-1' };

  const backendClient = {
    async listConversations({ accessToken, childId }) {
      if (options.listError) return { error: 'server_error', message: 'Failed to list' };
      return { conversations };
    },
    async getConversationMessages({ accessToken, childId, conversationId }) {
      if (options.messagesError) return { error: 'server_error', message: 'Failed to get messages' };
      return { messages };
    },
    async createConversation({ accessToken, childId, firstMessage }) {
      return { conversation: { id: 'c-new', title: firstMessage || 'New chat' } };
    },
    async deleteConversation({ accessToken, childId, conversationId }) {
      return { success: true };
    },
    async clearConversations({ accessToken, childId }) {
      return { success: true };
    }
  };

  const chatAgent = {
    messages: [],
    replaceMessages(msgs) {
      this.messages = msgs.map(m => ({
        id: m.id,
        sender: m.role === 'user' ? 'user' : 'appu',
        text: m.text,
        hasImageAttachment: Boolean(m.hasImageAttachment),
        attachmentLabel: m.hasImageAttachment ? 'Photo attached' : null,
        imageDataUrl: null,
        time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
      }));
    },
    clearHistory() {
      this.messages = [];
    }
  };

  const elements = {
    panel: createMockElement('section', 'chat-history-panel'),
    list: createMockElement('div', 'chat-history-list'),
    empty: createMockElement('p', 'chat-history-empty'),
    error: createMockElement('p', 'chat-history-error'),
    btnOpen: createMockElement('button', 'btn-chat-history'),
    btnClose: createMockElement('button', 'btn-close-chat-history'),
    btnNew: createMockElement('button', 'btn-new-chat'),
    btnClearAll: createMockElement('button', 'btn-clear-all-history')
  };

  const controller = new ChatHistoryController({
    backendClient,
    chatAgent,
    getSession: () => activeSession,
    elements
  });

  return {
    controller,
    backendClient,
    chatAgent,
    elements,
    setSession(s) { activeSession = s; }
  };
}

describe('ChatHistoryController Unit & Integration Tests', () => {
  test('signed-in learner lists and opens an owned conversation', async () => {
    const { controller, chatAgent } = makeController({
      conversations: [{ id: 'c1', title: 'Fractions practice', updatedAt: '2026-09-04T07:00:00.000Z' }],
      messages: [{ id: 'm1', role: 'user', text: 'Explain halves', hasImageAttachment: false, createdAt: '2026-09-04T07:00:00.000Z' }]
    });

    await controller.refresh();
    assert.equal(controller.conversations.length, 1);
    assert.equal(controller.conversations[0].id, 'c1');

    await controller.openConversation('c1');
    assert.equal(controller.activeConversationId, 'c1');
    assert.equal(chatAgent.messages.length, 1);
    assert.equal(chatAgent.messages[0].text, 'Explain halves');
  });

  test('switching child clears active conversation before loading new history', async () => {
    const { controller } = makeController({
      conversations: [{ id: 'c1', title: 'Chat for A', updatedAt: '2026-09-04T07:00:00.000Z' }]
    });

    controller.activeChildId = 'child-a';
    controller.activeConversationId = 'conversation-a';

    await controller.syncSession({ accessToken: 'token', childId: 'child-b' });
    assert.equal(controller.activeConversationId, null);
    assert.equal(controller.activeChildId, 'child-b');
  });

  test('restored image message renders attachment marker without retained image bytes', async () => {
    const { controller, chatAgent } = makeController({
      conversations: [{ id: 'c1', title: 'Homework check', updatedAt: '2026-09-04T07:00:00.000Z' }],
      messages: [{ id: 'm1', role: 'user', text: 'Help me', hasImageAttachment: true, createdAt: '2026-09-04T07:00:00.000Z' }]
    });

    await controller.openConversation('c1');
    assert.equal(chatAgent.messages[0].attachmentLabel, 'Photo attached');
    assert.equal(chatAgent.messages[0].imageDataUrl, null);
  });

  test('startNewConversation clears active conversation and resets chat', async () => {
    const { controller, chatAgent } = makeController({
      conversations: [{ id: 'c1', title: 'Old chat' }],
      messages: [{ id: 'm1', role: 'user', text: 'Old message' }]
    });

    await controller.openConversation('c1');
    assert.equal(controller.activeConversationId, 'c1');
    assert.equal(chatAgent.messages.length, 1);

    controller.startNewConversation();
    assert.equal(controller.activeConversationId, null);
    assert.equal(chatAgent.messages.length, 0);
  });

  test('guest session hides history button and closes panel', async () => {
    const { controller, elements } = makeController({
      session: { accessToken: null, childId: null }
    });

    await controller.syncSession({ accessToken: null, childId: null });
    assert.equal(elements.btnOpen.hidden, true);
    assert.equal(elements.panel.hidden, true);
    assert.equal(controller.activeConversationId, null);
  });

  test('forceNewConversation flag transitions correctly on startNewConversation and adoptConversationId', () => {
    const { controller } = makeController();
    assert.equal(controller.getForceNewConversation(), false, 'initially false');

    controller.startNewConversation();
    assert.equal(controller.getForceNewConversation(), true, 'true after startNewConversation');

    controller.adoptConversationId('c-test-123');
    assert.equal(controller.getForceNewConversation(), false, 'cleared to false after adoptConversationId');
    assert.equal(controller.getActiveConversationId(), 'c-test-123');
  });

  test('ChatAgent sends newConversation: true only when forceNewConversation is true and no activeConversationId', async () => {
    const elements = new Map();
    const mockEl = (id) => ({ id, className: '', children: [], appendChild() {}, style: {}, setAttribute() {} });
    elements.set('chat-messages', mockEl('chat-messages'));
    elements.set('chat-typing', mockEl('chat-typing'));
    global.document = {
      getElementById(id) { return elements.get(id) || null; },
      createElement(tag) { return mockEl(tag); }
    };
    let sentPayload = null;
    global.window = {
      document: global.document,
      AppuSession: {
        isAuthenticated: () => true,
        accessToken: 'valid-test-token',
        childId: 'c1234567-0000-0000-0000-000000000001'
      },
      AppuBackendClient: {
        async sendAppuMessage(payload) {
          sentPayload = payload;
          return { text: 'Hello!', conversationId: 'conv-assigned-456' };
        }
      }
    };

    const { ChatAgent } = require('../frontend/chat-agent.js');
    const { controller } = makeController();

    const agent = new ChatAgent({
      getConversationId: () => controller.getActiveConversationId(),
      getForceNewConversation: () => controller.getForceNewConversation(),
      onConversationAssigned: (id) => controller.adoptConversationId(id)
    });

    // 1. Initial state: forceNewConversation is false, activeConversationId is null
    assert.equal(controller.getForceNewConversation(), false);
    assert.equal(controller.getActiveConversationId(), null);

    // 2. User clicks New Chat:
    controller.startNewConversation();
    assert.equal(controller.getForceNewConversation(), true);

    // 3. User sends first message after New Chat:
    await agent.sendMessage('Explain photosynthesis');
    assert.ok(sentPayload, 'Payload should have been sent');
    assert.equal(sentPayload.newConversation, true, 'newConversation: true must be included in payload');
    assert.equal(sentPayload.conversationId, undefined, 'conversationId must NOT be included');

    // 4. On response, conversationId was assigned and adopted:
    assert.equal(controller.getActiveConversationId(), 'conv-assigned-456');
    assert.equal(controller.getForceNewConversation(), false, 'forceNewConversation should be cleared after adopting id');

    // 5. Subsequent message sends conversationId and omits newConversation:
    sentPayload = null;
    await agent.sendMessage('Tell me more');
    assert.ok(sentPayload);
    assert.equal(sentPayload.conversationId, 'conv-assigned-456', 'conversationId must match active conversation');
    assert.equal(sentPayload.newConversation, undefined, 'newConversation must be undefined/omitted');
  });

  test('AppuBackendClient forwards newConversation: true for authenticated payload', async () => {
    let capturedBody = null;
    const originalFetch = global.fetch;
    global.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        headers: new Map(),
        json: async () => ({ text: 'ok', conversationId: 'c-123' })
      };
    };

    const AppuBackendClient = require('../frontend/appu-backend-client.js');
    try {
      await AppuBackendClient.sendAppuMessage({
        accessToken: 'tok',
        childId: 'c1234567-0000-0000-0000-000000000001',
        message: 'Hello',
        newConversation: true
      });

      assert.ok(capturedBody);
      assert.equal(capturedBody.newConversation, true, 'AppuBackendClient must forward newConversation flag in body');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
