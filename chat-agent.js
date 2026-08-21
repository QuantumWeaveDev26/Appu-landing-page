/**
 * ChatAgent: Real-Time n8n Webhook Connector (WebSocket + Async Executions) & AI Mentor Engine
 */

class ChatAgent {
  constructor(options = {}) {
    // Exact user n8n webhook URL
    this.n8nWebhookUrl = options.n8nWebhookUrl || 'https://n8n.srv1871828.hstgr.cloud/webhook/4a108e85-050f-427e-aa03-784492ddfe89/chat';
    this.mockMode = false; // Always LIVE workflow
    this.sessionId = localStorage.getItem('appu_session_id') || ('appu_session_' + Math.random().toString(36).substring(2, 9));
    localStorage.setItem('appu_session_id', this.sessionId);

    this.messages = [];
    this.messagesContainer = document.getElementById('chat-messages');
    this.typingIndicator = document.getElementById('chat-typing');

    this.initDefaultWelcome();
  }

  initDefaultWelcome() {
    this.addMessage('appu', 'Namaskara! 🙏 I am Appu, your learning companion. Tell me your class and what you want to understand today!');
  }

  addMessage(sender, text, actionCard = null) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgObj = { sender, text, time: timeStr, actionCard };
    this.messages.push(msgObj);
    this.renderMessage(msgObj);
    return msgObj;
  }

  renderMessage(msg) {
    if (!this.messagesContainer) return;

    const row = document.createElement('div');
    row.className = `message-row ${msg.sender}`;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = msg.text;

    // Optional interactive card inside bubble
    if (msg.actionCard) {
      const card = document.createElement('div');
      card.className = 'chat-action-card';

      const title = document.createElement('h5');
      title.innerHTML = `<i class="fa-solid fa-calendar-check"></i> ${msg.actionCard.title}`;
      card.appendChild(title);

      const btn = document.createElement('button');
      btn.className = 'chat-action-card-btn';
      btn.innerHTML = `<span>${msg.actionCard.buttonText}</span> <i class="fa-solid fa-arrow-right"></i>`;
      btn.onclick = msg.actionCard.onClick;
      card.appendChild(btn);

      bubble.appendChild(card);
    }

    const time = document.createElement('span');
    time.className = 'msg-time';
    time.textContent = msg.time;

    row.appendChild(bubble);
    row.appendChild(time);
    this.messagesContainer.appendChild(row);

    // Auto-scroll to bottom
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  /**
   * Sends user message to live n8n workflow and awaits response via WebSocket or polling
   */
  async sendMessage(userText, onStartThinking, onFinishThinking) {
    if (!userText || !userText.trim()) return null;

    const cleanInput = userText.trim();
    // Render User Message in Chat Drawer
    this.addMessage('user', cleanInput);

    if (onStartThinking) onStartThinking();
    if (this.typingIndicator) this.typingIndicator.style.display = 'flex';

    this.mockMode = false;

    try {
      let responseText = '';
      let actionCard = null;
      let audioSource = null;

      // =========================================================================
      // TRANSPORT ADAPTER ROUTING:
      // When an authenticated AppuSession is present, route via the secure backend
      // gateway (POST /api/appu/message).
      // Otherwise, fallback to the direct n8n webhook (LEGACY_PHASE1_DIRECT_N8N).
      // =========================================================================
      const hasSecureSession =
        typeof window !== 'undefined' &&
        window.AppuSession &&
        typeof window.AppuSession.isAuthenticated === 'function' &&
        window.AppuSession.isAuthenticated() &&
        window.AppuBackendClient &&
        typeof window.AppuBackendClient.sendAppuMessage === 'function';

      if (hasSecureSession) {
        // SECURE PHASE 2 BACKEND GATEWAY TRANSPORT
        const result = await window.AppuBackendClient.sendAppuMessage({
          accessToken: window.AppuSession.accessToken,
          childId: window.AppuSession.childId,
          message: cleanInput,
          language: this.language || 'en'
        });

        responseText = result.text;
        audioSource = result.audioSource;
      } else {
        // LEGACY_PHASE1_DIRECT_N8N:
        // Remove after final parent authentication/onboarding UI is connected to AppuSession.
        const res = await fetch(this.n8nWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'sendMessage',
            sessionId: this.sessionId,
            chatInput: cleanInput,
            message: cleanInput
          })
        });

        if (!res.ok) {
          throw new Error(`n8n HTTP error: ${res.status} ${res.statusText}`);
        }

        const rawText = await res.text();
        try {
          const parsed = JSON.parse(rawText);
          const normalized = window.AppuVoiceContract.normalizeResponse(parsed);
          responseText = normalized.text;
          audioSource = normalized.audioSource;
        } catch {
          responseText = rawText;
        }
      }

      // Clean formatted \n characters so line breaks render properly
      if (typeof responseText === 'string') {
        responseText = responseText.replace(/\\n/g, '\n');
      }

      if (!responseText || !responseText.trim()) {
        responseText = "I received your message, but the workflow returned an empty output. Please verify your n8n Respond to Webhook node.";
      }

      // Detect if response invites scheduling a discovery call
      if (responseText.toLowerCase().includes('discovery call') || 
          responseText.toLowerCase().includes('google meet') || 
          responseText.toLowerCase().includes('schedule') ||
          cleanInput.toLowerCase().includes('schedule') ||
          cleanInput.toLowerCase().includes('discovery')) {
        actionCard = {
          title: 'Parent Zone',
          buttonText: 'Plan a learning support call',
          onClick: () => window.app.openDiscoveryModal()
        };
      }

      if (this.typingIndicator) this.typingIndicator.style.display = 'none';
      if (onFinishThinking) onFinishThinking(responseText, audioSource);

      const appuMsg = this.addMessage('appu', responseText, actionCard);
      return appuMsg;

    } catch (error) {
      console.error('Appu answer request failed.', error);
      if (this.typingIndicator) this.typingIndicator.style.display = 'none';

      const errorDisplay = 'I could not reach my answer service just now. Please wait a moment and try again.';
      if (onFinishThinking) onFinishThinking(errorDisplay, null);
      return this.addMessage('appu', errorDisplay);
    }
  }

  clearHistory() {
    this.messages = [];
    if (this.messagesContainer) {
      this.messagesContainer.innerHTML = '';
    }
    this.initDefaultWelcome();
  }
}

window.ChatAgent = ChatAgent;
