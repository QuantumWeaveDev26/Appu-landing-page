/**
 * APPU Kid Onboarding Tour — Appu-guided, spotlight + speech-bubble walkthrough.
 *
 * - Auto-runs on a child's first time in the app (remembered in localStorage),
 *   with a "Take the tour" replay button in the menu.
 * - Skippable at any step (Skip button, Esc, or the close ✕).
 * - Narrates each step via the existing voice engine (speakSynthesis) in the
 *   child's language (EN / KN / HI); silently falls back to text if unavailable.
 *
 * Self-contained: builds its own DOM, reads targets by selector, and skips any
 * step whose target isn't on screen, so it never blocks or breaks the app.
 */
(function () {
  'use strict';

  var DONE_KEY = 'appu_tour_done';

  // Each step: a target selector (null = centered welcome/finish) and text per language.
  var STEPS = [
    {
      target: null,
      text: {
        en: "Hi! I'm Appu 🐘 Let me show you how to learn with me!",
        kn: 'ನಮಸ್ಕಾರ! ನಾನು ಅಪ್ಪು 🐘 ನನ್ನ ಜೊತೆ ಕಲಿಯುವುದು ಹೇಗೆ ಎಂದು ತೋರಿಸುತ್ತೇನೆ!',
        hi: 'नमस्ते! मैं अप्पू हूँ 🐘 आओ मैं दिखाता हूँ कि मेरे साथ कैसे सीखें!'
      }
    },
    {
      target: '#btn-mic',
      text: {
        en: 'Tap this big microphone to talk to me out loud!',
        kn: 'ನನ್ನೊಂದಿಗೆ ಮಾತನಾಡಲು ಈ ದೊಡ್ಡ ಮೈಕ್ ಒತ್ತಿರಿ!',
        hi: 'मुझसे बोलकर बात करने के लिए इस बड़े माइक को दबाओ!'
      }
    },
    {
      target: '.dock-btn-group',
      text: {
        en: 'Or tap here to type your question, or upload your notes and photos.',
        kn: 'ಅಥವಾ ಇಲ್ಲಿ ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಟೈಪ್ ಮಾಡಿ, ಅಥವಾ ನಿಮ್ಮ ನೋಟ್ಸ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.',
        hi: 'या यहाँ अपना सवाल टाइप करो, या अपने नोट्स और फोटो अपलोड करो।'
      }
    },
    {
      target: '.mission-deck',
      text: {
        en: 'Pick a mission — Explain a topic, play a Quiz, Homework help or Exam practice!',
        kn: 'ಒಂದು ಮಿಷನ್ ಆರಿಸಿ — ವಿಷಯ ವಿವರಣೆ, ಕ್ವಿಜ್, ಹೋಮ್‌ವರ್ಕ್ ಅಥವಾ ಪರೀಕ್ಷೆ ಅಭ್ಯಾಸ!',
        hi: 'एक मिशन चुनो — कोई विषय समझो, क्विज़ खेलो, होमवर्क मदद या परीक्षा अभ्यास!'
      }
    },
    {
      target: '.language-switch',
      text: {
        en: 'Change your language here — English, ಕನ್ನಡ or हिंदी.',
        kn: 'ಇಲ್ಲಿ ನಿಮ್ಮ ಭಾಷೆ ಬದಲಿಸಿ — English, ಕನ್ನಡ ಅಥವಾ हिंदी.',
        hi: 'यहाँ अपनी भाषा बदलो — English, ಕನ್ನಡ या हिंदी।'
      }
    },
    {
      target: '#btn-nav-menu',
      text: {
        en: 'Open this menu for My Learning, reports and parent settings.',
        kn: 'ನನ್ನ ಕಲಿಕೆ, ವರದಿಗಳು ಮತ್ತು ಪೋಷಕ ಸೆಟ್ಟಿಂಗ್‌ಗಳಿಗೆ ಈ ಮೆನು ತೆರೆಯಿರಿ.',
        hi: 'मेरी लर्निंग, रिपोर्ट और पैरेंट सेटिंग्स के लिए यह मेनू खोलो।'
      }
    },
    {
      target: null,
      text: {
        en: "You're all set! Ask me anything and let's learn together. 🎉",
        kn: 'ಎಲ್ಲಾ ಸಿದ್ಧ! ನನ್ನನ್ನು ಏನಾದರೂ ಕೇಳಿ, ಒಟ್ಟಿಗೆ ಕಲಿಯೋಣ. 🎉',
        hi: 'सब तैयार! मुझसे कुछ भी पूछो और चलो साथ सीखें। 🎉'
      }
    }
  ];

  var LABELS = {
    next: { en: 'Next', kn: 'ಮುಂದೆ', hi: 'आगे' },
    skip: { en: 'Skip', kn: 'ಬಿಟ್ಟುಬಿಡಿ', hi: 'छोड़ें' },
    done: { en: "Let's go!", kn: 'ಶುರು ಮಾಡೋಣ!', hi: 'चलो शुरू करें!' }
  };

  var state = { i: 0, active: false, paused: false, steps: [], root: null, els: {}, onResize: null, pendingStep: null };

  function lang() {
    try {
      return (window.currentLang) ||
        (window.app && window.app.currentLang) ||
        localStorage.getItem('appu_lang') || 'en';
    } catch (e) { return 'en'; }
  }
  function t(obj) { var l = lang(); return (obj && (obj[l] || obj.en)) || ''; }

  function isDone() { try { return localStorage.getItem(DONE_KEY) === '1'; } catch (e) { return false; } }
  function markDone() { try { localStorage.setItem(DONE_KEY, '1'); } catch (e) {} }

  function isModalOpen() {
    try {
      if (typeof document === 'undefined') return false;
      var modalOverlays = document.querySelectorAll('.modal-overlay, .game-modal, .welcome-gate, .legal-viewer');
      for (var m = 0; m < modalOverlays.length; m++) {
        var el = modalOverlays[m];
        if (el.hidden) continue;
        if (el.classList.contains('is-visible') || el.classList.contains('is-open') || el.getAttribute('aria-hidden') === 'false') {
          var cs = window.getComputedStyle(el);
          if (cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0') {
            return true;
          }
        }
      }
      var sheets = document.querySelectorAll('.modal-sheet');
      for (var s = 0; s < sheets.length; s++) {
        var sheet = sheets[s];
        if (sheet.offsetParent !== null) {
          var scs = window.getComputedStyle(sheet);
          if (scs.display !== 'none' && scs.visibility !== 'hidden') {
            return true;
          }
        }
      }
    } catch (_) {}
    return false;
  }

  function isRendered(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    var style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    return true;
  }

  function isTargetCovered(el) {
    if (!el || !isRendered(el)) return true;
    if (isModalOpen()) return true;
    try {
      if (typeof document.elementFromPoint !== 'function') return false;
      var r = el.getBoundingClientRect();
      var cx = Math.max(0, Math.min((window.innerWidth || 1) - 1, r.left + r.width / 2));
      var cy = Math.max(0, Math.min((window.innerHeight || 1) - 1, r.top + r.height / 2));
      var topEl = document.elementFromPoint(cx, cy);
      if (!topEl) return false;
      if (state.root && state.root.contains(topEl)) return false;
      if (el.contains(topEl) || topEl.contains(el)) return false;
      if (topEl.closest('.modal-overlay, .modal-sheet, .welcome-gate, .game-modal, .legal-viewer, .nav-drawer, .chat-drawer')) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  function visible(el) {
    if (!isRendered(el)) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 &&
      r.top < (window.innerHeight || 0) && r.left < (window.innerWidth || 0);
  }

  var closeWatchers = [];
  var modalObserver = null;

  function initModalObserver() {
    if (modalObserver || typeof MutationObserver === 'undefined') return;
    if (typeof document === 'undefined' || !document.body) return;
    var recheckTimer = null;
    function syncWithModals() {
      var open = isModalOpen();
      if (open && state.active && !state.paused) {
        state.paused = true;
        if (state.root) state.root.style.display = 'none';
      } else if (!open && state.active && state.paused) {
        state.paused = false;
        if (state.root) state.root.style.display = '';
        if (state.steps && state.steps[state.i]) {
          go(state.i);
        }
      }

      if (!open && closeWatchers.length > 0) {
        var cbs = closeWatchers.slice();
        closeWatchers = [];
        cbs.forEach(function (cb) {
          try { cb(); } catch (_) {}
        });
      }
    }
    // Sheets fade in and out with CSS transitions, and nothing in the DOM changes when a fade
    // ends; check again once it has finished so the tour pauses and resumes reliably.
    modalObserver = new MutationObserver(function () {
      syncWithModals();
      clearTimeout(recheckTimer);
      recheckTimer = setTimeout(syncWithModals, 450);
    });

    try {
      modalObserver.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ['class', 'style', 'aria-hidden', 'hidden']
      });
    } catch (_) {}
  }

  function watchForModalClose(cb) {
    initModalObserver();
    closeWatchers.push(cb);
  }

  function build() {
    if (state.root) return;
    var root = document.createElement('div');
    root.className = 'appu-tour';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Appu guided tour');
    root.innerHTML =
      '<div class="appu-tour-highlight" aria-hidden="true"></div>' +
      '<div class="appu-tour-bubble">' +
        '<button type="button" class="appu-tour-close" aria-label="Close tour">&times;</button>' +
        '<div class="appu-tour-appu" aria-hidden="true">🐘</div>' +
        '<p class="appu-tour-text"></p>' +
        '<div class="appu-tour-dots" aria-hidden="true"></div>' +
        '<div class="appu-tour-actions">' +
          '<button type="button" class="appu-tour-skip"></button>' +
          '<button type="button" class="appu-tour-next"></button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);
    state.root = root;
    state.els = {
      highlight: root.querySelector('.appu-tour-highlight'),
      bubble: root.querySelector('.appu-tour-bubble'),
      text: root.querySelector('.appu-tour-text'),
      dots: root.querySelector('.appu-tour-dots'),
      next: root.querySelector('.appu-tour-next'),
      skip: root.querySelector('.appu-tour-skip'),
      close: root.querySelector('.appu-tour-close')
    };
    state.els.next.addEventListener('click', function () { go(state.i + 1); });
    state.els.skip.addEventListener('click', finish);
    state.els.close.addEventListener('click', finish);
    document.addEventListener('keydown', function (e) {
      if (state.active && e.key === 'Escape') finish();
    });
  }

  function layout(step) {
    var hl = state.els.highlight;
    var bubble = state.els.bubble;
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var target = step.target ? document.querySelector(step.target) : null;

    // On small screens the target (e.g. the mic in the bottom dock) can be rendered but
    // scrolled out of view: bring it into view smoothly first so it gets the spotlight.
    if (target && !visible(target)) {
      var tr = target.getBoundingClientRect();
      if (tr.width > 0 && tr.height > 0 && typeof target.scrollIntoView === 'function') {
        try {
          target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } catch (_) {
          target.scrollIntoView(false);
        }
      }
    }

    if (!target || !visible(target)) {
      // Centered step (welcome / finish, or a target that isn't on screen).
      state.root.classList.add('is-centered');
      hl.style.opacity = '0';
      bubble.style.left = '50%';
      bubble.style.top = '50%';
      bubble.style.transform = 'translate(-50%, -50%)';
      return;
    }

    state.root.classList.remove('is-centered');
    hl.style.opacity = '1';
    var r = target.getBoundingClientRect();
    var pad = 8;
    hl.style.left = (r.left - pad) + 'px';
    hl.style.top = (r.top - pad) + 'px';
    hl.style.width = (r.width + pad * 2) + 'px';
    hl.style.height = (r.height + pad * 2) + 'px';

    // Position the bubble below the target if there's room, else above.
    bubble.style.transform = 'none';
    var bw = Math.min(360, vw - 32);
    bubble.style.width = bw + 'px';
    var bh = bubble.offsetHeight || 170;
    var left = r.left + r.width / 2 - bw / 2;
    left = Math.max(16, Math.min(left, vw - bw - 16));
    var top;
    if (r.bottom + bh + 20 < vh) {
      top = r.bottom + 16;
    } else if (r.top - bh - 20 > 0) {
      top = r.top - bh - 16;
    } else {
      top = Math.max(16, vh - bh - 16);
    }
    bubble.style.left = left + 'px';
    bubble.style.top = top + 'px';
  }

  function renderDots() {
    var html = '';
    for (var k = 0; k < state.steps.length; k++) {
      html += '<span class="appu-tour-dot' + (k === state.i ? ' is-active' : '') + '"></span>';
    }
    state.els.dots.innerHTML = html;
  }

  function go(i) {
    if (i >= state.steps.length) { finish(); return; }

    if (isModalOpen()) {
      state.pendingStep = i;
      state.paused = true;
      if (state.root) state.root.style.display = 'none';
      watchForModalClose(function () {
        if (state.active) {
          state.paused = false;
          if (state.root) state.root.style.display = '';
          var nextI = state.pendingStep != null ? state.pendingStep : state.i;
          state.pendingStep = null;
          go(nextI);
        }
      });
      return;
    }

    var step = state.steps[i];

    // If step has a target, verify it is rendered and not covered.
    // If not rendered or covered, skip to the next step.
    if (step.target) {
      var target = document.querySelector(step.target);
      if (!target || !isRendered(target)) {
        go(i + 1);
        return;
      }
      if (typeof target.scrollIntoView === 'function') {
        try {
          target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } catch (_) {
          target.scrollIntoView(false);
        }
      }
      if (isTargetCovered(target)) {
        go(i + 1);
        return;
      }
    }

    state.i = i;
    var txt = t(step.text);
    state.els.text.textContent = txt;
    var last = i === state.steps.length - 1;
    state.els.next.textContent = last ? t(LABELS.done) : t(LABELS.next);
    state.els.skip.textContent = t(LABELS.skip);
    state.els.skip.style.visibility = last ? 'hidden' : 'visible';
    renderDots();
    layout(step);
    // Re-layout once more after paint (bubble height is known now) and after smooth scroll completes
    window.requestAnimationFrame(function () { layout(step); });
    setTimeout(function () {
      if (state.active && !state.paused && state.i === i) {
        layout(step);
      }
    }, 320);
  }

  function start() {
    initModalObserver();
    if (isModalOpen()) {
      watchForModalClose(function () {
        start();
      });
      return;
    }
    build();
    state.steps = STEPS.slice();
    state.active = true;
    state.paused = false;
    state.root.style.display = '';
    state.root.classList.add('is-open');
    document.body.classList.add('appu-tour-open');
    if (!state.onResize) {
      state.onResize = function () {
        if (state.active && !state.paused && state.steps[state.i]) {
          layout(state.steps[state.i]);
        }
      };
      window.addEventListener('resize', state.onResize);
      window.addEventListener('scroll', state.onResize, true);
    }
    go(0);
  }

  function finish() {
    state.active = false;
    state.paused = false;
    markDone();
    if (state.root) {
      state.root.style.display = '';
      state.root.classList.remove('is-open');
    }
    document.body.classList.remove('appu-tour-open');
  }

  function maybeAutoStart() {
    if (isDone() || state.active) return;
    initModalObserver();
    if (isModalOpen()) {
      watchForModalClose(function () {
        maybeAutoStart();
      });
      return;
    }
    // Only in the app view, and give the stage a moment to lay out.
    if (!document.body || !document.body.classList.contains('view-app')) return;
    setTimeout(function () {
      if (!isDone() && !state.active && document.body.classList.contains('view-app')) {
        if (isModalOpen()) {
          watchForModalClose(function () {
            maybeAutoStart();
          });
          return;
        }
        start();
      }
    }, 1100);
  }

  window.AppuTour = {
    start: function () { start(); },
    maybeAutoStart: maybeAutoStart,
    reset: function () { try { localStorage.removeItem(DONE_KEY); } catch (e) {} }
  };

  // "Take the tour" replay button in the menu drawer.
  function wireReplay() {
    var btn = document.getElementById('btn-drawer-tour');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var closeBtn = document.getElementById('btn-close-nav-drawer');
      if (closeBtn) { try { closeBtn.click(); } catch (e) {} }
      setTimeout(start, 280);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireReplay);
  } else {
    wireReplay();
  }
})();
