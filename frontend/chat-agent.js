/**
 * ChatAgent: Secure Gateway Connector & AI Mentor Engine
 *
 * All interactions (authenticated and guest) route strictly through the backend
 * gateway (POST /api/appu/message) via AppuBackendClient.
 */

class ChatAgent {
  constructor(options = {}) {
    this.mockMode = false;
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
      title.innerHTML = `<i class="fa-solid fa-user-shield"></i> ${msg.actionCard.title}`;
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
   * Sends user message to backend gateway and returns response
   */
  async sendMessage(userText, onStartThinking, onFinishThinking) {
    if (!userText || !userText.trim()) return null;

    const cleanInput = userText.trim();
    // Render User Message in Chat Drawer
    this.addMessage('user', cleanInput);

    if (onStartThinking) onStartThinking();
    if (this.typingIndicator) this.typingIndicator.style.display = 'flex';

    try {
      let responseText = '';
      let actionCard = null;
      let audioSource = null;

      // Ensure startup auth restoration has completed before dispatching
      if (
        typeof window !== 'undefined' &&
        window.ParentOnboardingShell &&
        typeof window.ParentOnboardingShell.whenReady === 'function'
      ) {
        await window.ParentOnboardingShell.whenReady().catch(() => {});
      }

      const hasSecureSession =
        typeof window !== 'undefined' &&
        window.AppuSession &&
        typeof window.AppuSession.isAuthenticated === 'function' &&
        window.AppuSession.isAuthenticated();

      const backendClient = typeof window !== 'undefined' ? window.AppuBackendClient : null;

      const hasAuthenticatedParentSession =
        typeof window !== 'undefined' &&
        window.ParentOnboardingShell &&
        Boolean(window.ParentOnboardingShell.state?.session?.access_token);

      // A verified parent session without an active learner is not a guest session.
      // Block locally so a child-selection/subscription state can never consume guest access.
      if (hasAuthenticatedParentSession && !hasSecureSession) {
        responseText = 'Please open Parent Zone to activate your plan or select a learner before chatting with Appu.';
        actionCard = {
          title: 'Parent Zone',
          buttonText: 'Choose learner',
          onClick: () => {
            if (window.ParentSetupUI && typeof window.ParentSetupUI.openModal === 'function') {
              window.ParentSetupUI.openModal(4);
            }
          }
        };
        if (this.typingIndicator) this.typingIndicator.style.display = 'none';
        if (onFinishThinking) onFinishThinking(responseText, null);
        return this.addMessage('appu', responseText, actionCard);
      }

      if (!backendClient || typeof backendClient.sendAppuMessage !== 'function') {
        throw new Error('AppuBackendClient unavailable');
      }

      const requestPayload = hasSecureSession
        ? {
            accessToken: window.AppuSession.accessToken,
            childId: window.AppuSession.childId,
            message: cleanInput,
            language: this.language || 'en'
          }
        : {
            message: cleanInput,
            language: this.language || 'en'
          };

      const result = await backendClient.sendAppuMessage(requestPayload);

      responseText = result.text;
      audioSource = result.audioSource || null;

      // Handle guest limit reached
      if (result.error === 'guest_limit_reached' || result.code === 'GUEST_LIMIT_REACHED') {
        actionCard = {
          title: 'Parent Zone',
          buttonText: 'Sign in to save progress & continue',
          onClick: () => {
            if (typeof window !== 'undefined' && window.app && typeof window.app.showGuestGateModal === 'function') {
              window.app.showGuestGateModal();
            } else if (typeof window !== 'undefined' && window.ParentSetupUI && typeof window.ParentSetupUI.openModal === 'function') {
              window.ParentSetupUI.openModal(1);
            }
          }
        };

        if (typeof window !== 'undefined' && window.app && typeof window.app.onGuestLimitReached === 'function') {
          window.app.onGuestLimitReached(result);
        }
      } else if ((result.guest || result.guestSession) && typeof window !== 'undefined' && window.app && typeof window.app.updateGuestBadge === 'function') {
        window.app.updateGuestBadge(result.guest || result.guestSession);
      }

      // Clean formatted \n characters so line breaks render properly
      if (typeof responseText === 'string') {
        responseText = responseText.replace(/\\n/g, '\n');
      }

      if (!responseText || !responseText.trim()) {
        responseText = "I received your message, but the answer service returned an empty output. Please try asking again!";
      }

      // Detect if response invites scheduling a discovery call
      if (!actionCard && (
          responseText.toLowerCase().includes('discovery call') ||
          responseText.toLowerCase().includes('google meet') ||
          responseText.toLowerCase().includes('parent zone') ||
          cleanInput.toLowerCase().includes('schedule') ||
          cleanInput.toLowerCase().includes('parent zone')
      )) {
        actionCard = {
          title: 'Parent Zone',
          buttonText: 'Plan a learning support call',
          onClick: () => {
            if (window.app && typeof window.app.openDiscoveryModal === 'function') {
              window.app.openDiscoveryModal();
            }
          }
        };
      }

      if (this.typingIndicator) this.typingIndicator.style.display = 'none';
      if (onFinishThinking) onFinishThinking(responseText, audioSource);

      const appuMsg = this.addMessage('appu', responseText, actionCard);
      return appuMsg;

    } catch (error) {
      console.error('Appu message request failed:', error);
      if (this.typingIndicator) this.typingIndicator.style.display = 'none';

      const errorDisplay = 'I could not reach my answer service just now. Please check your connection and try again.';
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
