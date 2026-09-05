/**
 * ChatHistoryController: Shared In-Memory Conversation History Controller
 *
 * Coordinates child-scoped conversation threads, recent chat list rendering,
 * and seamless thread restoration across web and mobile surfaces.
 *
 * SECURITY INVARIANTS:
 * - Conversation state is kept in-memory only (NEVER localStorage/sessionStorage).
 * - History button and panel are strictly hidden for unauthenticated/guest sessions.
 * - Switching child clears active conversation and thread list immediately.
 * - Access token and childId are scoped to active AppuSession.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  }
  if (root) {
    const exports = factory();
    root.ChatHistoryController = exports.ChatHistoryController;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createElement(tag, className, textContent) {
    if (typeof document !== 'undefined' && document.createElement) {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (textContent) el.textContent = textContent;
      return el;
    }
    return {
      tagName: tag.toUpperCase(),
      className: className || '',
      textContent: textContent || '',
      children: [],
      attributes: {},
      setAttribute(k, v) { this.attributes[k] = String(v); },
      getAttribute(k) { return this.attributes[k]; },
      hasAttribute(k) { return k in this.attributes; },
      removeAttribute(k) { delete this.attributes[k]; },
      appendChild(child) { this.children.push(child); return child; },
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

  class ChatHistoryController {
    constructor(options = {}) {
      this.backendClient = options.backendClient || null;
      this.chatAgent = options.chatAgent || null;
      this.getSession = typeof options.getSession === 'function' ? options.getSession : (() => null);
      this.elements = options.elements || {};

      this.activeConversationId = null;
      this.activeChildId = null;
      this.accessToken = null;
      this.conversations = [];

      const initialSession = this.getSession();
      if (initialSession && initialSession.accessToken && initialSession.childId) {
        this.accessToken = initialSession.accessToken;
        this.activeChildId = initialSession.childId;
      }

      if (this.elements.btnOpen) {
        this.elements.btnOpen.hidden = !Boolean(this.accessToken && this.activeChildId);
        this.elements.btnOpen.addEventListener('click', () => {
          if (this.elements.panel) {
            const isHidden = Boolean(this.elements.panel.hidden);
            this.elements.panel.hidden = !isHidden;
            if (!this.elements.panel.hidden) {
              this.refresh().catch(() => {});
            }
          }
        });
      }

      if (this.elements.panel) {
        this.elements.panel.hidden = true;
      }

      if (this.elements.btnClose) {
        this.elements.btnClose.addEventListener('click', () => {
          if (this.elements.panel) {
            this.elements.panel.hidden = true;
          }
        });
      }

      if (this.elements.btnNew) {
        this.elements.btnNew.addEventListener('click', () => {
          this.startNewConversation();
        });
      }

      if (this.elements.btnClearAll) {
        this.elements.btnClearAll.addEventListener('click', () => {
          const ok = (typeof window !== 'undefined' && typeof window.confirm === 'function')
            ? window.confirm('Clear all conversation history for this learner?')
            : true;
          if (ok) {
            this.clearAll().catch(() => {});
          }
        });
      }
    }

    getActiveConversationId() {
      return this.activeConversationId || null;
    }

    adoptConversationId(conversationId) {
      if (!conversationId) return;
      this.activeConversationId = conversationId;
      this.refresh().catch(() => {});
    }

    async syncSession(session) {
      const nextToken = session?.accessToken || null;
      const nextChildId = session?.childId || null;

      if (nextChildId !== this.activeChildId) {
        this.activeConversationId = null;
        this.conversations = [];
      }

      this.accessToken = nextToken;
      this.activeChildId = nextChildId;

      if (!nextToken || !nextChildId) {
        this.activeConversationId = null;
        this.conversations = [];
        if (this.elements.btnOpen) this.elements.btnOpen.hidden = true;
        if (this.elements.panel) this.elements.panel.hidden = true;
        this.renderList();
        return;
      }

      if (this.elements.btnOpen) this.elements.btnOpen.hidden = false;
      await this.refresh();
    }

    async refresh() {
      const session = this.getSession();
      const accessToken = session?.accessToken || this.accessToken;
      const childId = session?.childId || this.activeChildId;

      if (!accessToken || !childId) {
        this.conversations = [];
        this.renderList();
        return { conversations: [] };
      }

      if (this.elements.error) this.elements.error.hidden = true;

      if (this.backendClient && typeof this.backendClient.listConversations === 'function') {
        try {
          const res = await this.backendClient.listConversations({ accessToken, childId });
          if (res && res.error) {
            if (this.elements.error) this.elements.error.hidden = false;
            return res;
          }
          this.conversations = Array.isArray(res.conversations) ? res.conversations : [];
          this.renderList();
          return res;
        } catch (err) {
          if (this.elements.error) this.elements.error.hidden = false;
          return { error: 'request_failed', message: err?.message || 'Failed to list conversations' };
        }
      }
      return { conversations: [] };
    }

    startNewConversation() {
      this.activeConversationId = null;
      if (this.chatAgent) {
        if (typeof this.chatAgent.clearHistory === 'function') {
          this.chatAgent.clearHistory();
        } else {
          this.chatAgent.messages = [];
        }
      }
      this.renderList();
      if (this.elements.panel && typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth <= 640) {
        this.elements.panel.hidden = true;
      }
    }

    async openConversation(conversationId) {
      const session = this.getSession();
      const accessToken = session?.accessToken || this.accessToken;
      const childId = session?.childId || this.activeChildId;

      if (!accessToken || !childId || !conversationId) return;

      if (this.elements.error) this.elements.error.hidden = true;

      if (this.backendClient && typeof this.backendClient.getConversationMessages === 'function') {
        try {
          const res = await this.backendClient.getConversationMessages({ accessToken, childId, conversationId });
          if (res && res.error) {
            if (this.elements.error) this.elements.error.hidden = false;
            return res;
          }
          this.activeConversationId = conversationId;
          if (this.chatAgent && typeof this.chatAgent.replaceMessages === 'function') {
            this.chatAgent.replaceMessages(res.messages || []);
          }
          this.renderList();
          if (this.elements.panel && typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth <= 640) {
            this.elements.panel.hidden = true;
          }
          return res;
        } catch (err) {
          if (this.elements.error) this.elements.error.hidden = false;
          return { error: 'request_failed', message: err?.message || 'Failed to get messages' };
        }
      }
    }

    async deleteConversation(conversationId) {
      const session = this.getSession();
      const accessToken = session?.accessToken || this.accessToken;
      const childId = session?.childId || this.activeChildId;

      if (!accessToken || !childId || !conversationId) return;

      if (this.backendClient && typeof this.backendClient.deleteConversation === 'function') {
        try {
          const res = await this.backendClient.deleteConversation({ accessToken, childId, conversationId });
          if (res && res.error) {
            if (this.elements.error) this.elements.error.hidden = false;
            return res;
          }
          this.conversations = this.conversations.filter(c => c.id !== conversationId);
          if (this.activeConversationId === conversationId) {
            this.startNewConversation();
          } else {
            this.renderList();
          }
          return res;
        } catch (err) {
          if (this.elements.error) this.elements.error.hidden = false;
          return { error: 'request_failed', message: err?.message || 'Failed to delete conversation' };
        }
      }
    }

    async clearAll() {
      const session = this.getSession();
      const accessToken = session?.accessToken || this.accessToken;
      const childId = session?.childId || this.activeChildId;

      if (!accessToken || !childId) return;

      if (this.backendClient && typeof this.backendClient.clearConversations === 'function') {
        try {
          const res = await this.backendClient.clearConversations({ accessToken, childId });
          if (res && res.error) {
            if (this.elements.error) this.elements.error.hidden = false;
            return res;
          }
          this.conversations = [];
          this.startNewConversation();
          this.renderList();
          return res;
        } catch (err) {
          if (this.elements.error) this.elements.error.hidden = false;
          return { error: 'request_failed', message: err?.message || 'Failed to clear conversations' };
        }
      }
    }

    renderList() {
      if (!this.elements.list) return;

      if (typeof this.elements.list.innerHTML === 'string') {
        this.elements.list.innerHTML = '';
      }
      if (Array.isArray(this.elements.list.children)) {
        this.elements.list.children.length = 0;
      }

      const hasItems = this.conversations && this.conversations.length > 0;
      if (this.elements.empty) {
        this.elements.empty.hidden = hasItems;
      }

      if (!hasItems) return;

      for (const c of this.conversations) {
        const isActive = c.id === this.activeConversationId;
        const itemEl = createElement('div', 'chat-history-item' + (isActive ? ' is-active' : ''));
        if (itemEl.setAttribute) {
          itemEl.setAttribute('data-id', c.id);
        }

        const itemBtn = createElement('button', 'chat-history-item-btn');
        if (itemBtn.setAttribute) {
          itemBtn.setAttribute('type', 'button');
          itemBtn.setAttribute('title', c.title || 'Untitled conversation');
        }

        const titleSpan = createElement('span', 'chat-history-item-title', c.title || 'Untitled conversation');
        itemBtn.appendChild(titleSpan);

        itemBtn.addEventListener('click', () => {
          this.openConversation(c.id).catch(() => {});
        });

        const deleteBtn = createElement('button', 'chat-history-item-delete');
        if (deleteBtn.setAttribute) {
          deleteBtn.setAttribute('type', 'button');
          deleteBtn.setAttribute('aria-label', `Delete conversation: ${c.title || 'Untitled'}`);
          deleteBtn.setAttribute('title', 'Delete conversation');
        }
        if (typeof document !== 'undefined' && document.createElement) {
          deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>';
        }

        deleteBtn.addEventListener('click', (e) => {
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          const ok = (typeof window !== 'undefined' && typeof window.confirm === 'function')
            ? window.confirm(`Delete conversation "${c.title || 'Untitled'}" for this learner?`)
            : true;
          if (ok) {
            this.deleteConversation(c.id).catch(() => {});
          }
        });

        itemEl.appendChild(itemBtn);
        itemEl.appendChild(deleteBtn);
        this.elements.list.appendChild(itemEl);
      }
    }
  }

  return { ChatHistoryController };
});
