/**
 * Main Application Orchestrator v4.0 for Appu AI Digital Mentor
 * Connects AvatarStage, VoiceEngine, ChatAgent, Modals, Audio SFX, Guest Access Control, and Secure Backend Gateway.
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
    loaderVideoPlayer.playbackRate = 2.0; // 2x playback speed
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
  localStorage.removeItem('appu_n8n_url');
  localStorage.removeItem('appu_mock_mode');
  const savedRate = parseFloat(localStorage.getItem('appu_voice_rate') || '0.88');
  const savedAutoSpeak = localStorage.getItem('appu_auto_speak') !== 'false';
  const savedSound = localStorage.getItem('appu_sound_sfx') !== 'false';
  let currentLang = localStorage.getItem('appu_lang') || 'en';

  // Initialize Core Subsystems
  const avatarStage = new AvatarStage();
  const voiceEngine = new VoiceEngine({
    onSpeechStart: () => avatarStage.setState('speaking'),
    onSpeechEnd: () => avatarStage.setState('idle'),
    onTranscript: (transcript) => handleUserInteraction(transcript),
    onInterimTranscript: (transcript) => {
      const subtitlesText = document.getElementById('subtitles-text');
      if (subtitlesText) subtitlesText.textContent = transcript;
    }
  });

  voiceEngine.setPlaybackRate(savedRate);
  voiceEngine.autoSpeak = savedAutoSpeak;
  voiceEngine.soundEnabled = savedSound;

  const chatAgent = new ChatAgent({
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
    showGuestGateModal,
    closeGuestGateModal,
    updateGuestBadge,
    onGuestLimitReached,
    toggleChatDrawer,
    handleUserInteraction,
    setLanguage
  };

  const appShell = document.getElementById('app-shell');
  let activeDialog = null;
  let lastFocusedElement = null;

  function focusableElements(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(element => !element.hidden && element.offsetParent !== null);
  }

  function activateDialog(dialog, preferredFocus) {
    if (!dialog) return;
    lastFocusedElement = document.activeElement;
    activeDialog = dialog;
    dialog.setAttribute('aria-hidden', 'false');
    const target = preferredFocus || focusableElements(dialog)[0];
    if (target) target.focus();
    if (appShell) appShell.inert = true;
    if (target) window.requestAnimationFrame(() => target.focus());
    if (target) window.setTimeout(() => {
      if (activeDialog === dialog) target.focus();
    }, 160);
  }

  function deactivateDialog(dialog) {
    if (!dialog) return;
    if (dialog.contains(document.activeElement)) {
      if (lastFocusedElement?.isConnected && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
      } else if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    }
    if (appShell) appShell.inert = false;
    dialog.setAttribute('aria-hidden', 'true');
    if (activeDialog === dialog) activeDialog = null;
  }

  // ==========================================
  // GUEST ACCESS & 3-TURN LIMIT GATE
  // ==========================================
  const guestLimitModal = document.getElementById('guest-limit-modal');
  const btnCloseGuestLimit = document.getElementById('btn-close-guest-limit');
  const btnGuestSignin = document.getElementById('btn-guest-signin');
  const btnGuestRegister = document.getElementById('btn-guest-register');
  const btnGuestPlans = document.getElementById('btn-guest-plans');
  const guestAccessBadge = document.getElementById('guest-access-badge');
  const guestAccessText = document.getElementById('guest-access-text');

  let currentGuestRemaining = 3;

  function showGuestGateModal() {
    if (!guestLimitModal) return;
    guestLimitModal.classList.add('is-visible');
    activateDialog(guestLimitModal, btnGuestSignin);
    voiceEngine.playClick();
  }

  function closeGuestGateModal() {
    if (!guestLimitModal) return;
    guestLimitModal.classList.remove('is-visible');
    deactivateDialog(guestLimitModal);
  }

  function updateGuestBadge(guestData) {
    const isAuthed = typeof window.AppuSession !== 'undefined' &&
      typeof window.AppuSession.isAuthenticated === 'function' &&
      window.AppuSession.isAuthenticated();

    if (isAuthed || !guestAccessBadge) {
      if (guestAccessBadge) guestAccessBadge.classList.add('is-hidden');
      return;
    }

    guestAccessBadge.classList.remove('is-hidden');

    if (guestData) {
      if (typeof guestData.remaining === 'number') {
        currentGuestRemaining = guestData.remaining;
      } else if (guestData.guest && typeof guestData.guest.remaining === 'number') {
        currentGuestRemaining = guestData.guest.remaining;
      } else if (guestData.guestSession && typeof guestData.guestSession.remaining === 'number') {
        currentGuestRemaining = guestData.guestSession.remaining;
      }
    }

    guestAccessBadge.classList.remove('is-warning', 'is-exhausted');

    if (currentGuestRemaining === 3) {
      if (guestAccessText) guestAccessText.textContent = '3 complimentary chats available';
    } else if (currentGuestRemaining === 2) {
      if (guestAccessText) guestAccessText.textContent = '2 complimentary chats remaining';
    } else if (currentGuestRemaining === 1) {
      if (guestAccessText) guestAccessText.textContent = '1 complimentary chat remaining';
      guestAccessBadge.classList.add('is-warning');
    } else {
      if (guestAccessText) guestAccessText.textContent = '0 complimentary chats remaining';
      guestAccessBadge.classList.add('is-exhausted');
    }
  }

  function onGuestLimitReached(err) {
    currentGuestRemaining = 0;
    updateGuestBadge({ remaining: 0, used: 3 });
    showGuestGateModal();

    const subtitlesText = document.getElementById('subtitles-text');
    if (subtitlesText) {
      subtitlesText.textContent = 'Your complimentary APPU chats are complete. Sign in to continue learning!';
    }
    avatarStage.setState('idle');
  }

  if (btnGuestSignin) {
    btnGuestSignin.addEventListener('click', () => {
      closeGuestGateModal();
      if (window.ParentSetupUI && typeof window.ParentSetupUI.openModal === 'function') {
        window.ParentSetupUI.openModal(1);
      }
    });
  }

  if (btnGuestRegister) {
    btnGuestRegister.addEventListener('click', () => {
      closeGuestGateModal();
      if (window.ParentSetupUI && typeof window.ParentSetupUI.openModal === 'function') {
        window.ParentSetupUI.openModal(1);
      }
    });
  }

  if (btnGuestPlans) {
    btnGuestPlans.addEventListener('click', () => {
      closeGuestGateModal();
      if (window.ParentSetupUI && typeof window.ParentSetupUI.openModal === 'function') {
        window.ParentSetupUI.openModal(2);
      }
    });
  }

  if (btnCloseGuestLimit) {
    btnCloseGuestLimit.addEventListener('click', closeGuestGateModal);
  }

  // Load initial guest status
  if (typeof window.AppuBackendClient !== 'undefined' && typeof window.AppuBackendClient.getGuestStatus === 'function') {
    window.AppuBackendClient.getGuestStatus().then((status) => {
      updateGuestBadge(status);
    }).catch(() => {});
  }

  // ==========================================
  // LANGUAGE TOGGLE HANDLER (ENG / KANNADA)
  // ==========================================
  const langEnBtn = document.getElementById('lang-en');
  const langKnBtn = document.getElementById('lang-kn');
  voiceEngine.setLanguage(currentLang);
  if (langEnBtn && langKnBtn) {
    langEnBtn.classList.toggle('is-active', currentLang === 'en');
    langKnBtn.classList.toggle('is-active', currentLang === 'kn');
  }

  function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('appu_lang', lang);
    voiceEngine.setLanguage(lang);

    if (langEnBtn && langKnBtn) {
      if (lang === 'kn') {
        langKnBtn.classList.add('is-active');
        langEnBtn.classList.remove('is-active');
        voiceEngine.streamSubtitles('ಕನ್ನಡ ಆಯ್ಕೆಮಾಡಲಾಗಿದೆ. ಅಪ್ಪುವನ್ನು ಏನಾದರೂ ಕೇಳಿ!');
      } else {
        langEnBtn.classList.add('is-active');
        langKnBtn.classList.remove('is-active');
        voiceEngine.streamSubtitles('English selected. Ask Appu anything!');
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

    const isAuthed = typeof window.AppuSession !== 'undefined' &&
      typeof window.AppuSession.isAuthenticated === 'function' &&
      window.AppuSession.isAuthenticated();

    // If unauthenticated and known guest limit reached, gate immediately
    if (!isAuthed && currentGuestRemaining <= 0) {
      voiceEngine.playClick();
      showGuestGateModal();
      const subtitlesText = document.getElementById('subtitles-text');
      if (subtitlesText) {
        subtitlesText.textContent = 'Your complimentary APPU chats are complete. Sign in to continue learning!';
      }
      return;
    }

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
        handleUserInteraction('ನಮಸ್ಕಾರ ಅಪ್ಪು! ನನ್ನ ಕಲಿಕೆಯ ಸಂಗಾತಿಯಾಗಿ ಪರಿಚಯಿಸಿಕೊಂಡು, ನಾನು ಏನು ಕಲಿಯಲು ಬಯಸುತ್ತೇನೆ ಎಂದು ಕೇಳಿ.');
      } else {
        handleUserInteraction('Namaskara Appu! Introduce yourself as my learning companion and ask what I want to learn.');
      }
    });
  }

  // ==========================================
  // INTENT CHIPS CAROUSEL
  // ==========================================
  const chipButtons = document.querySelectorAll('.chip-action-btn');
  chipButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      chipButtons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      const prompt = btn.getAttribute('data-prompt');
      if (prompt) {
        handleUserInteraction(prompt);
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
  const chatScrim = document.getElementById('chat-scrim');
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
      if (chatScrim) chatScrim.classList.add('is-visible');
      activateDialog(chatDrawer, btnCloseChat);
      voiceEngine.playClick();
      updateGuestBadge();
    } else {
      chatDrawer.classList.remove('is-open');
      if (chatScrim) chatScrim.classList.remove('is-visible');
      deactivateDialog(chatDrawer);
    }
  }

  if (btnToggleChat) {
    btnToggleChat.addEventListener('click', () => toggleChatDrawer(true));
  }
  if (btnCloseChat) {
    btnCloseChat.addEventListener('click', () => toggleChatDrawer(false));
  }
  if (chatScrim) {
    chatScrim.addEventListener('click', () => toggleChatDrawer(false));
  }

  if (btnClearChat) {
    btnClearChat.addEventListener('click', () => {
      voiceEngine.playClick();
      chatAgent.clearHistory();
    });
  }

  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      chatInput.value = '';
      handleUserInteraction(text);
    });
  }

  if (btnChatMic) {
    btnChatMic.addEventListener('click', () => {
      voiceEngine.toggleLiveSession();
    });
  }

  // ==========================================
  // DISCOVERY MODAL & CALENDAR INTEGRATION
  // ==========================================
  const discoveryModal = document.getElementById('discovery-modal');
  const btnCloseDiscovery = document.getElementById('btn-close-discovery-modal');
  const discoveryForm = document.getElementById('discovery-form');
  const discoverySuccessView = document.getElementById('discovery-success-view');
  const btnDoneDiscovery = document.getElementById('btn-done-discovery');

  function openDiscoveryModal() {
    if (discoveryModal) {
      if (discoveryForm) discoveryForm.style.display = 'block';
      if (discoverySuccessView) discoverySuccessView.style.display = 'none';

      // Prefill default datetime (tomorrow 11:00 AM)
      const leadDate = document.getElementById('lead-date');
      if (leadDate && !leadDate.value) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(11, 0, 0, 0);
        leadDate.value = tomorrow.toISOString().slice(0, 16);
      }

      discoveryModal.classList.add('is-visible');
      activateDialog(discoveryModal, discoveryModal);
    }
  }

  function closeDiscoveryModal() {
    if (discoveryModal) {
      discoveryModal.classList.remove('is-visible');
      deactivateDialog(discoveryModal);
    }
  }

  if (btnCloseDiscovery) btnCloseDiscovery.addEventListener('click', closeDiscoveryModal);
  if (btnDoneDiscovery) btnDoneDiscovery.addEventListener('click', closeDiscoveryModal);

  if (discoveryForm) {
    discoveryForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('lead-name')?.value?.trim();
      const phone = document.getElementById('lead-phone')?.value?.trim();
      const email = document.getElementById('lead-email')?.value?.trim();
      const dateVal = document.getElementById('lead-date')?.value;
      const interest = document.getElementById('lead-interest')?.value;

      const submitBtn = document.getElementById('btn-submit-discovery');
      const originalBtnText = submitBtn ? submitBtn.innerHTML : '';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Scheduling...';
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

        const res = await fetch(chatAgent.n8nWebhookUrl || defaultN8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        let data = {};
        try { data = await res.json(); } catch(err) {}

        const meetLink = data.meetLink || data.googleMeetUrl || 'https://meet.google.com/new';
        const waLink = `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi ${name}! Your IGR Academy learning support call for ${interest} has been scheduled. Google Meet: ${meetLink}`)}`;

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
        chatAgent.addMessage('appu', `🎉 Parent learning support call scheduled!\nName: ${name}\nSupport: ${interest}\nDate and time: ${new Date(dateVal).toLocaleString()}\nMeeting link: ${meetLink}`);

      } catch (err) {
        console.error('Discovery call submission error:', err);
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

  const settingVoiceRate = document.getElementById('setting-voice-rate');
  const settingAutoSpeak = document.getElementById('setting-auto-speak');
  const settingUiSound = document.getElementById('setting-ui-sound');
  const rateVal = document.getElementById('rate-val');

  function openSettingsModal() {
    if (settingsModal) {
      if (settingVoiceRate) settingVoiceRate.value = voiceEngine.rate;
      if (rateVal) rateVal.textContent = voiceEngine.rate.toFixed(2);
      if (settingAutoSpeak) settingAutoSpeak.checked = voiceEngine.autoSpeak;
      if (settingUiSound) settingUiSound.checked = voiceEngine.soundEnabled;

      settingsModal.classList.add('is-visible');
      activateDialog(settingsModal, settingsModal);
    }
  }

  function closeSettingsModal() {
    if (settingsModal) {
      settingsModal.classList.remove('is-visible');
      deactivateDialog(settingsModal);
    }
  }

  if (btnSettings) btnSettings.addEventListener('click', openSettingsModal);
  if (btnCloseSettings) btnCloseSettings.addEventListener('click', closeSettingsModal);

  if (settingVoiceRate && rateVal) {
    settingVoiceRate.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      rateVal.textContent = val.toFixed(2);
      voiceEngine.setPlaybackRate(val);
    });
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', () => {
      if (settingVoiceRate) voiceEngine.setPlaybackRate(parseFloat(settingVoiceRate.value));
      if (settingAutoSpeak) voiceEngine.autoSpeak = settingAutoSpeak.checked;
      if (settingUiSound) voiceEngine.soundEnabled = settingUiSound.checked;

      localStorage.setItem('appu_voice_rate', voiceEngine.rate);
      localStorage.setItem('appu_auto_speak', voiceEngine.autoSpeak);
      localStorage.setItem('appu_sound_sfx', voiceEngine.soundEnabled);

      voiceEngine.playSuccess();
      closeSettingsModal();
    });
  }

  // Initialize Phase 2 Parent Setup UI
  if (typeof window.ParentSetupUI !== 'undefined' && typeof window.ParentSetupUI.init === 'function') {
    window.ParentSetupUI.init();
  }

  // Restore authenticated session after page refresh
  if (typeof window.ParentOnboardingShell !== 'undefined' && typeof window.ParentOnboardingShell.restoreSession === 'function') {
    window.ParentOnboardingShell.restoreSession().then(() => {
      updateGuestBadge();
    }).catch((err) => {
      console.warn('[Appu] Session restoration warning:', err?.message || err);
      updateGuestBadge();
    });
  } else if (typeof window.ParentOnboardingShell !== 'undefined' && typeof window.ParentOnboardingShell.updateHeaderSessionBadge === 'function') {
    window.ParentOnboardingShell.updateHeaderSessionBadge();
    updateGuestBadge();
  }

  const parentSetupModal = document.getElementById('parent-setup-modal');

  // Close modals on outside click (scrim)
  window.addEventListener('click', (e) => {
    if (e.target === discoveryModal) closeDiscoveryModal();
    if (e.target === settingsModal) closeSettingsModal();
    if (e.target === guestLimitModal) closeGuestGateModal();
    if (e.target === parentSetupModal && parentSetupModal) {
      if (typeof window.ParentSetupUI !== 'undefined' && typeof window.ParentSetupUI.closeModal === 'function') {
        window.ParentSetupUI.closeModal();
      } else {
        if (parentSetupModal.contains(document.activeElement)) {
          const btnOpen = document.getElementById('btn-parent-setup');
          if (btnOpen?.isConnected) btnOpen.focus();
          else if (document.activeElement) document.activeElement.blur();
        }
        parentSetupModal.classList.remove('is-visible');
        parentSetupModal.setAttribute('aria-hidden', 'true');
      }
    }
  });

  // Close modals on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && activeDialog) {
      const items = focusableElements(activeDialog);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    if (e.key === 'Escape') {
      closeDiscoveryModal();
      closeSettingsModal();
      closeGuestGateModal();
      if (parentSetupModal && parentSetupModal.classList.contains('is-visible')) {
        if (typeof window.ParentSetupUI !== 'undefined' && typeof window.ParentSetupUI.closeModal === 'function') {
          window.ParentSetupUI.closeModal();
        } else {
          if (parentSetupModal.contains(document.activeElement)) {
            const btnOpen = document.getElementById('btn-parent-setup');
            if (btnOpen?.isConnected) btnOpen.focus();
            else if (document.activeElement) document.activeElement.blur();
          }
          parentSetupModal.classList.remove('is-visible');
          parentSetupModal.setAttribute('aria-hidden', 'true');
        }
      }
      toggleChatDrawer(false);
    }
  });
});
