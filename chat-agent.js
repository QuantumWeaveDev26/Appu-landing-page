/**
 * ChatAgent: Secure Gateway Connector & AI Mentor Engine
 *
 * All interactions (authenticated and guest) route strictly through the backend
 * gateway (POST /api/appu/message) via AppuBackendClient.
 */

class ChatAgent {
  constructor(options = {}) {
    this.mockMode = false;
    this.voiceEngine = options.voiceEngine || null;
    this.getConversationId = options.getConversationId || (() => null);
    this.onConversationAssigned = options.onConversationAssigned || (() => {});
    this.messages = [];
    this.messagesContainer = document.getElementById('chat-messages');
    this.typingIndicator = document.getElementById('chat-typing');

    this.initDefaultWelcome();
  }

  initDefaultWelcome() {
    this.addMessage('appu', 'Namaskara! 🙏 I am Appu, your learning companion. Tell me your class and what you want to understand today!', null, null, { isWelcome: true });
  }

  addMessage(sender, text, actionCard = null, imageDataUrl = null, options = {}) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgObj = { sender, text, time: timeStr, actionCard, imageDataUrl, ...options };
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

    if (msg.imageDataUrl) {
      const img = document.createElement('img');
      img.className = 'msg-image-thumb';
      img.src = msg.imageDataUrl;
      img.alt = 'Attached photo';
      bubble.appendChild(img);
    } else if (msg.attachmentLabel) {
      const label = document.createElement('div');
      label.className = 'msg-attachment-label';
      label.innerHTML = `<i class="fa-solid fa-paperclip" aria-hidden="true"></i> <span>${msg.attachmentLabel}</span>`;
      bubble.appendChild(label);
    }

    const textSpan = document.createElement('span');
    textSpan.textContent = msg.text;
    bubble.appendChild(textSpan);

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

    // In-chat affordance: Share study note to parent's WhatsApp (opens user's WhatsApp to send TO parent)
    if (msg.sender === 'appu' && !msg.isWelcome && !msg.isSystem && msg.text && msg.text.trim()) {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'msg-actions-bar';

      const shareBtn = document.createElement('button');
      shareBtn.className = 'btn-share-whatsapp';
      shareBtn.type = 'button';
      shareBtn.setAttribute('title', "Opens your WhatsApp on this device to send this study note to your parent");
      shareBtn.setAttribute('aria-label', "Share study note to parent's WhatsApp");
      shareBtn.innerHTML = '<i class="fa-brands fa-whatsapp" aria-hidden="true"></i> <span>Share note to parent\'s WhatsApp</span>';

      shareBtn.onclick = async (e) => {
        if (e && typeof e.stopPropagation === 'function') {
          e.stopPropagation();
        }

        const session = (typeof window !== 'undefined' && window.AppuSession) ? window.AppuSession : null;
        const parentContext = session ? session.parentContext : null;

        let parentPhone = parentContext?.parentPhone;
        let consent = Boolean(parentContext?.whatsappConsent);

        // Fallback: check ParentOnboardingShell state or fetch preferences
        if (!parentPhone && typeof window !== 'undefined' && window.ParentOnboardingShell) {
          const p = window.ParentOnboardingShell.state?.personalisation || window.ParentOnboardingShell.state?.personalization;
          if (p?.parent_phone || p?.parentPhone) {
            parentPhone = p.parent_phone || p.parentPhone;
            consent = Boolean(p.whatsapp_consent ?? p.whatsappConsent);
          } else if (typeof window.ParentOnboardingShell.fetchNotificationPreferences === 'function') {
            try {
              const prefs = await window.ParentOnboardingShell.fetchNotificationPreferences();
              if (prefs && (prefs.parent_phone || prefs.parentPhone)) {
                parentPhone = prefs.parent_phone || prefs.parentPhone;
                consent = Boolean(prefs.whatsapp_consent ?? prefs.whatsappConsent);
              }
            } catch {}
          }
        }

        if (consent && parentPhone) {
          const childName = parentContext?.childName || (typeof window !== 'undefined' && (window.ParentOnboardingShell?.state?.personalisation?.child_name || window.ParentOnboardingShell?.state?.personalization?.child_name)) || '';
          const client = (typeof window !== 'undefined' && window.AppuBackendClient) || (typeof AppuBackendClient !== 'undefined' ? AppuBackendClient : null);
          if (client && typeof client.buildWhatsAppShareUrl === 'function') {
            const url = client.buildWhatsAppShareUrl(parentPhone, msg.text, childName);
            if (url && typeof window !== 'undefined' && typeof window.open === 'function') {
              window.open(url, '_blank');
            }
          }
        } else {
          if (typeof window !== 'undefined' && window.ParentSetupUI && typeof window.ParentSetupUI.openModal === 'function') {
            window.ParentSetupUI.openModal(4);
          } else if (typeof window !== 'undefined' && typeof window.alert === 'function') {
            window.alert("To share study notes with your parent's WhatsApp, ask them to enable WhatsApp updates in Parent Zone settings.");
          }
        }
      };

      actionsDiv.appendChild(shareBtn);
      bubble.appendChild(actionsDiv);
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
  async sendMessage(userText, onStartThinking, onFinishThinking, image = null) {
    if ((!userText || !userText.trim()) && !image) return null;

    const cleanInput = (userText && userText.trim()) || (image ? 'Please help me understand this.' : '');
    // Render User Message in Chat Drawer
    this.addMessage('user', cleanInput, null, image ? image.dataUrl : null);

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
        return this.addMessage('appu', responseText, actionCard, null, { isSystem: true });
      }

      if (!backendClient || typeof backendClient.sendAppuMessage !== 'function') {
        throw new Error('AppuBackendClient unavailable');
      }

      // Output preference (does the user want to hear the reply), not input modality --
      // a mic-triggered message gets the same treatment as a typed one.
      const includeAudio = this.voiceEngine
        ? Boolean(this.voiceEngine.autoSpeak || this.voiceEngine.liveSessionActive)
        : true;

      const activeConvId = (hasSecureSession && typeof this.getConversationId === 'function')
        ? this.getConversationId()
        : null;

      const requestPayload = hasSecureSession
        ? {
            accessToken: window.AppuSession.accessToken,
            childId: window.AppuSession.childId,
            ...(activeConvId ? { conversationId: activeConvId } : {}),
            message: cleanInput,
            language: this.language || 'en',
            includeAudio
          }
        : {
            message: cleanInput,
            language: this.language || 'en',
            includeAudio
          };

      if (image && image.dataUrl) {
        requestPayload.imageBase64 = image.dataUrl;
      }

      const result = await backendClient.sendAppuMessage(requestPayload);

      if (result && result.conversationId && typeof this.onConversationAssigned === 'function') {
        this.onConversationAssigned(result.conversationId);
      }

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
      if (onFinishThinking) onFinishThinking(responseText, audioSource, result.audioStreamUrl || null, requestPayload.accessToken || null);

      const isSystemNotice = Boolean(result.error || result.code);
      const appuMsg = this.addMessage('appu', responseText, actionCard, null, { isSystem: isSystemNotice });
      return appuMsg;

    } catch (error) {
      console.error('Appu message request failed:', error);
      if (this.typingIndicator) this.typingIndicator.style.display = 'none';

      const errorDisplay = 'I could not reach my answer service just now. Please check your connection and try again.';
      if (onFinishThinking) onFinishThinking(errorDisplay, null);
      return this.addMessage('appu', errorDisplay, null, null, { isSystem: true });
    }
  }

  replaceMessages(messages = []) {
    this.messages = [];
    if (this.messagesContainer) {
      this.messagesContainer.innerHTML = '';
    }
    if (!messages || messages.length === 0) {
      this.initDefaultWelcome();
      return;
    }
    for (const m of messages) {
      const sender = m.role === 'user' ? 'user' : 'appu';
      const timeStr = m.createdAt
        ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
      const msgObj = {
        id: m.id,
        sender,
        text: m.text,
        time: timeStr,
        hasImageAttachment: Boolean(m.hasImageAttachment),
        attachmentLabel: m.hasImageAttachment ? 'Photo attached' : null,
        imageDataUrl: null,
        actionCard: null
      };
      this.messages.push(msgObj);
      this.renderMessage(msgObj);
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

if (typeof window !== 'undefined') {
  window.ChatAgent = ChatAgent;
}
if (typeof module === 'object' && module.exports) {
  module.exports = { ChatAgent };
}
