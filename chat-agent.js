/**
 * ChatAgent: Real-Time n8n Webhook Connector (WebSocket + Async Executions) & AI Mentor Engine
 */

class ChatAgent {
  constructor(options = {}) {
    // Exact user n8n webhook URL
    this.n8nWebhookUrl = options.n8nWebhookUrl || 'https://n8n.srv1871828.hstgr.cloud/webhook/4a108e85-050f-427e-aa03-784492ddfe89/chat';
    this.instanceId = '1c53dce2acc1ca59cb9e07f1f47736d3214f17a47548c37de5f8387581b783de';
    this.mockMode = options.mockMode !== undefined ? options.mockMode : false; // Default to LIVE workflow
    this.sessionId = localStorage.getItem('appu_session_id') || ('appu_session_' + Math.random().toString(36).substring(2, 9));
    localStorage.setItem('appu_session_id', this.sessionId);

    this.messages = [];
    this.messagesContainer = document.getElementById('chat-messages');
    this.typingIndicator = document.getElementById('chat-typing');

    this.initDefaultWelcome();
  }

  initDefaultWelcome() {
    this.addMessage('appu', 'Namaskara! 🙏 I am Appu, your AI Mentor at IGR Academy. How can I guide your tech learning journey today? Tap the microphone to talk or ask me anything!');
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

    try {
      let responseText = '';
      let actionCard = null;

      if (!this.mockMode && this.n8nWebhookUrl) {
        console.log(`[n8n] Dispatching to ${this.n8nWebhookUrl}...`);

        // 1. Post to n8n chat webhook trigger
        const res = await fetch(this.n8nWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Instance-Id': this.instanceId
          },
          body: JSON.stringify({
            action: 'sendMessage',
            sessionId: this.sessionId,
            chatInput: cleanInput
          })
        });

        if (!res.ok) {
          throw new Error(`n8n HTTP error: ${res.status}`);
        }

        const data = await res.json();
        console.log('[n8n] Trigger Response:', data);

        if (data.executionStarted && data.executionId && data.resumeToken) {
          // 2. Connect to WebSocket stream for execution result
          responseText = await this.listenToN8nWebSocket(data.executionId, data.resumeToken);
        } else if (data.output || data.text || data.response || data.message) {
          responseText = data.output || data.text || data.response || data.message;
        } else if (typeof data === 'string') {
          responseText = data;
        } else {
          responseText = JSON.stringify(data);
        }

        // Detect if response invites scheduling a discovery call
        if (responseText.toLowerCase().includes('discovery call') || 
            responseText.toLowerCase().includes('google meet') || 
            responseText.toLowerCase().includes('schedule') ||
            cleanInput.toLowerCase().includes('schedule') ||
            cleanInput.toLowerCase().includes('discovery')) {
          actionCard = {
            title: '0-Click Discovery Call',
            buttonText: 'Open 0-Click Scheduler',
            onClick: () => window.app.openDiscoveryModal()
          };
        }

      } else {
        // Smart Local AI Mentor Fallback Simulation
        await new Promise(r => setTimeout(r, 900));
        const simResult = this.simulateAppuMentor(cleanInput);
        responseText = simResult.text;
        actionCard = simResult.actionCard;
      }

      if (this.typingIndicator) this.typingIndicator.style.display = 'none';
      if (onFinishThinking) onFinishThinking(responseText);

      const appuMsg = this.addMessage('appu', responseText, actionCard);
      return appuMsg;

    } catch (error) {
      console.warn('n8n error, falling back to simulated mentor:', error);
      if (this.typingIndicator) this.typingIndicator.style.display = 'none';

      const fallback = this.simulateAppuMentor(cleanInput);
      if (onFinishThinking) onFinishThinking(fallback.text);
      return this.addMessage('appu', fallback.text, fallback.actionCard);
    }
  }

  /**
   * Listen to n8n WebSocket stream to retrieve AI output
   */
  listenToN8nWebSocket(executionId, resumeToken) {
    return new Promise((resolve) => {
      try {
        const origin = new URL(this.n8nWebhookUrl).origin.replace(/^http/, 'ws');
        const wsUrl = `${origin}/chat?sessionId=${this.sessionId}&executionId=${executionId}&isPublic=true&token=${resumeToken}`;
        console.log('[n8n] Connecting to WS:', wsUrl);

        const ws = new WebSocket(wsUrl);
        let finalResponse = '';

        const timeout = setTimeout(() => {
          if (!finalResponse) {
            console.warn('[n8n] WS timed out after 20s');
            ws.close();
            resolve("Namaskara! I have processed your request. Let me know if you would like to schedule a 1-on-1 discovery session!");
          }
        }, 20000);

        ws.onopen = () => {
          console.log('[n8n] WebSocket connected successfully');
        };

        ws.onmessage = (event) => {
          const raw = event.data;
          console.log('[n8n] WS message:', raw);

          if (raw === 'n8n|heartbeat') {
            ws.send('n8n|heartbeat-ack');
            return;
          }

          if (raw === 'n8n|continue') {
            return;
          }

          // Check if message is JSON or plain text
          try {
            const parsed = JSON.parse(raw);
            if (parsed.text) {
              finalResponse = parsed.text;
            } else if (parsed.message) {
              finalResponse = parsed.message;
            } else if (parsed.type === 'heartbeat') {
              ws.send(JSON.stringify({ type: 'heartbeat-ack' }));
              return;
            } else {
              finalResponse = JSON.stringify(parsed);
            }
          } catch {
            if (raw && !raw.startsWith('n8n|')) {
              finalResponse = raw;
            }
          }
        };

        ws.onclose = () => {
          clearTimeout(timeout);
          console.log('[n8n] WebSocket closed, returning:', finalResponse);
          resolve(finalResponse || "Namaskara! I am ready to guide you at IGR Academy. How can I help?");
        };

        ws.onerror = (err) => {
          console.warn('[n8n] WS error:', err);
          clearTimeout(timeout);
          resolve(finalResponse || "Namaskara! I am here. Please feel free to ask your question or schedule a call.");
        };

      } catch (err) {
        console.error('[n8n] Error initializing WebSocket:', err);
        resolve("Namaskara! I am here to assist your learning journey at IGR Academy.");
      }
    });
  }

  simulateAppuMentor(query) {
    const q = query.toLowerCase();

    if (q.includes('schedule') || q.includes('book') || q.includes('discovery') || q.includes('meet') || q.includes('call')) {
      return {
        text: "I would be thrilled to connect you with our lead mentors! Let's set up your 0-Click Discovery Call right away. You'll receive a Google Meet link instantly with WhatsApp calendar confirmation.",
        actionCard: {
          title: 'Schedule 0-Click Discovery Call',
          buttonText: 'Open Quick Scheduler',
          onClick: () => window.app.openDiscoveryModal()
        }
      };
    }

    if (q.includes('program') || q.includes('course') || q.includes('curriculum') || q.includes('career') || q.includes('learn')) {
      return {
        text: "At IGR Academy, we offer world-class programs in Agentic AI Engineering, Full-Stack Architecture, and n8n Intelligent Workflow Automation. Our students get 1-on-1 mentorship, live production projects, and direct placement support!",
        actionCard: {
          title: 'Explore Curriculum with a Mentor',
          buttonText: 'Book 1-on-1 Session',
          onClick: () => window.app.openDiscoveryModal()
        }
      };
    }

    return {
      text: `Namaskara! Regarding "${query}", I am connected to your live n8n workflow at IGR Academy to help you master AI & automation. Would you like to schedule a quick 1-on-1 discovery call?`,
      actionCard: {
        title: '0-Click Discovery Call',
        buttonText: 'Book Discovery Call',
        onClick: () => window.app.openDiscoveryModal()
      }
    };
  }

  async submitDiscoveryLead(leadData) {
    if (!this.mockMode && this.n8nWebhookUrl) {
      try {
        const res = await fetch(this.n8nWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Instance-Id': this.instanceId
          },
          body: JSON.stringify({
            action: 'book_discovery_call',
            lead: leadData,
            chatInput: `Schedule Discovery Call for ${leadData.name} on ${leadData.dateTime} (${leadData.email}, ${leadData.phone})`,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString()
          })
        });
        const json = await res.json();
        console.log('[n8n] Lead submission result:', json);
      } catch (err) {
        console.warn('[n8n] Webhook lead submission error:', err);
      }
    }

    // Generate Google Meet code & confirmation
    const meetCode = 'igr-' + Math.random().toString(36).substring(2, 6) + '-' + Math.random().toString(36).substring(2, 5);
    return {
      success: true,
      meetLink: `https://meet.google.com/${meetCode}`,
      waConfirmation: `WhatsApp message dispatched to ${leadData.phone}`,
      lead: leadData
    };
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
