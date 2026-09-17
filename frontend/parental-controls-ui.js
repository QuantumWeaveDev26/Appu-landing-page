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
    const elapsed = Math.max(0, Math.min(5000, now - lastTickTimestamp));
    lastTickTimestamp = now;

    if (isLocked) {
      // While locked, time does not advance active learning
      awayMsAccumulator += elapsed;
      return;
    }

    const isVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;
    const isUserActive = (now - lastUserActivityTimestamp) < IDLE_TIMEOUT_MS;

    if (isVisible && isUserActive) {
      activeMsAccumulator += elapsed;
      if (isEnabled && timeRemainingSeconds > 0) {
        timeRemainingSeconds = Math.max(0, timeRemainingSeconds - Math.round(elapsed / 1000));
        updateTimerBadge();
        if (timeRemainingSeconds <= 0 && !isLocked) {
          triggerLock();
        }
      }
    } else {
      awayMsAccumulator += elapsed;
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

  function triggerLock() {
    isLocked = true;
    updateTimerBadge();

    // Pause any active voice synthesis or playback
    if (typeof window !== 'undefined' && window.VoiceEngine && typeof window.VoiceEngine.stopSpeech === 'function') {
      window.VoiceEngine.stopSpeech();
    }

    // Populate active & away metrics
    if (statActiveEl) {
      const activeMin = Math.max(1, Math.round(activeSeconds / 60));
      statActiveEl.textContent = `${activeMin} min${activeMin === 1 ? '' : 's'}`;
    }
    if (statAwayEl) {
      const awayMin = Math.round(awaySeconds / 60);
      statAwayEl.textContent = `${awayMin} min${awayMin === 1 ? '' : 's'}`;
    }

    showView('request');
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

    if (requestStatusEl) requestStatusEl.textContent = '';
    if (verifyStatusEl) verifyStatusEl.textContent = '';
  }

  async function handleRequestOtp() {
    const session = getSession();
    const client = getClient();
    if (!session || !client) return;

    if (btnRequestOtpEl) {
      btnRequestOtpEl.disabled = true;
      btnRequestOtpEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Sending WhatsApp Code...</span>';
    }
    if (requestStatusEl) requestStatusEl.textContent = '';

    try {
      const res = await client.requestSessionOtp({
        sessionId: getOrCreateSessionId(),
        childId: session.childId,
        accessToken: session.accessToken
      });

      if (res && res.requested) {
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
          requestStatusEl.textContent = 'Parent WhatsApp number is not configured. Please ask parent to configure WhatsApp in Parent Setup.';
        }
        return;
      }

      if (res && res.error === 'rate_limited') {
        const waitMin = Math.ceil((res.retryAfterSeconds || 300) / 60);
        if (requestStatusEl) {
          requestStatusEl.textContent = `Too many requests. Please wait ${waitMin} minutes before requesting another code.`;
        }
        return;
      }

      if (requestStatusEl) {
        requestStatusEl.textContent = 'Unable to send WhatsApp code right now. Please try again.';
      }
    } catch (err) {
      if (requestStatusEl) {
        requestStatusEl.textContent = 'Network error. Please try again.';
      }
    } finally {
      if (btnRequestOtpEl) {
        btnRequestOtpEl.disabled = false;
        btnRequestOtpEl.innerHTML = '<i class="fa-brands fa-whatsapp"></i> <span>Send Unlock Code to Parent WhatsApp</span>';
      }
    }
  }

  function startResendCooldown(seconds) {
    if (resendCooldownTimerId) clearInterval(resendCooldownTimerId);
    let remaining = seconds;
    if (btnResendOtpEl) {
      btnResendOtpEl.disabled = true;
      btnResendOtpEl.innerHTML = `<i class="fa-solid fa-clock"></i> <span>Resend Code (${remaining}s)</span>`;
    }

    resendCooldownTimerId = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(resendCooldownTimerId);
        resendCooldownTimerId = null;
        if (btnResendOtpEl) {
          btnResendOtpEl.disabled = false;
          btnResendOtpEl.innerHTML = '<i class="fa-solid fa-arrow-rotate-right"></i> <span>Resend Code</span>';
        }
      } else if (btnResendOtpEl) {
        btnResendOtpEl.innerHTML = `<i class="fa-solid fa-clock"></i> <span>Resend Code (${remaining}s)</span>`;
      }
    }, 1000);
  }

  async function handleVerifyOtp() {
    const session = getSession();
    const client = getClient();
    if (!session || !client || !otpInputEl) return;

    const code = otpInputEl.value.trim();
    if (!code || code.length < 4) {
      if (verifyStatusEl) verifyStatusEl.textContent = 'Please enter the complete 6-digit code.';
      otpInputEl.focus();
      return;
    }

    if (btnVerifyOtpEl) {
      btnVerifyOtpEl.disabled = true;
      btnVerifyOtpEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Verifying...</span>';
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
        verifyStatusEl.textContent = 'Verification failed or code expired. Please request a new code.';
      }
    } catch (err) {
      if (verifyStatusEl) {
        verifyStatusEl.textContent = 'Network error. Please try again.';
      }
    } finally {
      if (btnVerifyOtpEl && !isLocked) {
        btnVerifyOtpEl.disabled = false;
        btnVerifyOtpEl.innerHTML = '<i class="fa-solid fa-lock-open"></i> <span>Verify & Continue Learning</span>';
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
    get isLocked() { return isLocked; },
    get isEnabled() { return isEnabled; },
    get timeRemainingSeconds() { return timeRemainingSeconds; },
    get activeSeconds() { return activeSeconds; }
  };
});
