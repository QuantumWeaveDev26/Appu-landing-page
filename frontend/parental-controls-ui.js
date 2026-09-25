/**
 * ParentalControlsUI: 30-Minute Hard Lock & WhatsApp OTP Verification Controller
 * 
 * Features:
 * - Tracks child active learning vs away time with precision.
 * - Dispatches periodic session heartbeats to backend (/api/appu/session/heartbeat).
 * - Triggers an uncloseable full-screen lock overlay when 30 minutes is reached.
 * - Dispatches 6-digit unlock OTP and usage report to parent's WhatsApp via n8n.
 * - Verifies OTP and resets the 30-minute usage window upon successful parent authorization.
 * - Entirely flag-gated and fail-safe: dormant when server reports enabled=false.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.ParentalControlsUI = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Constants
  const HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds
  const IDLE_TIMEOUT_MS = 60000; // 60 seconds without interaction counts as away
  const SESSION_STORAGE_KEY = 'appu_parental_session_id';

  // Internal state
  let isInitialized = false;
  let heartbeatTimerId = null;
  let tickerTimerId = null;
  let resendCooldownTimerId = null;

  let sessionId = null;
  let isLocked = false;
  let isEnabled = false;
  let activeSeconds = 0;
  let awaySeconds = 0;
  let timeRemainingSeconds = 1800; // 30 mins default

  let activeMsAccumulator = 0;
  let awayMsAccumulator = 0;
  let lastTickTimestamp = Date.now();
  let lastUserActivityTimestamp = Date.now();

  // DOM elements cache
  let modalEl = null;
  let statActiveEl = null;
  let statAwayEl = null;
  let viewRequestEl = null;
  let viewVerifyEl = null;
  let viewSuccessEl = null;
  let btnRequestOtpEl = null;
  let btnVerifyOtpEl = null;
  let btnResendOtpEl = null;
  let otpInputEl = null;
  let requestStatusEl = null;
  let verifyStatusEl = null;
  let timerBadgeEl = null;
  let timerTextEl = null;
  let btnAddPhoneEl = null;
  let currentLanguage = 'en';

  const LOCALIZATION = {
    en: {
      kicker: 'Parent Zone • Study Time Limit',
      title: 'Study Time Complete! 🌟',
      lead: "You've completed 30 minutes of focused learning with Appu! It's a great time to stretch, hydrate, or take a quick break. To continue learning, ask your parent to unlock this session with a WhatsApp verification code.",
      labelActive: 'Active Learning',
      labelAway: 'Break / Away',
      statActiveMins: (m) => `${m} min${m === 1 ? '' : 's'}`,
      statAwayMins: (m) => `${m} min${m === 1 ? '' : 's'}`,
      instruction: "Click below to send a 6-digit unlock code and learning summary to your parent's registered WhatsApp.",
      btnSendOtp: 'Send Unlock Code to Parent WhatsApp',
      btnAddPhone: 'Add Parent WhatsApp Number',
      needsPhoneNotice: 'Parent WhatsApp number is not configured. Please add your WhatsApp number in Parent Setup to receive the unlock code.',
      sendingCode: 'Sending WhatsApp Code...',
      rateLimited: (min) => `Too many requests. Please wait ${min} minute${min === 1 ? '' : 's'} before requesting another code.`,
      sendFailed: 'Unable to send WhatsApp code right now. Please try again.',
      networkError: 'Network error. Please try again.',
      bannerSent: "A 6-digit code has been sent to your parent's WhatsApp!",
      fieldEnterCode: 'Enter 6-Digit Parent Code',
      btnVerify: 'Verify & Continue Learning',
      btnResend: 'Resend Code',
      resendIn: (s) => `Resend Code (${s}s)`,
      verifyingCode: 'Verifying...',
      invalidLength: 'Please enter a 6-digit verification code.',
      verifyFailed: 'Verification failed or code expired. Please request a new code.',
      successTitle: 'Session Unlocked!',
      successDesc: '30 minutes of study time has been added. Resuming your lesson now...'
    },
    kn: {
      kicker: 'ಪೋಷಕರ ವಲಯ • ಕಲಿಕೆಯ ಸಮಯದ ಮಿತಿ',
      title: 'ಕಲಿಕೆಯ ಸಮಯ ಮುಗಿದಿದೆ! 🌟',
      lead: 'ನೀವು ಅಪ್ಪುವಿನೊಂದಿಗೆ 30 ನಿಮಿಷಗಳ ಕೇಂದ್ರೀಕೃತ ಕಲಿಕೆಯನ್ನು ಪೂರ್ಣಗೊಳಿಸಿದ್ದೀರಿ! ವಿಶ್ರಾಂತಿ ಪಡೆಯಲು ಇದು ಉತ್ತಮ ಸಮಯ. ಕಲಿಯುವುದನ್ನು ಮುಂದುವರಿಸಲು, ನಿಮ್ಮ ಪೋಷಕರ ವಾಟ್ಸಾಪ್ ಪರಿಶೀಲನಾ ಕೋಡ್‌ನೊಂದಿಗೆ ಅನ್‌ಲಾಕ್ ಮಾಡಲು ಕೇಳಿ.',
      labelActive: 'ಸಕ್ರಿಯ ಕಲಿಕೆ',
      labelAway: 'ವಿಶ್ರಾಂತಿ ಸಮಯ',
      statActiveMins: (m) => `${m} ನಿಮಿಷ`,
      statAwayMins: (m) => `${m} ನಿಮಿಷ`,
      instruction: 'ನಿಮ್ಮ ಪೋಷಕರ ವಾಟ್ಸಾಪ್‌ಗೆ 6-ಅಂಕಿಯ ಅನ್‌ಲಾಕ್ ಕೋಡ್ ಮತ್ತು ಕಲಿಕೆಯ ಸಾರಾಂಶವನ್ನು ಕಳುಹಿಸಲು ಕೆಳಗೆ ಕ್ಲಿಕ್ ಮಾಡಿ.',
      btnSendOtp: 'ಪೋಷಕರ ವಾಟ್ಸಾಪ್‌ಗೆ ಅನ್‌ಲಾಕ್ ಕೋಡ್ ಕಳುಹಿಸಿ',
      btnAddPhone: 'ಪೋಷಕರ ವಾಟ್ಸಾಪ್ ಸಂಖ್ಯೆ ಸೇರಿಸಿ',
      needsPhoneNotice: 'ಪೋಷಕರ ವಾಟ್ಸಾಪ್ ಸಂಖ್ಯೆ ಕಾನ್ಫಿಗರ್ ಆಗಿಲ್ಲ. ಅನ್‌ಲಾಕ್ ಕೋಡ್ ಪಡೆಯಲು ದಯವಿಟ್ಟು ಪೋಷಕರ ಸೆಟಪ್‌ನಲ್ಲಿ ವಾಟ್ಸಾಪ್ ಸಂಖ್ಯೆಯನ್ನು ಸೇರಿಸಿ.',
      sendingCode: 'ವಾಟ್ಸಾಪ್ ಕೋಡ್ ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ...',
      rateLimited: (min) => `ಹೆಚ್ಚಿನ ವಿನಂತಿಗಳು. ಇನ್ನೊಂದು ಕೋಡ್ ವಿನಂತಿಸುವ ಮೊದಲು ದಯವಿಟ್ಟು ${min} ನಿಮಿಷ ಕಾಯಿರಿ.`,
      sendFailed: 'ಈಗ ವಾಟ್ಸಾಪ್ ಕೋಡ್ ಕಳುಹಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
      networkError: 'ನೆಟ್‌ವರ್ಕ್ ದೋಷ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
      bannerSent: 'ನಿಮ್ಮ ಪೋಷಕರ ವಾಟ್ಸಾಪ್‌ಗೆ 6-ಅಂಕಿಯ ಕೋಡ್ ಕಳುಹಿಸಲಾಗಿದೆ!',
      fieldEnterCode: '6-ಅಂಕಿಯ ಪೋಷಕರ ಕೋಡ್ ನಮೂದಿಸಿ',
      btnVerify: 'ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಮುಂದುವರಿಯಿರಿ',
      btnResend: 'ಕೋಡ್ ಮತ್ತೆ ಕಳುಹಿಸಿ',
      resendIn: (s) => `ಮತ್ತೆ ಕಳುಹಿಸಿ (${s}ಸೆ)`,
      verifyingCode: 'ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ...',
      invalidLength: 'ದಯವಿಟ್ಟು 6-ಅಂಕಿಯ ಪರಿಶೀಲನಾ ಕೋಡ್ ನಮೂದಿಸಿ.',
      verifyFailed: 'ಪರಿಶೀಲನೆ ವಿಫಲವಾಗಿದೆ ಅಥವಾ ಕೋಡ್ ಅವಧಿ ಮೀರಿದೆ. ದಯವಿಟ್ಟು ಹೊಸ ಕೋಡ್ ವಿನಂತಿಸಿ.',
      successTitle: 'ಸೆಷನ್ ಅನ್‌ಲಾಕ್ ಆಗಿದೆ!',
      successDesc: '30 ನಿಮಿಷಗಳ ಅಧ್ಯಯನ ಸಮಯವನ್ನು ಸೇರಿಸಲಾಗಿದೆ. ನಿಮ್ಮ ಪಾಠ ಮುಂದುವರಿಯುತ್ತಿದೆ...'
    },
    hi: {
      kicker: 'अभिभावक क्षेत्र • अध्ययन समय सीमा',
      title: 'अध्ययन का समय समाप्त! 🌟',
      lead: 'आपने अप्पू के साथ 30 मिनट का ध्यानपूर्वक अध्ययन पूरा कर लिया है! थोड़ा आराम करने का यह अच्छा समय है। पढ़ाई जारी रखने के लिए, अपने माता-पिता से व्हाट्सएप सत्यापन कोड से इसे अनलॉक करने को कहें।',
      labelActive: 'सक्रिय अध्ययन',
      labelAway: 'विश्राम समय',
      statActiveMins: (m) => `${m} मिनट`,
      statAwayMins: (m) => `${m} मिनट`,
      instruction: 'अपने माता-पिता के पंजीकृत व्हाट्सएप पर 6-अंकीय अनलॉक कोड और अध्ययन सारांश भेजने के लिए नीचे क्लिक करें।',
      btnSendOtp: 'माता-पिता के व्हाट्सएप पर अनलॉक कोड भेजें',
      btnAddPhone: 'माता-पिता का व्हाट्सएप नंबर जोड़ें',
      needsPhoneNotice: 'माता-पिता का व्हाट्सएप नंबर कॉन्फ़िगर नहीं है। अनलॉक कोड प्राप्त करने के लिए कृपया पेरेंट सेटअप में व्हाट्सएप नंबर जोड़ें।',
      sendingCode: 'व्हाट्सएप कोड भेजा जा रहा है...',
      rateLimited: (min) => `बहुत सारे अनुरोध। कृपया दूसरा कोड मांगने से पहले ${min} मिनट प्रतीक्षा करें।`,
      sendFailed: 'अभी व्हाट्सएप कोड नहीं भेजा जा सका। कृपया पुनः प्रयास करें।',
      networkError: 'नेटवर्क त्रुटि। कृपया पुनः प्रयास करें।',
      bannerSent: 'आपके माता-पिता के व्हाट्सएप पर 6-अंकीय कोड भेजा गया है!',
      fieldEnterCode: '6-अंकों का अभिभावक कोड दर्ज करें',
      btnVerify: 'सत्यापित करें और सीखना जारी रखें',
      btnResend: 'कोड पुनः भेजें',
      resendIn: (s) => `पुनः भेजें (${s}से)`,
      verifyingCode: 'सत्यापित किया जा रहा है...',
      invalidLength: 'कृपया 6 अंकों का सत्यापन कोड दर्ज करें।',
      verifyFailed: 'सत्यापन विफल रहा या कोड समाप्त हो गया। कृपया नया कोड मांगें।',
      successTitle: 'सत्र अनलॉक हो गया!',
      successDesc: '30 मिनट का अध्ययन समय जोड़ दिया गया है। आपका पाठ पुनः शुरू हो रहा है...'
    }
  };

  function getClient() {
    return (typeof window !== 'undefined' && window.AppuBackendClient) ? window.AppuBackendClient : null;
  }

  function getSession() {
    return (typeof window !== 'undefined' && window.AppuSession) ? window.AppuSession : null;
  }

  function getOrCreateSessionId() {
    if (sessionId) return sessionId;
    try {
      if (typeof sessionStorage !== 'undefined') {
        const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (stored && stored.trim()) {
          sessionId = stored.trim();
          return sessionId;
        }
      }
    } catch {}

    const randomSuffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionId = `appu_${randomSuffix}`;

    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      }
    } catch {}

    return sessionId;
  }

  function registerUserActivity() {
    lastUserActivityTimestamp = Date.now();
  }

  function setupActivityListeners() {
    if (typeof window === 'undefined') return;
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'click'];
    let lastHandled = 0;
    const handler = () => {
      const now = Date.now();
      if (now - lastHandled > 1000) {
        lastHandled = now;
        registerUserActivity();
      }
    };

    events.forEach((evt) => {
      window.addEventListener(evt, handler, { passive: true, capture: true });
    });
  }

  function tickActivity() {
    const now = Date.now();
    // Count real elapsed wall-clock time. Cap each tick at 5 min so background-tab
    // timer throttling or machine sleep can't drop or over-count a huge single gap.
    const elapsed = Math.max(0, Math.min(300000, now - lastTickTimestamp));
    lastTickTimestamp = now;

    if (isLocked) {
      // While locked, time does not advance toward a new limit
      awayMsAccumulator += elapsed;
      return;
    }

    // Wall-clock policy: the 30-minute window counts real time from when the child
    // opened the site — whether the tab is focused, backgrounded, or idle. This
    // sends all elapsed time to the backend as active, so it locks after exactly
    // 30 real minutes even if the child switches away from the tab.
    activeMsAccumulator += elapsed;
    if (isEnabled && timeRemainingSeconds > 0) {
      timeRemainingSeconds = Math.max(0, timeRemainingSeconds - Math.round(elapsed / 1000));
      updateTimerBadge();
      if (timeRemainingSeconds <= 0 && !isLocked) {
        triggerLock();
      }
    }
  }

  function updateTimerBadge() {
    if (!timerBadgeEl || !timerTextEl) return;
    if (!isEnabled) {
      timerBadgeEl.hidden = true;
      return;
    }
    timerBadgeEl.hidden = false;
    const mins = Math.max(1, Math.ceil(timeRemainingSeconds / 60));
    timerTextEl.textContent = `${mins}m`;
    if (timeRemainingSeconds <= 300) {
      timerBadgeEl.classList.add('is-warning');
    } else {
      timerBadgeEl.classList.remove('is-warning');
    }
  }

  async function sendHeartbeat() {
    const session = getSession();
    const client = getClient();
    if (!session || typeof session.isAuthenticated !== 'function' || !session.isAuthenticated() || !client) {
      return;
    }

    const currentSessionId = getOrCreateSessionId();
    const activeToSend = activeMsAccumulator;
    const awayToSend = awayMsAccumulator;
    activeMsAccumulator = 0;
    awayMsAccumulator = 0;

    const visibility = (typeof document !== 'undefined' && document.visibilityState === 'hidden') ? 'hidden' : 'visible';

    try {
      const res = await client.recordSessionHeartbeat({
        sessionId: currentSessionId,
        childId: session.childId,
        activeMsSinceLast: activeToSend,
        awayMsSinceLast: awayToSend,
        visibility,
        accessToken: session.accessToken
      });

      if (!res || res.error) {
        return;
      }

      isEnabled = Boolean(res.enabled);
      activeSeconds = res.activeSeconds ?? 0;
      awaySeconds = res.awaySeconds ?? 0;
      timeRemainingSeconds = res.timeRemainingSeconds ?? 1800;

      updateTimerBadge();

      if (isEnabled && res.locked && !isLocked) {
        triggerLock();
      }
    } catch (err) {
      // Fail-safe: ignore network glitches without breaking student experience
    }
  }

  function applyTranslations(lang) {
    if (lang && LOCALIZATION[lang]) {
      currentLanguage = lang;
    } else if (typeof window !== 'undefined') {
      if (window.currentLang && LOCALIZATION[window.currentLang]) {
        currentLanguage = window.currentLang;
      } else if (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang && LOCALIZATION[document.documentElement.lang]) {
        currentLanguage = document.documentElement.lang;
      }
    }
    const dict = LOCALIZATION[currentLanguage] || LOCALIZATION.en;

    if (modalEl) {
      const kicker = typeof modalEl.querySelector === 'function' ? modalEl.querySelector('.modal-kicker') : null;
      if (kicker) kicker.innerHTML = `<i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> ${dict.kicker}`;
      const title = document.getElementById('parental-lock-title');
      if (title) title.textContent = dict.title;
      const lead = typeof modalEl.querySelector === 'function' ? modalEl.querySelector('.modal-lead') : null;
      if (lead) lead.textContent = dict.lead;

      const statLabels = typeof modalEl.querySelectorAll === 'function' ? modalEl.querySelectorAll('.lock-stat-label') : [];
      if (statLabels[0]) statLabels[0].textContent = dict.labelActive;
      if (statLabels[1]) statLabels[1].textContent = dict.labelAway;

      const instruction = typeof modalEl.querySelector === 'function' ? modalEl.querySelector('.lock-instruction') : null;
      if (instruction) instruction.textContent = dict.instruction;

      if (btnRequestOtpEl) {
        const span = typeof btnRequestOtpEl.querySelector === 'function' ? btnRequestOtpEl.querySelector('span') : null;
        if (span && !btnRequestOtpEl.disabled) span.textContent = dict.btnSendOtp;
      }
      if (btnAddPhoneEl) {
        const span = typeof btnAddPhoneEl.querySelector === 'function' ? btnAddPhoneEl.querySelector('span') : null;
        if (span) span.textContent = dict.btnAddPhone;
      }

      const otpSentBanner = typeof modalEl.querySelector === 'function' ? modalEl.querySelector('.otp-sent-banner span') : null;
      if (otpSentBanner) otpSentBanner.textContent = dict.bannerSent;

      const fieldSpan = typeof modalEl.querySelector === 'function' ? modalEl.querySelector('.lock-field > span') : null;
      if (fieldSpan) fieldSpan.textContent = dict.fieldEnterCode;

      if (btnVerifyOtpEl) {
        const span = typeof btnVerifyOtpEl.querySelector === 'function' ? btnVerifyOtpEl.querySelector('span') : null;
        if (span && !btnVerifyOtpEl.disabled) span.textContent = dict.btnVerify;
      }
      if (btnResendOtpEl && !resendCooldownTimerId) {
        const span = typeof btnResendOtpEl.querySelector === 'function' ? btnResendOtpEl.querySelector('span') : null;
        if (span) span.textContent = dict.btnResend;
      }

      const successTitle = typeof modalEl.querySelector === 'function' ? modalEl.querySelector('.success-view h3') : null;
      if (successTitle) successTitle.textContent = dict.successTitle;
      const successDesc = typeof modalEl.querySelector === 'function' ? modalEl.querySelector('.success-view p') : null;
      if (successDesc) successDesc.textContent = dict.successDesc;
    }

    if (statActiveEl) {
      const activeMin = Math.max(1, Math.round(activeSeconds / 60));
      statActiveEl.textContent = dict.statActiveMins(activeMin);
    }
    if (statAwayEl) {
      const awayMin = Math.round(awaySeconds / 60);
      statAwayEl.textContent = dict.statAwayMins(awayMin);
    }
  }

  function triggerLock() {
    isLocked = true;
    updateTimerBadge();

    // Pause any active voice synthesis or playback
    if (typeof window !== 'undefined' && window.VoiceEngine && typeof window.VoiceEngine.stopSpeech === 'function') {
      window.VoiceEngine.stopSpeech();
    }

    applyTranslations();

    // Populate active & away metrics
    const dict = LOCALIZATION[currentLanguage] || LOCALIZATION.en;
    if (statActiveEl) {
      const activeMin = Math.max(1, Math.round(activeSeconds / 60));
      statActiveEl.textContent = dict.statActiveMins(activeMin);
    }
    if (statAwayEl) {
      const awayMin = Math.round(awaySeconds / 60);
      statAwayEl.textContent = dict.statAwayMins(awayMin);
    }

    showView('request');

    // Check if parent phone is missing or unconsented
    const session = getSession();
    const p = session?.personalisation;
    if (btnAddPhoneEl) {
      if (p && (!p.parentPhone || !p.whatsappConsent)) {
        btnAddPhoneEl.style.display = 'inline-flex';
        const span = typeof btnAddPhoneEl.querySelector === 'function' ? btnAddPhoneEl.querySelector('span') : null;
        if (span) span.textContent = dict.btnAddPhone;
      } else {
        btnAddPhoneEl.style.display = 'none';
      }
    }

    if (modalEl) {
      modalEl.classList.add('is-visible');
      modalEl.setAttribute('aria-hidden', 'false');
      modalEl.focus();
    }
  }

  function unlockSession() {
    isLocked = false;
    timeRemainingSeconds = 1800;
    activeSeconds = 0;
    updateTimerBadge();

    if (modalEl) {
      modalEl.classList.remove('is-visible');
      modalEl.setAttribute('aria-hidden', 'true');
    }
  }

  function showView(viewName) {
    if (viewRequestEl) viewRequestEl.hidden = viewName !== 'request';
    if (viewVerifyEl) viewVerifyEl.hidden = viewName !== 'verify';
    if (viewSuccessEl) viewSuccessEl.hidden = viewName !== 'success';

    if (viewName !== 'request' && btnAddPhoneEl) {
      btnAddPhoneEl.style.display = 'none';
    }

    if (requestStatusEl) requestStatusEl.textContent = '';
    if (verifyStatusEl) verifyStatusEl.textContent = '';
  }

  async function handleRequestOtp() {
    const session = getSession();
    const client = getClient();
    if (!session || !client) return;

    const dict = LOCALIZATION[currentLanguage] || LOCALIZATION.en;

    if (btnRequestOtpEl) {
      btnRequestOtpEl.disabled = true;
      btnRequestOtpEl.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span>${dict.sendingCode}</span>`;
    }
    if (requestStatusEl) requestStatusEl.textContent = '';

    try {
      const res = await client.requestSessionOtp({
        sessionId: getOrCreateSessionId(),
        childId: session.childId,
        accessToken: session.accessToken
      });

      if (res && res.requested) {
        if (btnAddPhoneEl) btnAddPhoneEl.style.display = 'none';
        showView('verify');
        startResendCooldown(60);
        if (otpInputEl) {
          otpInputEl.value = '';
          otpInputEl.focus();
        }
        return;
      }

      if (res && res.needsPhone) {
        if (requestStatusEl) {
          requestStatusEl.textContent = dict.needsPhoneNotice;
        }
        if (btnAddPhoneEl) {
          btnAddPhoneEl.style.display = 'inline-flex';
          const span = typeof btnAddPhoneEl.querySelector === 'function' ? btnAddPhoneEl.querySelector('span') : null;
          if (span) span.textContent = dict.btnAddPhone;
        }
        return;
      }

      if (res && res.error === 'rate_limited') {
        const waitMin = Math.ceil((res.retryAfterSeconds || 300) / 60);
        if (requestStatusEl) {
          requestStatusEl.textContent = dict.rateLimited(waitMin);
        }
        return;
      }

      if (requestStatusEl) {
        requestStatusEl.textContent = dict.sendFailed;
      }
    } catch (err) {
      if (requestStatusEl) {
        requestStatusEl.textContent = dict.networkError;
      }
    } finally {
      if (btnRequestOtpEl) {
        btnRequestOtpEl.disabled = false;
        btnRequestOtpEl.innerHTML = `<i class="fa-brands fa-whatsapp"></i> <span>${dict.btnSendOtp}</span>`;
      }
    }
  }

  function startResendCooldown(seconds) {
    if (resendCooldownTimerId) clearInterval(resendCooldownTimerId);
    let remaining = seconds;
    const dict = LOCALIZATION[currentLanguage] || LOCALIZATION.en;
    if (btnResendOtpEl) {
      btnResendOtpEl.disabled = true;
      btnResendOtpEl.innerHTML = `<i class="fa-solid fa-clock"></i> <span>${dict.resendIn(remaining)}</span>`;
    }

    resendCooldownTimerId = setInterval(() => {
      remaining -= 1;
      const d = LOCALIZATION[currentLanguage] || LOCALIZATION.en;
      if (remaining <= 0) {
        clearInterval(resendCooldownTimerId);
        resendCooldownTimerId = null;
        if (btnResendOtpEl) {
          btnResendOtpEl.disabled = false;
          btnResendOtpEl.innerHTML = `<i class="fa-solid fa-arrow-rotate-right"></i> <span>${d.btnResend}</span>`;
        }
      } else if (btnResendOtpEl) {
        btnResendOtpEl.innerHTML = `<i class="fa-solid fa-clock"></i> <span>${d.resendIn(remaining)}</span>`;
      }
    }, 1000);
  }

  async function handleVerifyOtp() {
    const session = getSession();
    const client = getClient();
    if (!session || !client || !otpInputEl) return;

    const dict = LOCALIZATION[currentLanguage] || LOCALIZATION.en;
    const code = otpInputEl.value.trim();
    if (!code || code.length < 4) {
      if (verifyStatusEl) verifyStatusEl.textContent = dict.invalidLength;
      otpInputEl.focus();
      return;
    }

    if (btnVerifyOtpEl) {
      btnVerifyOtpEl.disabled = true;
      btnVerifyOtpEl.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> <span>${dict.verifyingCode}</span>`;
    }
    if (verifyStatusEl) verifyStatusEl.textContent = '';

    try {
      const res = await client.verifySessionOtp({
        sessionId: getOrCreateSessionId(),
        childId: session.childId,
        code,
        accessToken: session.accessToken
      });

      if (res && res.verified) {
        showView('success');
        setTimeout(() => {
          unlockSession();
        }, 1600);
        return;
      }

      if (res && res.attemptsLeft !== undefined) {
        if (res.attemptsLeft === 0 || res.lockedOut) {
          if (verifyStatusEl) {
            verifyStatusEl.textContent = 'Maximum attempts exceeded. Please request a new unlock code.';
          }
          if (btnVerifyOtpEl) btnVerifyOtpEl.disabled = true;
        } else {
          if (verifyStatusEl) {
            verifyStatusEl.textContent = `Incorrect code. ${res.attemptsLeft} attempt${res.attemptsLeft === 1 ? '' : 's'} remaining.`;
          }
          otpInputEl.value = '';
          otpInputEl.focus();
        }
        return;
      }

      if (verifyStatusEl) {
        verifyStatusEl.textContent = dict.verifyFailed;
      }
    } catch (err) {
      if (verifyStatusEl) {
        verifyStatusEl.textContent = dict.networkError;
      }
    } finally {
      if (btnVerifyOtpEl && !isLocked) {
        btnVerifyOtpEl.disabled = false;
        btnVerifyOtpEl.innerHTML = `<i class="fa-solid fa-lock-open"></i> <span>${dict.btnVerify}</span>`;
      }
    }
  }

  function bindDomElements() {
    if (typeof document === 'undefined') return;

    modalEl = document.getElementById('parental-lock-modal');
    statActiveEl = document.getElementById('lock-stat-active');
    statAwayEl = document.getElementById('lock-stat-away');
    viewRequestEl = document.getElementById('lock-view-request');
    viewVerifyEl = document.getElementById('lock-view-verify');
    viewSuccessEl = document.getElementById('lock-view-success');
    btnRequestOtpEl = document.getElementById('lock-btn-request-otp');
    btnVerifyOtpEl = document.getElementById('lock-btn-verify-otp');
    btnResendOtpEl = document.getElementById('lock-btn-resend-otp');
    btnAddPhoneEl = document.getElementById('lock-btn-add-phone');
    otpInputEl = document.getElementById('lock-otp-input');
    requestStatusEl = document.getElementById('lock-request-status');
    verifyStatusEl = document.getElementById('lock-verify-status');
    timerBadgeEl = document.getElementById('parental-timer-badge');
    timerTextEl = document.getElementById('parental-timer-text');

    if (btnRequestOtpEl) {
      btnRequestOtpEl.onclick = handleRequestOtp;
    }
    if (btnVerifyOtpEl) {
      btnVerifyOtpEl.onclick = handleVerifyOtp;
    }
    if (btnResendOtpEl) {
      btnResendOtpEl.onclick = handleRequestOtp;
    }
    if (btnAddPhoneEl) {
      btnAddPhoneEl.onclick = () => {
        if (typeof window !== 'undefined' && window.ParentSetupUI && typeof window.ParentSetupUI.openModal === 'function') {
          window.ParentSetupUI.openModal(4);
        }
      };
    }

    if (otpInputEl) {
      // Automatically sanitize and auto-submit on 6th digit
      otpInputEl.addEventListener('input', (e) => {
        const clean = otpInputEl.value.replace(/\D/g, '').slice(0, 6);
        otpInputEl.value = clean;
        if (clean.length === 6) {
          handleVerifyOtp();
        }
      });
      otpInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleVerifyOtp();
        }
      });
    }

    // Modal trap: prevent closing via Escape or backdrop click when locked
    if (modalEl) {
      modalEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isLocked) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    }
  }

  function init() {
    if (isInitialized) return;
    isInitialized = true;

    bindDomElements();
    setupActivityListeners();

    // 1-second ticker for precise active/away accumulation
    lastTickTimestamp = Date.now();
    lastUserActivityTimestamp = Date.now();
    if (tickerTimerId) clearInterval(tickerTimerId);
    tickerTimerId = setInterval(tickActivity, 1000);

    // 15-second heartbeat loop
    if (heartbeatTimerId) clearInterval(heartbeatTimerId);
    heartbeatTimerId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Initial heartbeat
    setTimeout(sendHeartbeat, 1500);
  }

  function destroy() {
    if (heartbeatTimerId) {
      clearInterval(heartbeatTimerId);
      heartbeatTimerId = null;
    }
    if (tickerTimerId) {
      clearInterval(tickerTimerId);
      tickerTimerId = null;
    }
    if (resendCooldownTimerId) {
      clearInterval(resendCooldownTimerId);
      resendCooldownTimerId = null;
    }
    isInitialized = false;
  }

  return {
    init,
    destroy,
    triggerLock,
    unlockSession,
    sendHeartbeat,
    applyTranslations,
    get isLocked() { return isLocked; },
    get isEnabled() { return isEnabled; },
    get timeRemainingSeconds() { return timeRemainingSeconds; },
    get activeSeconds() { return activeSeconds; }
  };
});
