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
});
