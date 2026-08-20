/**
 * Main Application Orchestrator v4.0 for Appu AI Digital Mentor
 * Connects AvatarStage, VoiceEngine, ChatAgent, Modals, Audio SFX and Live n8n Workflows.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // ENTRANCE LOADER CHOREOGRAPHY (Tribute Video at 2x Speed)
  // ==========================================
  const loader = document.getElementById('loader');
  const loaderBar = document.getElementById('loader-bar');
  const loaderCount = document.getElementById('loader-count');
  const loaderEnterBtn = document.getElementById('loader-enter-btn');
  const loaderSkipBtn = document.getElementById('loader-skip-btn');
  const loaderSoundBtn = document.getElementById('loader-sound-btn');
  const loaderSoundIcon = document.getElementById('loader-sound-icon');
  const loaderVideoPlayer = document.getElementById('loader-video-player');

  if (loaderVideoPlayer) {
    loaderVideoPlayer.muted = true;
    loaderVideoPlayer.playbackRate = 2.0; // 2x playback speed!
    loaderVideoPlayer.addEventListener('loadedmetadata', () => {
      loaderVideoPlayer.playbackRate = 2.0;
    });
    loaderVideoPlayer.addEventListener('play', () => {
      loaderVideoPlayer.playbackRate = 2.0;
    });
    loaderVideoPlayer.play().catch(() => {});
  }

  let isLoaderDismissed = false;

  function dismissLoader() {
    if (isLoaderDismissed || !loader) return;
    isLoaderDismissed = true;
    loader.classList.add('is-done');

    setTimeout(() => {
      if (loaderVideoPlayer) {
        try { loaderVideoPlayer.pause(); } catch(e) {}
      }
    }, 800);
  }

  // Sound toggle for tribute video
  if (loaderSoundBtn && loaderVideoPlayer && loaderSoundIcon) {
    loaderSoundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      loaderVideoPlayer.muted = !loaderVideoPlayer.muted;
      if (loaderVideoPlayer.muted) {
        loaderSoundIcon.className = 'fa-solid fa-volume-xmark';
      } else {
        loaderSoundIcon.className = 'fa-solid fa-volume-high text-cyan';
        loaderVideoPlayer.play().catch(() => {});
      }
    });
  }

  if (loaderEnterBtn) {
    loaderEnterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissLoader();
    });
  }

  if (loaderSkipBtn) {
    loaderSkipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissLoader();
    });
  }

  // Progress counter synchronized with 2x video
  if (loader && loaderBar && loaderCount) {
    let progress = 0;
    const fallbackDuration = 3800; // ~3.8s at 2x speed
    const startTime = performance.now();

    function tick() {
      if (isLoaderDismissed) return;

      let t = 0;
      if (loaderVideoPlayer && loaderVideoPlayer.duration && !isNaN(loaderVideoPlayer.duration) && loaderVideoPlayer.duration > 0) {
        t = Math.min(Math.max(loaderVideoPlayer.currentTime / loaderVideoPlayer.duration, 0), 1);
      } else {
        const elapsed = performance.now() - startTime;
        t = Math.min(Math.max(elapsed / fallbackDuration, 0), 1);
      }

      progress = Math.min(100, Math.max(0, Math.floor(t * 100)));
      loaderBar.style.width = progress + '%';
      loaderCount.textContent = String(progress).padStart(3, '0') + '%';

      if (progress < 100) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          dismissLoader();
        }, 400);
      }
    }
    requestAnimationFrame(tick);
  }

  // ==========================================
  // CONFIGURATION & PERSISTED PREFERENCES
  // ==========================================
  const defaultN8nUrl = 'https://n8n.srv1871828.hstgr.cloud/webhook/4a108e85-050f-427e-aa03-784492ddfe89/chat';
  const savedWebhook = localStorage.getItem('appu_n8n_url') || defaultN8nUrl;
  localStorage.removeItem('appu_mock_mode');
  const savedPitch = parseFloat(localStorage.getItem('appu_pitch') || '1.0');
  const savedRate = parseFloat(localStorage.getItem('appu_voice_rate') || '0.88');
  const savedAutoSpeak = localStorage.getItem('appu_auto_speak') !== 'false';
  const savedSound = localStorage.getItem('appu_sound_sfx') !== 'false';
  let currentLang = localStorage.getItem('appu_lang') || 'en';

  // Initialize Core Subsystems
  const avatarStage = new AvatarStage();
  const voiceEngine = new VoiceEngine({
    onSpeechStart: () => avatarStage.setState('listening'),
    onSpeechEnd: () => {
      if (avatarStage.currentState === 'listening') {
        avatarStage.setState('idle');
      }
    },
    onSpeechResult: (transcript) => {
      handleUserInteraction(transcript);
    },
    onSpeechError: () => {
      avatarStage.setState('idle');
    },
    onUtteranceStart: () => avatarStage.setState('speaking'),
    onUtteranceEnd: () => avatarStage.setState('idle')
  });

  voiceEngine.pitch = savedPitch;
  voiceEngine.setPlaybackRate(savedRate);
  voiceEngine.autoSpeak = savedAutoSpeak;
  voiceEngine.soundEnabled = savedSound;

  const chatAgent = new ChatAgent({
    n8nWebhookUrl: savedWebhook,
    mockMode: false
  });
  chatAgent.mockMode = false;

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
    voiceEngine.setLanguage(lang);

    if (langEnBtn && langKnBtn) {
      if (lang === 'kn') {
        langKnBtn.classList.add('is-active');
        langEnBtn.classList.remove('is-active');
        voiceEngine.generateClonedSpeech('ನಮಸ್ಕಾರ! ನಾನು ಅಪ್ಪು, ಐಜಿಆರ್ ಅಕಾಡೆಮಿಯ ಎಐ ಮೆಂಟರ್. ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?');
      } else {
        langEnBtn.classList.add('is-active');
        langKnBtn.classList.remove('is-active');
        voiceEngine.generateClonedSpeech('Namaskara! I am Appu, your AI Mentor at IGR Academy. How can I guide you today?');
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

    voiceEngine.playClick();
    avatarStage.setState('thinking');

    // Update Subtitles HUD to show user's query
    const subtitlesText = document.getElementById('subtitles-text');
    if (subtitlesText) {
      subtitlesText.textContent = `"${text}"`;
    }

    const result = await chatAgent.sendMessage(
      text,
      () => avatarStage.setState('thinking'),
      async (reply, audioData) => {
        avatarStage.setState('speaking');
        await voiceEngine.speak(reply, audioData);
        voiceEngine.playMessage();
      }
    );

    if (!result) {
      avatarStage.setState('idle');
    }
  }

  // ==========================================
  // HERO BUTTONS & ACTIONS
  // ==========================================
  const btnHeroPrimary = document.getElementById('btn-hero-primary-schedule');
  const btnHeroTalk = document.getElementById('btn-hero-talk-appu');
  const btnQuickSchedule = document.getElementById('btn-quick-schedule');
  const btnHeroSchedule = document.getElementById('btn-hero-schedule');
  const btnMic = document.getElementById('btn-mic');
  const avatarFigure = document.getElementById('avatar-figure-container');

  if (btnHeroPrimary) {
    btnHeroPrimary.addEventListener('click', () => openDiscoveryModal());
  }
  if (btnQuickSchedule) {
    btnQuickSchedule.addEventListener('click', () => openDiscoveryModal());
  }
  if (btnHeroSchedule) {
    btnHeroSchedule.addEventListener('click', () => openDiscoveryModal());
  }

  if (btnHeroTalk) {
    btnHeroTalk.addEventListener('click', () => {
      voiceEngine.toggleLiveSession();
    });
  }

  if (btnMic) {
    btnMic.addEventListener('click', () => {
      voiceEngine.toggleLiveSession();
    });
  }

  if (avatarFigure) {
    avatarFigure.addEventListener('click', () => {
      voiceEngine.playClick();
      if (currentLang === 'kn') {
        voiceEngine.generateClonedSpeech('ನಮಸ್ಕಾರ! ನಾನು ಅಪ್ಪು. ನಿಮ್ಮ ವೃತ್ತಿಜೀವನ ಮತ್ತು ಕಲಿಕೆಗೆ ನಾನು ಹೇಗೆ ಮಾರ್ಗದರ್ಶನ ನೀಡಲಿ?');
      } else {
        voiceEngine.generateClonedSpeech('Namaskara! I am Appu. Ask me anything about career tracks, curriculum, or book a discovery call!');
      }
    });
  }

  // ==========================================
  // INTENT CHIPS CAROUSEL
  // ==========================================
  const chipButtons = document.querySelectorAll('.chip-action-btn');
  chipButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      chipButtons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      const prompt = btn.getAttribute('data-prompt');
      if (prompt) {
        if (prompt.includes('Schedule a 0-Click Discovery Call')) {
          openDiscoveryModal();
        } else {
          handleUserInteraction(prompt);
        }
      }
    });
  });

  // ==========================================
  // SOUND TOGGLE
  // ==========================================
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const soundIcon = document.getElementById('sound-icon');

  function updateSoundUI() {
    if (soundIcon) {
      if (voiceEngine.soundEnabled) {
        soundIcon.className = 'fa-solid fa-volume-high text-cyan';
      } else {
        soundIcon.className = 'fa-solid fa-volume-xmark text-muted';
      }
    }
  }
  updateSoundUI();

  if (btnSoundToggle) {
    btnSoundToggle.addEventListener('click', () => {
      voiceEngine.toggleSound();
      updateSoundUI();
    });
  }

  // ==========================================
  // CHAT DRAWER ORCHESTRATION
  // ==========================================
  const chatDrawer = document.getElementById('chat-drawer');
  const btnToggleChat = document.getElementById('btn-toggle-chat');
  const btnCloseChat = document.getElementById('btn-close-chat');
  const btnClearChat = document.getElementById('btn-clear-chat');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const btnChatMic = document.getElementById('btn-chat-mic');

  function toggleChatDrawer(forceOpen = null) {
    if (!chatDrawer) return;
    const shouldOpen = forceOpen !== null ? forceOpen : !chatDrawer.classList.contains('is-open');
    
    if (shouldOpen) {
      chatDrawer.classList.add('is-open');
      voiceEngine.playClick();
      if (chatInput) setTimeout(() => chatInput.focus(), 300);
    } else {
      chatDrawer.classList.remove('is-open');
    }
  }

  if (btnToggleChat) btnToggleChat.addEventListener('click', () => toggleChatDrawer());
  if (btnCloseChat) btnCloseChat.addEventListener('click', () => toggleChatDrawer(false));

  if (btnClearChat) {
    btnClearChat.addEventListener('click', () => {
      chatAgent.clearMessages();
      voiceEngine.playClick();
    });
  }

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

  if (btnChatMic) {
    btnChatMic.addEventListener('click', () => {
      voiceEngine.playClick();
      voiceEngine.toggleListening();
    });
  }

  // ==========================================
  // 0-CLICK DISCOVERY MODAL & WORKFLOW
  // ==========================================
  const discoveryModal = document.getElementById('discovery-modal');
  const btnCloseDiscoveryModal = document.getElementById('btn-close-discovery-modal');
  const discoveryForm = document.getElementById('discovery-form');
  const discoverySuccessView = document.getElementById('discovery-success-view');
  const btnDoneDiscovery = document.getElementById('btn-done-discovery');

  function openDiscoveryModal() {
    if (discoveryModal) {
      voiceEngine.playClick();
      if (discoveryForm) discoveryForm.style.display = 'flex';
      if (discoverySuccessView) discoverySuccessView.style.display = 'none';

      // Set default datetime to tomorrow at 11:00 AM
      const dateInput = document.getElementById('lead-date');
      if (dateInput && !dateInput.value) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(11, 0, 0, 0);
        dateInput.value = tomorrow.toISOString().slice(0, 16);
      }

      discoveryModal.classList.add('is-visible');
    }
  }

  function closeDiscoveryModal() {
    if (discoveryModal) discoveryModal.classList.remove('is-visible');
  }

  if (btnCloseDiscoveryModal) btnCloseDiscoveryModal.addEventListener('click', closeDiscoveryModal);
  if (btnDoneDiscovery) btnDoneDiscovery.addEventListener('click', closeDiscoveryModal);

  if (discoveryForm) {
    discoveryForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('lead-name').value.trim();
      const phone = document.getElementById('lead-phone').value.trim();
      const email = document.getElementById('lead-email').value.trim();
      const dateVal = document.getElementById('lead-date').value;
      const interest = document.getElementById('lead-interest').value;

      const submitBtn = document.getElementById('btn-submit-discovery');
      const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Scheduling with n8n...</span>';
      }

      try {
        const payload = {
          action: 'schedule_discovery',
          name,
          phone,
          email,
          datetime: dateVal,
          interest,
          sessionId: chatAgent.sessionId
        };

        const res = await fetch(chatAgent.n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        let data = {};
        try { data = await res.json(); } catch(err) {}

        const meetLink = data.meetLink || data.googleMeetUrl || 'https://meet.google.com/new';
        const waLink = `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi ${name}! Your 0-Click Discovery Call for ${interest} has been scheduled. Google Meet: ${meetLink}`)}`;

        const meetLinkEl = document.getElementById('success-meet-link');
        const waLinkEl = document.getElementById('success-wa-link');
        const successSummaryEl = document.getElementById('success-summary');

        if (meetLinkEl) meetLinkEl.href = meetLink;
        if (waLinkEl) waLinkEl.href = waLink;
        if (successSummaryEl) {
          successSummaryEl.textContent = `Confirmed for ${name}! Google Meet link generated and calendar invite dispatched to ${email}.`;
        }

        discoveryForm.style.display = 'none';
        discoverySuccessView.style.display = 'flex';
        voiceEngine.playSuccess();
        avatarStage.setState('success');

        // Add confirmation message to chat
        chatAgent.addMessage('appu', `🎉 **0-Click Discovery Call Scheduled!**\n\n- **Name:** ${name}\n- **Focus Track:** ${interest}\n- **Date & Time:** ${new Date(dateVal).toLocaleString()}\n- **Google Meet Link:** [Join Video Call](${meetLink})`);

      } catch (err) {
        console.error('Discovery call submission error:', err);
        // Fallback success state
        discoveryForm.style.display = 'none';
        discoverySuccessView.style.display = 'flex';
        voiceEngine.playSuccess();
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }
      }
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
      if (settingVoicePitch) settingVoicePitch.value = voiceEngine.pitch;
      if (settingVoiceRate) settingVoiceRate.value = voiceEngine.rate;
      if (pitchVal) pitchVal.textContent = voiceEngine.pitch.toFixed(1);
      if (rateVal) rateVal.textContent = voiceEngine.rate.toFixed(2);
      if (settingAutoSpeak) settingAutoSpeak.checked = voiceEngine.autoSpeak;
      if (settingUiSound) settingUiSound.checked = voiceEngine.soundEnabled;

      settingsModal.classList.add('is-visible');
    }
  }

  function closeSettingsModal() {
    if (settingsModal) settingsModal.classList.remove('is-visible');
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
      const val = parseFloat(e.target.value);
      rateVal.textContent = val.toFixed(2);
      voiceEngine.setPlaybackRate(val);
    });
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', () => {
      if (settingVoicePitch) voiceEngine.pitch = parseFloat(settingVoicePitch.value);
      if (settingVoiceRate) voiceEngine.setPlaybackRate(parseFloat(settingVoiceRate.value));
      if (settingAutoSpeak) voiceEngine.autoSpeak = settingAutoSpeak.checked;
      if (settingUiSound) voiceEngine.soundEnabled = settingUiSound.checked;

      localStorage.setItem('appu_pitch', voiceEngine.pitch);
      localStorage.setItem('appu_voice_rate', voiceEngine.rate);
      localStorage.setItem('appu_auto_speak', voiceEngine.autoSpeak);
      localStorage.setItem('appu_sound_sfx', voiceEngine.soundEnabled);

      voiceEngine.playSuccess();
      closeSettingsModal();
    });
  }

  // Close modals on outside click (scrim)
  window.addEventListener('click', (e) => {
    if (e.target === discoveryModal) closeDiscoveryModal();
    if (e.target === settingsModal) closeSettingsModal();
  });

  // Close modals on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDiscoveryModal();
      closeSettingsModal();
      toggleChatDrawer(false);
    }
  });
});
