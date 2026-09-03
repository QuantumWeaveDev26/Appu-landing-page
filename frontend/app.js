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
    mockMode: false,
    voiceEngine
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
  const btnBetaBannerCta = document.getElementById('beta-banner-cta');
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
    const hasAuthenticatedParent = typeof window.ParentOnboardingShell !== 'undefined' &&
      typeof window.ParentOnboardingShell.isParentAuthenticated === 'function' &&
      window.ParentOnboardingShell.isParentAuthenticated();
    const isAuthed = hasAuthenticatedParent || (typeof window.AppuSession !== 'undefined' &&
      typeof window.AppuSession.isAuthenticated === 'function' &&
      window.AppuSession.isAuthenticated());

    if (isAuthed || !guestAccessBadge) {
      if (guestAccessBadge) guestAccessBadge.classList.add('is-hidden');
      return;
    }

    // BETA: guests can't chat anonymously anymore -- point them at signup instead of a chat count.
    if (typeof APPU_CONFIG !== 'undefined' && APPU_CONFIG.betaMode) {
      guestAccessBadge.classList.remove('is-hidden', 'is-warning', 'is-exhausted');
      if (guestAccessText) guestAccessText.textContent = 'Sign up free for 30 beta chats';
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

    if (currentGuestRemaining <= 0) {
      if (guestAccessText) guestAccessText.textContent = '0 complimentary chats remaining';
      guestAccessBadge.classList.add('is-exhausted');
    } else if (currentGuestRemaining === 1) {
      if (guestAccessText) guestAccessText.textContent = '1 complimentary chat remaining';
      guestAccessBadge.classList.add('is-warning');
    } else {
      if (guestAccessText) guestAccessText.textContent = `${currentGuestRemaining} complimentary chats remaining`;
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

  if (btnBetaBannerCta) {
    btnBetaBannerCta.addEventListener('click', () => {
      if (window.ParentSetupUI && typeof window.ParentSetupUI.openModal === 'function') {
        window.ParentSetupUI.openModal(1);
      }
    });
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
  // CENTRALIZED UI TRANSLATION LAYER
  // ==========================================
  const UI_TRANSLATIONS = {
    en: {
      statusLabel: 'Appu is ready',
      missionEyebrow: '✦ Your learning mission starts here',
      missionTitleHtml: 'What will we <span>discover today?</span>',
      missionSubtitle: 'Choose a mission or ask Appu anything from class 5 to 12.',
      companionTag: 'AI learning companion',
      chipExplainTitle: 'Explain My Topic',
      chipExplainDesc: 'Make a tricky idea feel simple',
      chipExplainPrompt: 'Explain a school topic to me in a simple, fun way. Start by asking which topic and class I am in.',
      chipQuizTitle: 'Play a Quick Quiz',
      chipQuizDesc: 'Five fun questions, one at a time',
      chipQuizPrompt: 'Play a quick five-question quiz with me. Start by asking my class and favorite subject.',
      chipHomeworkTitle: 'Homework Helper',
      chipHomeworkDesc: 'Get hints and learn each step',
      chipHomeworkPrompt: 'Help me with my homework without simply giving the answer. Ask me to share the question and guide me step by step.',
      chipExamTitle: 'Exam Practice',
      chipExamDesc: 'Revise smarter and build confidence',
      chipExamPrompt: 'Help me practise for an exam. Start by asking my class, subject, chapter, and exam date.',
      appuSaysLabel: 'Appu says',
      subtitlesGreeting: 'English selected. Ask Appu anything!',
      typeInstead: 'Type instead',
      askAppu: 'Ask Appu',
      parentSetup: 'Parent Setup',
      chatTitle: 'Chat with Appu',
      chatSubtitle: 'Ask, explore, understand',
      chatPlaceholder: 'Ask about science, maths, homework…',
      guestAccessSuffix: 'complimentary chats available',
      avatarIntroPrompt: 'Namaskara Appu! Introduce yourself as my learning companion and ask what I want to learn.',
      betaBannerText: '🎉 APPU is in Public Beta — try it free, 30 chats included, no card required',
      betaBannerCta: 'Try Beta — Sign Up Free',
      settingsKicker: 'Preferences',
      settingsTitle: 'Make Appu comfortable for you',
      settingsLead: 'Adjust how answers sound and how the page responds.',
      settingRateTitle: 'Speaking speed',
      settingRateDesc: 'Slower can make explanations easier to follow.',
      settingAutospeakTitle: 'Play answers aloud',
      settingAutospeakDesc: 'Appu speaks when audio is available.',
      settingUisoundTitle: 'Sound effects',
      settingUisoundDesc: 'Gentle feedback for taps and actions.',
      btnSaveSettings: 'Save preferences',
      discoveryKicker: 'Parent Zone',
      discoveryTitle: 'Plan a learning support call',
      discoveryLead: 'For a parent/guardian: choose a convenient time to speak with an IGR Academy mentor about your learner.',
      leadNameLabel: 'Parent/Guardian name',
      leadNamePlaceholder: 'Your full name',
      leadPhoneLabel: 'WhatsApp number',
      leadEmailLabel: 'Email for the meeting',
      leadDateLabel: 'Preferred date and time',
      leadInterestLabel: 'What support would help most?',
      interestRoadmap: 'A personal learning roadmap',
      interestHomework: 'Homework and concept support',
      interestExam: 'Exam preparation',
      interestAi: 'AI and coding skills',
      discoveryPrivacyNote: 'Your details are used only to arrange this support call.',
      btnSubmitDiscovery: 'Book parent call',
      discoverySuccessTitle: "You're all set!",
      successMeetLink: 'Open meeting link',
      successWaLink: 'Open WhatsApp',
      btnDoneDiscovery: 'Return to Appu'
    },
    kn: {
      statusLabel: 'ಅಪ್ಪು ಸಿದ್ಧವಾಗಿದ್ದಾನೆ',
      missionEyebrow: '✦ ನಿಮ್ಮ ಕಲಿಕೆಯ ಪಯಣ ಇಲ್ಲಿಂದ ಆರಂಭ',
      missionTitleHtml: 'ಇಂದು ನಾವು ಏನು <span>ಕಲಿಯೋಣ?</span>',
      missionSubtitle: 'ಕಲಿಕೆಯ ವಿಷಯವನ್ನು ಆರಿಸಿ ಅಥವಾ 5 ರಿಂದ 12ನೇ ತರಗತಿಯ ಯಾವುದೇ ಪ್ರಶ್ನೆಯನ್ನು ಅಪ್ಪುವಿಗೆ ಕೇಳಿ.',
      companionTag: 'ಎಐ ಕಲಿಕಾ ಸಂಗಾತಿ',
      chipExplainTitle: 'ವಿಷಯ ವಿವರಿಸಿ',
      chipExplainDesc: 'ಕಷ್ಟಕರ ವಿಷಯವನ್ನು ಸುಲಭವಾಗಿ ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ',
      chipExplainPrompt: 'ನನ್ನ ಶಾಲಾ ವಿಷಯವನ್ನು ಸರಳ ಹಾಗೂ ಆಸಕ್ತಿದಾಯಕವಾಗಿ ವಿವರಿಸಿ. ನಾನು ಯಾವ ತರಗತಿ ಮತ್ತು ಯಾವ ವಿಷಯ ಕಲಿಯಬೇಕೆಂದು ಕೇಳಿ ಪ್ರಾರಂಭಿಸಿ.',
      chipQuizTitle: 'ರಸಪ್ರಶ್ನೆ ಆಡಿ',
      chipQuizDesc: 'ಐದು ಮೋಜಿನ ಪ್ರಶ್ನೆಗಳು, ಒಂದೊಂದಾಗಿ',
      chipQuizPrompt: 'ನನ್ನೊಂದಿಗೆ 5 ಪ್ರಶ್ನೆಗಳ ಒಂದು ಸಣ್ಣ ರಸಪ್ರಶ್ನೆ ಆಡಿ. ನನ್ನ ತರಗತಿ ಮತ್ತು ಮೆಚ್ಚಿನ ವಿಷಯವನ್ನು ಕೇಳಿ ಪ್ರಾರಂಭಿಸಿ.',
      chipHomeworkTitle: 'ಮನೆಕೆಲಸದ ಸಹಾಯಕ',
      chipHomeworkDesc: 'ಸುಳಿವು ಪಡೆಯಿರಿ ಮತ್ತು ಹಂತ-ಹಂತವಾಗಿ ಕಲಿಯಿರಿ',
      chipHomeworkPrompt: 'ಕೇವಲ ಉತ್ತರ ನೀಡದೆ, ನನ್ನ ಮನೆಕೆಲಸದಲ್ಲಿ ನನಗೆ ಸಹಾಯ ಮಾಡಿ. ಪ್ರಶ್ನೆಯನ್ನು ಕೇಳಿ ಹಂತ-ಹಂತವಾಗಿ ಮಾರ್ಗದರ್ಶನ ನೀಡಿ.',
      chipExamTitle: 'ಪರೀಕ್ಷಾ ತಯಾರಿ',
      chipExamDesc: 'ಉತ್ತಮವಾಗಿ ಪುನರಾವರ್ತಿಸಿ ಮತ್ತು ಆತ್ಮವಿಶ್ವಾಸ ಹೆಚ್ಚಿಸಿಕೊಳ್ಳಿ',
      chipExamPrompt: 'ನನ್ನ ಪರೀಕ್ಷೆಗೆ ಸಿದ್ಧತೆ ನಡೆಸಲು ಸಹಾಯ ಮಾಡಿ. ನನ್ನ ತರಗತಿ, ವಿಷಯ, ಅಧ್ಯಾಯ ಮತ್ತು ಪರೀಕ್ಷೆಯ ದಿನಾಂಕವನ್ನು ಕೇಳಿ ಪ್ರಾರಂಭಿಸಿ.',
      appuSaysLabel: 'ಅಪ್ಪು ಹೇಳುತ್ತಾನೆ',
      subtitlesGreeting: 'ಕನ್ನಡ ಆಯ್ಕೆಮಾಡಲಾಗಿದೆ. ಅಪ್ಪುವನ್ನು ಏನಾದರೂ ಕೇಳಿ!',
      typeInstead: 'ಬರೆಯಿರಿ',
      askAppu: 'ಅಪ್ಪುವನ್ನು ಕೇಳಿ',
      parentSetup: 'ಪೋಷಕರ ವಲಯ',
      chatTitle: 'ಅಪ್ಪುವಿನೊಂದಿಗೆ ಸಂಭಾಷಣೆ',
      chatSubtitle: 'ಕೇಳಿ, ಅನ್ವೇಷಿಸಿ, ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ',
      chatPlaceholder: 'ವಿಜ್ಞಾನ, ಗಣಿತ, ಮನೆಕೆಲಸದ ಬಗ್ಗೆ ಕೇಳಿ…',
      guestAccessSuffix: 'ಉಚಿತ ಸಂಭಾಷಣೆಗಳು ಲಭ್ಯವಿದೆ',
      avatarIntroPrompt: 'ನಮಸ್ಕಾರ ಅಪ್ಪು! ನನ್ನ ಕಲಿಕೆಯ ಸಂಗಾತಿಯಾಗಿ ಪರಿಚಯಿಸಿಕೊಂಡು, ನಾನು ಏನು ಕಲಿಯಲು ಬಯಸುತ್ತೇನೆ ಎಂದು ಕೇಳಿ.',
      betaBannerText: '🎉 APPU ಈಗ ಸಾರ್ವಜನಿಕ ಬೀಟಾದಲ್ಲಿ ಲಭ್ಯವಿದೆ — ಉಚಿತವಾಗಿ ಪ್ರಯತ್ನಿಸಿ, 30 ಸಂಭಾಷಣೆಗಳು ಸೇರಿವೆ, ಕಾರ್ಡ್ ಅಗತ್ಯವಿಲ್ಲ',
      betaBannerCta: 'ಬೀಟಾ ಪ್ರಯತ್ನಿಸಿ — ಉಚಿತವಾಗಿ ನೋಂದಾಯಿಸಿ',
      settingsKicker: 'ಆದ್ಯತೆಗಳು',
      settingsTitle: 'ಅಪ್ಪುವನ್ನು ನಿಮಗೆ ಅನುಕೂಲಕರವಾಗಿಸಿ',
      settingsLead: 'ಉತ್ತರಗಳು ಹೇಗೆ ಕೇಳಿಸುತ್ತವೆ ಮತ್ತು ಪುಟ ಹೇಗೆ ಪ್ರತಿಕ್ರಿಯಿಸುತ್ತದೆ ಎಂಬುದನ್ನು ಹೊಂದಿಸಿ.',
      settingRateTitle: 'ಮಾತಿನ ವೇಗ',
      settingRateDesc: 'ನಿಧಾನವಾದರೆ ವಿವರಣೆಗಳನ್ನು ಅನುಸರಿಸುವುದು ಸುಲಭ.',
      settingAutospeakTitle: 'ಉತ್ತರಗಳನ್ನು ಗಟ್ಟಿಯಾಗಿ ಓದಿ',
      settingAutospeakDesc: 'ಆಡಿಯೋ ಲಭ್ಯವಿದ್ದಾಗ ಅಪ್ಪು ಮಾತನಾಡುತ್ತಾನೆ.',
      settingUisoundTitle: 'ಧ್ವನಿ ಪರಿಣಾಮಗಳು',
      settingUisoundDesc: 'ಟ್ಯಾಪ್ ಮತ್ತು ಕ್ರಿಯೆಗಳಿಗೆ ಮೃದುವಾದ ಪ್ರತಿಕ್ರಿಯೆ.',
      btnSaveSettings: 'ಆದ್ಯತೆಗಳನ್ನು ಉಳಿಸಿ',
      discoveryKicker: 'ಪೋಷಕರ ವಲಯ',
      discoveryTitle: 'ಕಲಿಕಾ ಬೆಂಬಲ ಕರೆಯನ್ನು ಯೋಜಿಸಿ',
      discoveryLead: 'ಪೋಷಕ/ಪಾಲಕರಿಗಾಗಿ: ನಿಮ್ಮ ಕಲಿಕಾರ್ಥಿಯ ಬಗ್ಗೆ IGR ಅಕಾಡೆಮಿಯ ಮಾರ್ಗದರ್ಶಕರೊಂದಿಗೆ ಮಾತನಾಡಲು ಅನುಕೂಲಕರ ಸಮಯವನ್ನು ಆರಿಸಿ.',
      leadNameLabel: 'ಪೋಷಕ/ಪಾಲಕರ ಹೆಸರು',
      leadNamePlaceholder: 'ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು',
      leadPhoneLabel: 'WhatsApp ಸಂಖ್ಯೆ',
      leadEmailLabel: 'ಸಭೆಗಾಗಿ ಇಮೇಲ್',
      leadDateLabel: 'ಆದ್ಯತೆಯ ದಿನಾಂಕ ಮತ್ತು ಸಮಯ',
      leadInterestLabel: 'ಯಾವ ಬೆಂಬಲ ಹೆಚ್ಚು ಸಹಾಯಕವಾಗುತ್ತದೆ?',
      interestRoadmap: 'ವೈಯಕ್ತಿಕ ಕಲಿಕಾ ಮಾರ್ಗಸೂಚಿ',
      interestHomework: 'ಮನೆಕೆಲಸ ಮತ್ತು ಪರಿಕಲ್ಪನೆ ಬೆಂಬಲ',
      interestExam: 'ಪರೀಕ್ಷಾ ತಯಾರಿ',
      interestAi: 'ಎಐ ಮತ್ತು ಕೋಡಿಂಗ್ ಕೌಶಲ್ಯಗಳು',
      discoveryPrivacyNote: 'ಈ ಬೆಂಬಲ ಕರೆಯನ್ನು ಏರ್ಪಡಿಸಲು ಮಾತ್ರ ನಿಮ್ಮ ವಿವರಗಳನ್ನು ಬಳಸಲಾಗುತ್ತದೆ.',
      btnSubmitDiscovery: 'ಪೋಷಕರ ಕರೆ ಬುಕ್ ಮಾಡಿ',
      discoverySuccessTitle: 'ನೀವು ಸಿದ್ಧರಿದ್ದೀರಿ!',
      successMeetLink: 'ಮೀಟಿಂಗ್ ಲಿಂಕ್ ತೆರೆಯಿರಿ',
      successWaLink: 'WhatsApp ತೆರೆಯಿರಿ',
      btnDoneDiscovery: 'ಅಪ್ಪುಗೆ ಹಿಂತಿರುಗಿ'
    },
    hi: {
      statusLabel: 'अप्पू तैयार है',
      missionEyebrow: '✦ आपकी सीखने की यात्रा यहाँ से शुरू होती है',
      missionTitleHtml: 'आज हम क्या नया <span>सीखेंगे?</span>',
      missionSubtitle: 'कोई विषय चुनें या कक्षा 5 से 12 तक का कोई भी सवाल अप्पू से पूछें।',
      companionTag: 'एआई लर्निंग साथी',
      chipExplainTitle: 'विषय समझाओ',
      chipExplainDesc: 'कठिन विषय को आसान बनाएं',
      chipExplainPrompt: 'मेरे स्कूल के विषय को आसान और मज़ेदार तरीके से समझाओ। मुझसे पूछो कि मैं कौन सी कक्षा में हूँ और क्या पढ़ना चाहता हूँ।',
      chipQuizTitle: 'क्विज़ खेलें',
      chipQuizDesc: 'पांच मज़ेदार सवाल, एक-एक करके',
      chipQuizPrompt: 'मेरे साथ 5 सवालों की एक छोटी क्विज़ खेलो। मेरी कक्षा और पसंदीदा विषय पूछकर शुरू करो।',
      chipHomeworkTitle: 'होमवर्क हेल्पर',
      chipHomeworkDesc: 'संकेत पाएं और हर कदम सीखें',
      chipHomeworkPrompt: 'सीधे उत्तर दिए बिना मेरे होमवर्क में मदद करो। मुझसे सवाल पूछो और कदम-दर-कदम मार्गदर्शन करो।',
      chipExamTitle: 'परीक्षा अभ्यास',
      chipExamDesc: 'स्मार्ट रिवीजन करें और आत्मविश्वास बढ़ाएं',
      chipExamPrompt: 'मेरी परीक्षा की तैयारी में मदद करो। मेरी कक्षा, विषय, अध्याय और परीक्षा की तारीख पूछकर शुरू करो।',
      appuSaysLabel: 'अप्पू कहता है',
      subtitlesGreeting: 'हिंदी चुनी गई। अप्पू से कुछ भी पूछें!',
      typeInstead: 'टाइप करें',
      askAppu: 'अप्पू से पूछें',
      parentSetup: 'पेरेंट सेटअप',
      chatTitle: 'अप्पू से बातचीत',
      chatSubtitle: 'पूछें, सीखें, समझें',
      chatPlaceholder: 'विज्ञान, गणित, होमवर्क के बारे में पूछें…',
      guestAccessSuffix: 'निःशुल्क बातचीत उपलब्ध हैं',
      avatarIntroPrompt: 'नमस्ते अप्पू! अपने आप को मेरे सीखने के साथी के रूप में पेश करो और पूछो कि मैं क्या सीखना चाहता हूँ।',
      betaBannerText: '🎉 APPU अभी सार्वजनिक बीटा में है — मुफ़्त में आज़माएं, 30 बातचीत शामिल, कार्ड की ज़रूरत नहीं',
      betaBannerCta: 'बीटा आज़माएं — मुफ़्त साइन अप करें',
      settingsKicker: 'प्राथमिकताएं',
      settingsTitle: 'अप्पू को अपने अनुसार आरामदायक बनाएं',
      settingsLead: 'उत्तर कैसे सुनाई दें और पेज कैसे प्रतिक्रिया दे, इसे समायोजित करें।',
      settingRateTitle: 'बोलने की गति',
      settingRateDesc: 'धीमी गति से समझाना आसान हो सकता है।',
      settingAutospeakTitle: 'उत्तर ज़ोर से सुनाएं',
      settingAutospeakDesc: 'ऑडियो उपलब्ध होने पर अप्पू बोलता है।',
      settingUisoundTitle: 'ध्वनि प्रभाव',
      settingUisoundDesc: 'टैप और क्रियाओं के लिए हल्की प्रतिक्रिया।',
      btnSaveSettings: 'प्राथमिकताएं सहेजें',
      discoveryKicker: 'पेरेंट ज़ोन',
      discoveryTitle: 'सीखने की सहायता कॉल की योजना बनाएं',
      discoveryLead: 'माता-पिता/अभिभावक के लिए: अपने बच्चे के बारे में IGR Academy के मेंटर से बात करने के लिए सुविधाजनक समय चुनें।',
      leadNameLabel: 'माता-पिता/अभिभावक का नाम',
      leadNamePlaceholder: 'आपका पूरा नाम',
      leadPhoneLabel: 'WhatsApp नंबर',
      leadEmailLabel: 'मीटिंग के लिए ईमेल',
      leadDateLabel: 'पसंदीदा तारीख और समय',
      leadInterestLabel: 'कौन सी सहायता सबसे उपयोगी होगी?',
      interestRoadmap: 'एक व्यक्तिगत सीखने की रूपरेखा',
      interestHomework: 'होमवर्क और अवधारणा सहायता',
      interestExam: 'परीक्षा की तैयारी',
      interestAi: 'एआई और कोडिंग कौशल',
      discoveryPrivacyNote: 'आपकी जानकारी केवल इस सहायता कॉल की व्यवस्था के लिए उपयोग की जाती है।',
      btnSubmitDiscovery: 'पेरेंट कॉल बुक करें',
      discoverySuccessTitle: 'आप तैयार हैं!',
      successMeetLink: 'मीटिंग लिंक खोलें',
      successWaLink: 'WhatsApp खोलें',
      btnDoneDiscovery: 'अप्पू पर वापस जाएं'
    }
  };

  function applyUiTranslations(lang) {
    const t = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;
    document.documentElement.lang = lang;

    const statusLabel = document.getElementById('status-label');
    if (statusLabel) statusLabel.textContent = t.statusLabel;

    const missionEyebrow = document.getElementById('mission-eyebrow');
    if (missionEyebrow) missionEyebrow.innerHTML = `<span aria-hidden="true">✦</span> ${t.missionEyebrow.replace(/^[✦\s]+/, '')}`;

    const missionTitle = document.getElementById('mission-title');
    if (missionTitle) missionTitle.innerHTML = t.missionTitleHtml;

    const missionSubtitle = document.getElementById('mission-subtitle');
    if (missionSubtitle) missionSubtitle.textContent = t.missionSubtitle;

    const companionTag = document.getElementById('appu-companion-tag');
    if (companionTag) companionTag.textContent = t.companionTag;

    const chipExplain = document.getElementById('chip-explain');
    if (chipExplain) {
      const title = chipExplain.querySelector('.chip-title');
      const desc = chipExplain.querySelector('.chip-desc');
      if (title) title.textContent = t.chipExplainTitle;
      if (desc) desc.textContent = t.chipExplainDesc;
      chipExplain.setAttribute('data-prompt', t.chipExplainPrompt);
    }

    const chipQuiz = document.getElementById('chip-quiz');
    if (chipQuiz) {
      const title = chipQuiz.querySelector('.chip-title');
      const desc = chipQuiz.querySelector('.chip-desc');
      if (title) title.textContent = t.chipQuizTitle;
      if (desc) desc.textContent = t.chipQuizDesc;
      chipQuiz.setAttribute('data-prompt', t.chipQuizPrompt);
    }

    const chipHomework = document.getElementById('chip-homework');
    if (chipHomework) {
      const title = chipHomework.querySelector('.chip-title');
      const desc = chipHomework.querySelector('.chip-desc');
      if (title) title.textContent = t.chipHomeworkTitle;
      if (desc) desc.textContent = t.chipHomeworkDesc;
      chipHomework.setAttribute('data-prompt', t.chipHomeworkPrompt);
    }

    const chipExam = document.getElementById('chip-exam');
    if (chipExam) {
      const title = chipExam.querySelector('.chip-title');
      const desc = chipExam.querySelector('.chip-desc');
      if (title) title.textContent = t.chipExamTitle;
      if (desc) desc.textContent = t.chipExamDesc;
      chipExam.setAttribute('data-prompt', t.chipExamPrompt);
    }

    const appuSaysLabel = document.getElementById('appu-says-label');
    if (appuSaysLabel) appuSaysLabel.textContent = t.appuSaysLabel;

    const typeBtnSpan = document.querySelector('#btn-toggle-chat span');
    if (typeBtnSpan) typeBtnSpan.textContent = t.typeInstead;

    const micLabel = document.querySelector('.mic-label');
    if (micLabel) micLabel.textContent = t.askAppu;

    const parentBtnSpan = document.querySelector('#btn-parent-setup span');
    if (parentBtnSpan) parentBtnSpan.textContent = t.parentSetup;

    const chatTitle = document.getElementById('chat-title');
    if (chatTitle) chatTitle.textContent = t.chatTitle;

    const chatSubtitle = document.getElementById('chat-subtitle');
    if (chatSubtitle) chatSubtitle.textContent = t.chatSubtitle;

    const chatInput = document.getElementById('chat-input');
    if (chatInput) chatInput.placeholder = t.chatPlaceholder;

    // Beta banner
    document.querySelectorAll('#beta-banner .beta-banner-item').forEach((el) => {
      el.textContent = t.betaBannerText;
    });
    const betaBannerCta = document.getElementById('beta-banner-cta');
    if (betaBannerCta) betaBannerCta.textContent = t.betaBannerCta;

    // Settings modal
    const settingsKickerText = document.getElementById('settings-kicker-text');
    if (settingsKickerText) settingsKickerText.textContent = t.settingsKicker;

    const settingsTitle = document.getElementById('settings-title');
    if (settingsTitle) settingsTitle.textContent = t.settingsTitle;

    const settingsLead = document.getElementById('settings-lead');
    if (settingsLead) settingsLead.textContent = t.settingsLead;

    const settingRateTitle = document.getElementById('setting-rate-title');
    if (settingRateTitle) settingRateTitle.textContent = t.settingRateTitle;

    const settingRateDesc = document.getElementById('setting-rate-desc');
    if (settingRateDesc) settingRateDesc.textContent = t.settingRateDesc;

    const settingAutospeakTitle = document.getElementById('setting-autospeak-title');
    if (settingAutospeakTitle) settingAutospeakTitle.textContent = t.settingAutospeakTitle;

    const settingAutospeakDesc = document.getElementById('setting-autospeak-desc');
    if (settingAutospeakDesc) settingAutospeakDesc.textContent = t.settingAutospeakDesc;

    const settingUisoundTitle = document.getElementById('setting-uisound-title');
    if (settingUisoundTitle) settingUisoundTitle.textContent = t.settingUisoundTitle;

    const settingUisoundDesc = document.getElementById('setting-uisound-desc');
    if (settingUisoundDesc) settingUisoundDesc.textContent = t.settingUisoundDesc;

    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) btnSaveSettings.textContent = t.btnSaveSettings;

    // Discovery modal
    const discoveryKickerText = document.getElementById('discovery-kicker-text');
    if (discoveryKickerText) discoveryKickerText.textContent = t.discoveryKicker;

    const discoveryTitle = document.getElementById('parent-dialog-title');
    if (discoveryTitle) discoveryTitle.textContent = t.discoveryTitle;

    const discoveryLead = document.getElementById('discovery-lead');
    if (discoveryLead) discoveryLead.textContent = t.discoveryLead;

    const leadNameLabel = document.getElementById('lead-name-label');
    if (leadNameLabel) leadNameLabel.textContent = t.leadNameLabel;

    const leadNameInput = document.getElementById('lead-name');
    if (leadNameInput) leadNameInput.placeholder = t.leadNamePlaceholder;

    const leadPhoneLabel = document.getElementById('lead-phone-label');
    if (leadPhoneLabel) leadPhoneLabel.textContent = t.leadPhoneLabel;

    const leadEmailLabel = document.getElementById('lead-email-label');
    if (leadEmailLabel) leadEmailLabel.textContent = t.leadEmailLabel;

    const leadDateLabel = document.getElementById('lead-date-label');
    if (leadDateLabel) leadDateLabel.textContent = t.leadDateLabel;

    const leadInterestLabel = document.getElementById('lead-interest-label');
    if (leadInterestLabel) leadInterestLabel.textContent = t.leadInterestLabel;

    const optInterestRoadmap = document.getElementById('opt-interest-roadmap');
    if (optInterestRoadmap) optInterestRoadmap.textContent = t.interestRoadmap;

    const optInterestHomework = document.getElementById('opt-interest-homework');
    if (optInterestHomework) optInterestHomework.textContent = t.interestHomework;

    const optInterestExam = document.getElementById('opt-interest-exam');
    if (optInterestExam) optInterestExam.textContent = t.interestExam;

    const optInterestAi = document.getElementById('opt-interest-ai');
    if (optInterestAi) optInterestAi.textContent = t.interestAi;

    const discoveryPrivacyNoteText = document.getElementById('discovery-privacy-note-text');
    if (discoveryPrivacyNoteText) discoveryPrivacyNoteText.textContent = t.discoveryPrivacyNote;

    const btnSubmitDiscoveryText = document.getElementById('btn-submit-discovery-text');
    if (btnSubmitDiscoveryText) btnSubmitDiscoveryText.textContent = t.btnSubmitDiscovery;

    const discoverySuccessTitle = document.getElementById('discovery-success-title');
    if (discoverySuccessTitle) discoverySuccessTitle.textContent = t.discoverySuccessTitle;

    const successMeetLink = document.getElementById('success-meet-link');
    if (successMeetLink) successMeetLink.textContent = t.successMeetLink;

    const successWaLink = document.getElementById('success-wa-link');
    if (successWaLink) successWaLink.textContent = t.successWaLink;

    const btnDoneDiscovery = document.getElementById('btn-done-discovery');
    if (btnDoneDiscovery) btnDoneDiscovery.textContent = t.btnDoneDiscovery;

    // Parent Setup modal (delegated to its own module, which keeps a parallel translation dictionary)
    if (typeof window.ParentSetupUI !== 'undefined' && typeof window.ParentSetupUI.applyTranslations === 'function') {
      window.ParentSetupUI.applyTranslations(lang);
    }
  }

  // ==========================================
  // LANGUAGE TOGGLE HANDLER (ENG / KANNADA / HINDI)
  // ==========================================
  const langEnBtn = document.getElementById('lang-en');
  const langKnBtn = document.getElementById('lang-kn');
  const langHiBtn = document.getElementById('lang-hi');

  function setLanguage(lang, announce = true) {
    if (lang !== 'en' && lang !== 'kn' && lang !== 'hi') lang = 'en';
    currentLang = lang;
    localStorage.setItem('appu_lang', lang);
    voiceEngine.setLanguage(lang);
    if (chatAgent) chatAgent.language = lang;

    if (langEnBtn) {
      langEnBtn.classList.toggle('is-active', lang === 'en');
      langEnBtn.setAttribute('aria-checked', lang === 'en' ? 'true' : 'false');
    }
    if (langKnBtn) {
      langKnBtn.classList.toggle('is-active', lang === 'kn');
      langKnBtn.setAttribute('aria-checked', lang === 'kn' ? 'true' : 'false');
    }
    if (langHiBtn) {
      langHiBtn.classList.toggle('is-active', lang === 'hi');
      langHiBtn.setAttribute('aria-checked', lang === 'hi' ? 'true' : 'false');
    }

    applyUiTranslations(lang);

    if (announce && voiceEngine) {
      const t = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;
      voiceEngine.streamSubtitles(t.subtitlesGreeting);
    }
  }

  // Initialize UI language state on load
  setLanguage(currentLang, false);

  if (langEnBtn) langEnBtn.addEventListener('click', () => setLanguage('en'));
  if (langKnBtn) langKnBtn.addEventListener('click', () => setLanguage('kn'));
  if (langHiBtn) langHiBtn.addEventListener('click', () => setLanguage('hi'));

  // ==========================================
  // CORE INTERACTION HANDLER
  // ==========================================
  async function handleUserInteraction(text) {
    if (!text || !text.trim()) return;

    const isAuthed = typeof window.AppuSession !== 'undefined' &&
      typeof window.AppuSession.isAuthenticated === 'function' &&
      window.AppuSession.isAuthenticated();
    const hasAuthenticatedParent = typeof window.ParentOnboardingShell !== 'undefined' &&
      typeof window.ParentOnboardingShell.isParentAuthenticated === 'function' &&
      window.ParentOnboardingShell.isParentAuthenticated();

    // BETA: no anonymous chatting -- guest turns aren't personalised, and showing off
    // personalisation is the point of the beta. Sign up first, every time.
    if (
      typeof APPU_CONFIG !== 'undefined' && APPU_CONFIG.betaMode &&
      !isAuthed && !hasAuthenticatedParent
    ) {
      voiceEngine.playClick();
      if (window.ParentSetupUI && typeof window.ParentSetupUI.openModal === 'function') {
        window.ParentSetupUI.openModal(1);
      }
      const subtitlesText = document.getElementById('subtitles-text');
      if (subtitlesText) {
        subtitlesText.textContent = 'Sign up free to start chatting with Appu — takes 30 seconds!';
      }
      return;
    }

    // If unauthenticated and known guest limit reached, gate immediately
    if (!isAuthed && !hasAuthenticatedParent && currentGuestRemaining <= 0) {
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
      async (reply, audioData, audioStreamUrl, accessToken) => {
        avatarStage.setState('speaking');
        await voiceEngine.speak(reply, audioData, audioStreamUrl, accessToken);
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

  // BETA: block mic-based chat for guests before it even starts listening, same rule as
  // handleUserInteraction. Returns true if blocked (caller should stop).
  function blockGuestVoiceForBeta() {
    const isAuthed = typeof window.AppuSession !== 'undefined' &&
      typeof window.AppuSession.isAuthenticated === 'function' &&
      window.AppuSession.isAuthenticated();
    const hasAuthenticatedParent = typeof window.ParentOnboardingShell !== 'undefined' &&
      typeof window.ParentOnboardingShell.isParentAuthenticated === 'function' &&
      window.ParentOnboardingShell.isParentAuthenticated();
    if (
      typeof APPU_CONFIG === 'undefined' || !APPU_CONFIG.betaMode ||
      isAuthed || hasAuthenticatedParent
    ) {
      return false;
    }
    if (window.ParentSetupUI && typeof window.ParentSetupUI.openModal === 'function') {
      window.ParentSetupUI.openModal(1);
    }
    return true;
  }

  if (btnHeroTalk) {
    btnHeroTalk.addEventListener('click', () => {
      if (blockGuestVoiceForBeta()) return;
      voiceEngine.toggleLiveSession();
    });
  }

  if (btnMic) {
    btnMic.addEventListener('click', () => {
      if (blockGuestVoiceForBeta()) return;
      voiceEngine.toggleLiveSession();
    });
  }

  if (avatarFigure) {
    avatarFigure.addEventListener('click', () => {
      voiceEngine.playClick();
      const t = UI_TRANSLATIONS[currentLang] || UI_TRANSLATIONS.en;
      handleUserInteraction(t.avatarIntroPrompt);
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
    btnToggleChat.addEventListener('click', () => {
      if (blockGuestVoiceForBeta()) return;
      toggleChatDrawer(true);
    });
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
      if (blockGuestVoiceForBeta()) return;
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
        // Route discovery scheduling through the backend API gateway, never directly to n8n.
        const scheduleMessage = [
          `Schedule a parent learning support call:`,
          `Name: ${name}`,
          `Phone: ${phone}`,
          `Email: ${email}`,
          `Date/Time: ${dateVal}`,
          `Interest: ${interest}`
        ].join('\n');

        const backendClient = window.AppuBackendClient;
        let data = {};
        if (backendClient && typeof backendClient.sendAppuMessage === 'function') {
          data = await backendClient.sendAppuMessage({
            message: scheduleMessage,
            language: currentLang || 'en'
          });
        } else {
          throw new Error('AppuBackendClient unavailable for discovery scheduling');
        }

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

  // Restore authenticated session after page refresh or email verification callback
  if (typeof window.ParentOnboardingShell !== 'undefined' && typeof window.ParentOnboardingShell.restoreSession === 'function') {
    window.ParentOnboardingShell.restoreSession().then((res) => {
      updateGuestBadge();
      const hash = typeof window !== 'undefined' && window.location ? (window.location.hash || '') : '';
      const search = typeof window !== 'undefined' && window.location ? (window.location.search || '') : '';
      // Prefer the flag captured before Supabase strips the hash from the URL; fall back to a
      // live check in case that early capture script didn't run for some reason.
      const isAuthRedirect = window.__APPU_AUTH_REDIRECT__
        || hash.includes('access_token') || hash.includes('type=signup') || hash.includes('type=email_verification') || search.includes('code=');

      if (isAuthRedirect) {
        if (typeof window.ParentSetupUI !== 'undefined' && typeof window.ParentSetupUI.openModal === 'function') {
          window.ParentSetupUI.openModal();
        }
        try {
          if (window.history && typeof window.history.replaceState === 'function') {
            window.history.replaceState(null, '', window.location.pathname);
          }
        } catch (e) {}
      }
    }).catch((err) => {
      console.warn('[Appu] Session restoration warning:', err?.message || err);
      updateGuestBadge();
    });
  } else if (typeof window.ParentOnboardingShell !== 'undefined' && typeof window.ParentOnboardingShell.updateHeaderSessionBadge === 'function') {
    window.ParentOnboardingShell.updateHeaderSessionBadge();
    updateGuestBadge();
  }

  // Native app only: the email verification link opens as an Android App Link (see
  // AndroidManifest.xml) straight into this already-running app instead of a browser.
  // Supabase's own detectSessionInUrl only runs once at client construction against the
  // page's own URL, so a link arriving later has to be applied manually.
  if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
    const CapApp = window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (CapApp && typeof CapApp.addListener === 'function') {
      CapApp.addListener('appUrlOpen', ({ url }) => {
        if (typeof window.ParentOnboardingShell?.handleDeepLinkAuth !== 'function') return;
        window.ParentOnboardingShell.handleDeepLinkAuth(url).then((result) => {
          updateGuestBadge();
          if (result && result.isAuthRedirect && result.status !== 'UNAUTHENTICATED') {
            if (typeof window.ParentSetupUI !== 'undefined' && typeof window.ParentSetupUI.openModal === 'function') {
              window.ParentSetupUI.openModal();
            }
          }
        }).catch((err) => {
          console.warn('[Appu] Deep link auth warning:', err?.message || err);
        });
      });
    }
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
