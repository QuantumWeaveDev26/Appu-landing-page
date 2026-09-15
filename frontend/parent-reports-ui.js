/**
 * Parent Reports UI — feedback gate + child performance report download.
 * Self-contained: owns #reports-modal. Feedback (once per family) unlocks the
 * downloadable PDF report. Endpoints per docs/parent-report-design.md contract.
 */
(function () {
  'use strict';

  function apiBase() {
    return (window.APPU_CONFIG && window.APPU_CONFIG.apiBaseUrl) || 'https://api.appuai.online';
  }

  function parentToken() {
    const shell = window.ParentOnboardingShell;
    return (shell && shell.state && shell.state.session && shell.state.session.access_token) ||
      (window.AppuSession && window.AppuSession.accessToken) || null;
  }

  function selectedChildId() {
    const shell = window.ParentOnboardingShell;
    const s = shell && shell.state;
    if (s && s.selectedChild && s.selectedChild.id) return s.selectedChild.id;
    if (s && Array.isArray(s.children) && s.children[0]) return s.children[0].id;
    return (window.AppuSession && window.AppuSession.childId) || null;
  }

  let modal, elLoading, elLocked, elUnlocked, elError, elRating, elWorking, elImprove, elSubmit, elDownload, elDownloadStatus;
  let currentRating = 0;
  let feedbackUnlocked = false;
  let statusChecked = false;
  let forcedMode = false;
  const CHAT_COUNT_KEY = 'appu_authed_chats';

  function chatCount() { try { return parseInt(localStorage.getItem(CHAT_COUNT_KEY) || '0', 10) || 0; } catch (e) { return 0; } }
  function noteAuthedChat() {
    if (!parentToken() || feedbackUnlocked) return;
    try { localStorage.setItem(CHAT_COUNT_KEY, String(chatCount() + 1)); } catch (e) {}
  }
  function threshold() { return (window.APPU_CONFIG && Number(window.APPU_CONFIG.feedbackChatThreshold)) || 12; }

  async function refreshUnlockStatus() {
    const token = parentToken();
    if (!token) { feedbackUnlocked = false; statusChecked = true; return false; }
    try {
      const res = await fetch(`${apiBase()}/api/household/feedback`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); feedbackUnlocked = !!(d && d.reportsUnlocked); }
    } catch (e) {}
    statusChecked = true;
    return feedbackUnlocked;
  }

  // Returns true if chatting should be BLOCKED pending feedback (opens the forced modal).
  function enforceFeedbackGate() {
    if (!parentToken() || feedbackUnlocked) return false;
    if (chatCount() < threshold()) return false;
    if (!statusChecked) { refreshUnlockStatus(); return false; }
    openForced();
    return true;
  }

  function show(el) { if (el) el.hidden = false; }
  function hide(el) { if (el) el.hidden = true; }

  function setView(view) {
    hide(elLoading); hide(elLocked); hide(elUnlocked); hide(elError);
    if (view === 'loading') show(elLoading);
    else if (view === 'locked') show(elLocked);
    else if (view === 'unlocked') show(elUnlocked);
    else if (view === 'error') show(elError);
  }

  function paintStars() {
    if (!elRating) return;
    Array.from(elRating.querySelectorAll('.report-star')).forEach((s, i) => {
      s.classList.toggle('is-on', i < currentRating);
      s.setAttribute('aria-checked', String(i + 1 === currentRating));
    });
  }

  async function loadStatus() {
    setView('loading');
    const token = parentToken();
    if (!token) { setView('error'); return; }
    try {
      const res = await fetch(`${apiBase()}/api/household/feedback`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      feedbackUnlocked = !!(data && data.reportsUnlocked);
      statusChecked = true;
      setView(feedbackUnlocked ? 'unlocked' : 'locked');
    } catch (e) {
      setView('error');
    }
  }

  async function submitFeedback() {
    const working = (elWorking.value || '').trim();
    const improve = (elImprove.value || '').trim();
    if (currentRating < 1) { flashLocked('Please pick a star rating first.'); return; }
    if (!working) { flashLocked("Please tell us what's working well."); elWorking.focus(); return; }
    if (!improve) { flashLocked('Please tell us what we should improve.'); elImprove.focus(); return; }
    const token = parentToken();
    if (!token) { flashLocked('Please sign in first.'); return; }
    elSubmit.disabled = true;
    const prev = elSubmit.textContent;
    elSubmit.textContent = 'Submitting…';
    try {
      const res = await fetch(`${apiBase()}/api/household/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          rating: currentRating,
          whatsWorking: (elWorking.value || '').trim(),
          whatsToImprove: (elImprove.value || '').trim()
        })
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      feedbackUnlocked = true;
      statusChecked = true;
      if (forcedMode) {
        // Was blocking chat — release the gate and let the parent carry on.
        forcedMode = false;
        modal.querySelectorAll('[data-close-reports]').forEach((b) => { b.hidden = false; });
        close();
      } else {
        setView('unlocked');
      }
    } catch (e) {
      flashLocked('Could not submit right now. Please try again.');
    } finally {
      elSubmit.disabled = false;
      elSubmit.textContent = prev;
    }
  }

  // Open the modal as a hard gate: feedback form only, no way to dismiss until submitted.
  function openForced() {
    if (!modal) return;
    forcedMode = true;
    modal.classList.add('is-visible');
    modal.setAttribute('aria-hidden', 'false');
    modal.querySelectorAll('[data-close-reports]').forEach((b) => { b.hidden = true; });
    setView('locked');
    flashLocked("You've had a great run with Appu! Please share quick feedback to keep chatting.");
  }

  function flashLocked(msg) {
    const note = modal && modal.querySelector('#report-feedback-note');
    if (note) note.textContent = msg || '';
  }

  async function downloadReport() {
    const token = parentToken();
    const childId = selectedChildId();
    if (!token || !childId) { elDownloadStatus.textContent = 'Sign in and set up a learner first.'; return; }
    elDownload.disabled = true;
    elDownloadStatus.textContent = 'Generating report…';
    try {
      const res = await fetch(`${apiBase()}/api/children/${childId}/report?format=pdf`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 403) { setView('locked'); flashLocked('Please share your feedback to unlock reports.'); return; }
      if (!res.ok) throw new Error(`status ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `appu-progress-report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      elDownloadStatus.textContent = 'Downloaded ✓';
    } catch (e) {
      elDownloadStatus.textContent = 'Could not generate the report. Please try again.';
    } finally {
      elDownload.disabled = false;
    }
  }

  function open() {
    if (!modal) return;
    // Not signed in yet → route to the parent sign-in/setup flow so the feature is
    // discoverable to everyone but only usable once authenticated.
    if (!parentToken()) {
      const drawer = document.getElementById('nav-drawer');
      if (drawer) drawer.setAttribute('aria-hidden', 'true');
      if (window.ParentSetupUI && typeof window.ParentSetupUI.openModal === 'function') {
        window.ParentSetupUI.openModal(1);
        return;
      }
    }
    modal.classList.add('is-visible');
    modal.setAttribute('aria-hidden', 'false');
    loadStatus();
  }

  function close() {
    if (!modal) return;
    if (forcedMode) return; // hard gate — must submit feedback first
    modal.classList.remove('is-visible');
    modal.setAttribute('aria-hidden', 'true');
  }

  function init() {
    modal = document.getElementById('reports-modal');
    if (!modal) return;
    elLoading = modal.querySelector('#report-view-loading');
    elLocked = modal.querySelector('#report-view-locked');
    elUnlocked = modal.querySelector('#report-view-unlocked');
    elError = modal.querySelector('#report-view-error');
    elRating = modal.querySelector('#report-rating');
    elWorking = modal.querySelector('#report-fb-working');
    elImprove = modal.querySelector('#report-fb-improve');
    elSubmit = modal.querySelector('#report-fb-submit');
    elDownload = modal.querySelector('#report-download-btn');
    elDownloadStatus = modal.querySelector('#report-download-status');

    if (elRating) {
      Array.from(elRating.querySelectorAll('.report-star')).forEach((star, i) => {
        star.addEventListener('click', () => { currentRating = i + 1; paintStars(); flashLocked(''); });
      });
    }
    if (elSubmit) elSubmit.addEventListener('click', submitFeedback);
    if (elDownload) elDownload.addEventListener('click', downloadReport);
    const retry = modal.querySelector('#report-retry-btn');
    if (retry) retry.addEventListener('click', loadStatus);
    Array.from(modal.querySelectorAll('[data-close-reports]')).forEach((b) => b.addEventListener('click', close));

    ['btn-open-reports', 'btn-drawer-reports', 'home-report-card'].forEach((id) => {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', open);
    });

    // Check feedback/unlock status once the session has settled so the chat gate is accurate.
    setTimeout(() => { refreshUnlockStatus(); }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ParentReportsUI = { open, close, openForced, enforceFeedbackGate, noteAuthedChat, refreshUnlockStatus };
})();
