/**
 * Main Application Orchestrator for Sleek Keynote AI Stage
 * Connects AvatarStage, VoiceEngine, ChatAgent, Spatial Nodes, Modals and Live n8n Execution.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Preferences & Configuration
  const defaultN8nUrl = 'https://n8n.srv1871828.hstgr.cloud/webhook/4a108e85-050f-427e-aa03-784492ddfe89/chat';
  const savedWebhook = localStorage.getItem('appu_n8n_url') || defaultN8nUrl;
  const savedMock = localStorage.getItem('appu_mock_mode') === 'true'; // Default to LIVE (false)
  const savedPitch = parseFloat(localStorage.getItem('appu_pitch') || '1.0');
  const savedRate = parseFloat(localStorage.getItem('appu_rate') || '1.0');
  const savedAutoSpeak = localStorage.getItem('appu_auto_speak') !== 'false';
  const savedSound = localStorage.getItem('appu_sound_sfx') !== 'false';
  let currentLang = localStorage.getItem('appu_lang') || 'en';

  // 2. Initialize Avatar Stage
  const avatarStage = new AvatarStage();

  // 3. Initialize Voice Engine
  const voiceEngine = new VoiceEngine({
    onSpeechStart: () => {
      avatarStage.setState('listening');
    },
    onSpeechResult: (transcript) => {
      handleUserInteraction(transcript);
    },
    onSpeechEnd: () => {
      if (avatarStage.currentState === 'listening') {
        avatarStage.setState('idle');
      }
    },
    onUtteranceStart: () => {
      avatarStage.setState('speaking');
    },
    onUtteranceEnd: () => {
      avatarStage.setState('idle');
    }
  });

  voiceEngine.pitch = savedPitch;
  voiceEngine.rate = savedRate;
  voiceEngine.autoSpeak = savedAutoSpeak;
  voiceEngine.soundEnabled = savedSound;

  // 4. Initialize Chat Agent (Live n8n Backend)
  const chatAgent = new ChatAgent({
    n8nWebhookUrl: savedWebhook,
    mockMode: savedMock
  });

  // Global App Namespace
  window.app = {
    avatarStage,
    voiceEngine,
    chatAgent,
    openDiscoveryModal,
    closeDiscoveryModal,
    openSettingsModal,
    closeSettingsModal,
    toggleChatDrawer,
    handleUserInteraction,
    setLanguage
  };

  // ==========================================
  // LANGUAGE TOGGLE HANDLER (ENG / KANNADA)
  // ==========================================
  const langEnBtn = document.getElementById('lang-en');
  const langKnBtn = document.getElementById('lang-kn');

  function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('appu_lang', lang);

    if (langEnBtn && langKnBtn) {
      if (lang === 'kn') {
        langKnBtn.classList.add('is-active');
        langEnBtn.classList.remove('is-active');
        voiceEngine.speak('ನಮಸ್ಕಾರ! ನಾನು ಅಪ್ಪು, ಐಜಿಆರ್ ಅಕಾಡೆಮಿಯ ಎಐ ಮೆಂಟರ್. ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?');
      } else {
        langEnBtn.classList.add('is-active');
        langKnBtn.classList.remove('is-active');
        voiceEngine.speak('Namaskara! I am Appu, your AI Mentor at IGR Academy. How can I guide you today?');
      }
    }
  }

  if (langEnBtn) langEnBtn.addEventListener('click', () => setLanguage('en'));
  if (langKnBtn) langKnBtn.addEventListener('click', () => setLanguage('kn'));

  // ==========================================
  // CORE INTERACTION HANDLER
  // ==========================================
  async function handleUserInteraction(text) {
    if (!text || !text.trim()) return;

    avatarStage.setState('thinking');

    const result = await chatAgent.sendMessage(
      text,
      () => avatarStage.setState('thinking'),
      (reply) => {
        avatarStage.setState('speaking');
        voiceEngine.speak(reply);
        voiceEngine.playMessage();
      }
    );

    // Update unread badge if chat drawer is closed
    const drawer = document.getElementById('chat-drawer');
    const badge = document.getElementById('unread-badge');
    if (drawer && !drawer.classList.contains('is-open') && badge) {
      const current = parseInt(badge.textContent || '0', 10) + 1;
      badge.textContent = current;
      badge.style.display = 'inline-block';
    }
  }

  // ==========================================
  // UI BINDINGS & CONTROLS
  // ==========================================

  // Hero Voice Portal Button & Avatar Figure Direct Tap
  const btnMic = document.getElementById('btn-mic');
  const avatarFigure = document.getElementById('avatar-figure-container');

  if (btnMic) {
    btnMic.addEventListener('click', () => {
      voiceEngine.playTone(520, 'sine', 0.1);
      voiceEngine.toggleListening();
    });
  }

  if (avatarFigure) {
    avatarFigure.addEventListener('click', () => {
      voiceEngine.playTone(580, 'sine', 0.1);
      voiceEngine.toggleListening();
    });
  }

  // Chat Drawer Toggle
  const btnToggleChat = document.getElementById('btn-toggle-chat');
  const btnCloseChat = document.getElementById('btn-close-chat');
  const chatDrawer = document.getElementById('chat-drawer');
  const unreadBadge = document.getElementById('unread-badge');

  function toggleChatDrawer(open = null) {
    if (!chatDrawer) return;
    const shouldOpen = open !== null ? open : !chatDrawer.classList.contains('is-open');
    if (shouldOpen) {
      chatDrawer.classList.add('is-open');
      if (unreadBadge) {
        unreadBadge.textContent = '0';
        unreadBadge.style.display = 'none';
      }
      const chatInput = document.getElementById('chat-input');
      if (chatInput) setTimeout(() => chatInput.focus(), 300);
    } else {
      chatDrawer.classList.remove('is-open');
    }
  }

  if (btnToggleChat) btnToggleChat.addEventListener('click', () => toggleChatDrawer());
  if (btnCloseChat) btnCloseChat.addEventListener('click', () => toggleChatDrawer(false));

  // Clear Chat History
  const btnClearChat = document.getElementById('btn-clear-chat');
  if (btnClearChat) {
    btnClearChat.addEventListener('click', () => {
      if (confirm('Clear chat conversation history?')) {
        chatAgent.clearHistory();
      }
    });
  }

  // Chat Form Submit
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = chatInput.value.trim();
      if (val) {
        chatInput.value = '';
        handleUserInteraction(val);
      }
    });
  }

  // Chat Mic Button inside input bar
  const btnChatMic = document.getElementById('btn-chat-mic');
  if (btnChatMic) {
    btnChatMic.addEventListener('click', () => {
      voiceEngine.toggleListening();
    });
  }

  // Spatial Nodes & Recommendation Chips
  document.querySelectorAll('.spatial-node, .chip-action-btn').forEach(elem => {
    elem.addEventListener('click', () => {
      const prompt = elem.getAttribute('data-prompt');
      if (prompt) {
        voiceEngine.playTone(600, 'sine', 0.1);
        handleUserInteraction(prompt);
      }
    });
  });

  // Sound Effects Toggle
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const soundIcon = document.getElementById('sound-icon');
  if (btnSoundToggle && soundIcon) {
    btnSoundToggle.addEventListener('click', () => {
      voiceEngine.soundEnabled = !voiceEngine.soundEnabled;
      if (voiceEngine.soundEnabled) {
        soundIcon.className = 'fa-solid fa-volume-high';
        voiceEngine.playTone(650, 'sine', 0.12);
      } else {
        soundIcon.className = 'fa-solid fa-volume-xmark';
      }
      localStorage.setItem('appu_sound_sfx', voiceEngine.soundEnabled);
    });
  }

  // ==========================================
  // DISCOVERY CALL MODAL (0-Click Schedule)
  // ==========================================
  const discoveryModal = document.getElementById('discovery-modal');
  const btnCloseDiscovery = document.getElementById('btn-close-discovery-modal');
  const btnQuickSchedule = document.getElementById('btn-quick-schedule');
  const btnHeroSchedule = document.getElementById('btn-hero-schedule');
  const discoveryForm = document.getElementById('discovery-form');
  const discoverySuccessView = document.getElementById('discovery-success-view');
  const btnDoneDiscovery = document.getElementById('btn-done-discovery');

  function openDiscoveryModal() {
    if (discoveryModal) {
      discoveryModal.style.display = 'flex';
      discoveryForm.style.display = 'flex';
      discoverySuccessView.style.display = 'none';

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(17, 0, 0, 0); // 5 PM
      const leadDateInput = document.getElementById('lead-date');
      if (leadDateInput) {
        leadDateInput.value = tomorrow.toISOString().slice(0, 16);
      }
    }
  }

  function closeDiscoveryModal() {
    if (discoveryModal) discoveryModal.style.display = 'none';
  }

  if (btnQuickSchedule) btnQuickSchedule.addEventListener('click', openDiscoveryModal);
  if (btnHeroSchedule) btnHeroSchedule.addEventListener('click', openDiscoveryModal);
  if (btnCloseDiscovery) btnCloseDiscovery.addEventListener('click', closeDiscoveryModal);
  if (btnDoneDiscovery) btnDoneDiscovery.addEventListener('click', closeDiscoveryModal);

  // Submit Lead Form
  if (discoveryForm) {
    discoveryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-discovery');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Creating Google Meet & WhatsApp Alert...</span>';
      }

      const leadData = {
        name: document.getElementById('lead-name').value.trim(),
        phone: document.getElementById('lead-phone').value.trim(),
        email: document.getElementById('lead-email').value.trim(),
        dateTime: document.getElementById('lead-date').value,
        interest: document.getElementById('lead-interest').value
      };

      const result = await chatAgent.submitDiscoveryLead(leadData);

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> <span>Confirm 0-Click Discovery Call</span>';
      }

      discoveryForm.style.display = 'none';
      discoverySuccessView.style.display = 'flex';
      avatarStage.setState('success');
      voiceEngine.playSuccess();

      const successSummary = document.getElementById('success-summary');
      if (successSummary) {
        successSummary.textContent = `Google Meet link created for ${leadData.name}. Invitation sent to ${leadData.email} and WhatsApp alert sent to ${leadData.phone}!`;
      }

      const meetLink = document.getElementById('success-meet-link');
      if (meetLink && result.meetLink) {
        meetLink.href = result.meetLink;
      }

      const waLink = document.getElementById('success-wa-link');
      if (waLink) {
        const cleanPhone = leadData.phone.replace(/[^0-9]/g, '');
        waLink.href = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hi ${leadData.name}, your 0-Click Discovery Call with Appu at IGR Academy is confirmed! Meet link: ${result.meetLink}`)}`;
      }

      voiceEngine.speak(`Thank you ${leadData.name}! Your Discovery Call has been scheduled! We sent your Google Meet link and WhatsApp alert.`);
    });
  }

  // ==========================================
  // SETTINGS MODAL & PREFERENCES
  // ==========================================
  const settingsModal = document.getElementById('settings-modal');
  const btnSettings = document.getElementById('btn-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings-modal');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  const settingN8nUrl = document.getElementById('setting-n8n-url');
  const settingMockMode = document.getElementById('setting-mock-mode');
  const settingVoicePitch = document.getElementById('setting-voice-pitch');
  const settingVoiceRate = document.getElementById('setting-voice-rate');
  const settingAutoSpeak = document.getElementById('setting-auto-speak');
  const settingUiSound = document.getElementById('setting-ui-sound');
  const pitchVal = document.getElementById('pitch-val');
  const rateVal = document.getElementById('rate-val');

  function openSettingsModal() {
    if (settingsModal) {
      if (settingN8nUrl) settingN8nUrl.value = chatAgent.n8nWebhookUrl;
      if (settingMockMode) settingMockMode.checked = chatAgent.mockMode;
      if (settingVoicePitch) settingVoicePitch.value = voiceEngine.pitch;
      if (settingVoiceRate) settingVoiceRate.value = voiceEngine.rate;
      if (pitchVal) pitchVal.textContent = voiceEngine.pitch.toFixed(1);
      if (rateVal) rateVal.textContent = voiceEngine.rate.toFixed(1);
      if (settingAutoSpeak) settingAutoSpeak.checked = voiceEngine.autoSpeak;
      if (settingUiSound) settingUiSound.checked = voiceEngine.soundEnabled;

      settingsModal.style.display = 'flex';
    }
  }

  function closeSettingsModal() {
    if (settingsModal) settingsModal.style.display = 'none';
  }

  if (btnSettings) btnSettings.addEventListener('click', openSettingsModal);
  if (btnCloseSettings) btnCloseSettings.addEventListener('click', closeSettingsModal);

  if (settingVoicePitch && pitchVal) {
    settingVoicePitch.addEventListener('input', (e) => {
      pitchVal.textContent = parseFloat(e.target.value).toFixed(1);
    });
  }

  if (settingVoiceRate && rateVal) {
    settingVoiceRate.addEventListener('input', (e) => {
      rateVal.textContent = parseFloat(e.target.value).toFixed(1);
    });
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', () => {
      chatAgent.n8nWebhookUrl = settingN8nUrl.value.trim();
      chatAgent.mockMode = settingMockMode.checked;
      voiceEngine.pitch = parseFloat(settingVoicePitch.value);
      voiceEngine.rate = parseFloat(settingVoiceRate.value);
      voiceEngine.autoSpeak = settingAutoSpeak.checked;
      voiceEngine.soundEnabled = settingUiSound.checked;

      const voiceSelect = document.getElementById('setting-voice-select');
      if (voiceSelect && voiceEngine.voices[voiceSelect.value]) {
        voiceEngine.selectedVoice = voiceEngine.voices[voiceSelect.value];
      }

      localStorage.setItem('appu_n8n_url', chatAgent.n8nWebhookUrl);
      localStorage.setItem('appu_mock_mode', chatAgent.mockMode);
      localStorage.setItem('appu_pitch', voiceEngine.pitch);
      localStorage.setItem('appu_rate', voiceEngine.rate);
      localStorage.setItem('appu_auto_speak', voiceEngine.autoSpeak);
      localStorage.setItem('appu_sound_sfx', voiceEngine.soundEnabled);

      voiceEngine.playSuccess();
      closeSettingsModal();
    });
  }

  // Close modals on outside click
  window.addEventListener('click', (e) => {
    if (e.target === discoveryModal) closeDiscoveryModal();
    if (e.target === settingsModal) closeSettingsModal();
  });
});
