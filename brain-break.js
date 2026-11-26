/**
 * Brain break for Class 5-8: after every 10 minutes of active learning, Appu offers a
 * one-minute mini game in the chat. Games alternate between a learning game (Maths Match)
 * and a fun one (Memory Flip). Appu's voice comes from the backend's fixed voice lines
 * (/api/appu/voice-line); if that audio is unavailable the game simply stays silent.
 */
(function () {
  'use strict';

  const ACTIVE_MS_FOR_BREAK = 10 * 60 * 1000;
  const IDLE_AFTER_MS = 60 * 1000;     // no input for a minute = not actively learning
  const TICK_MS = 5000;
  const GAME_SECONDS = 45;
  const MAX_MISTAKES = 2;
  const NEXT_GAME_KEY = 'appu_brain_break_next';

  // Display copy. The spoken lines must match backend/src/domain/voice/game-lines.ts.
  const COPY = {
    en: {
      offer: "Wow, you've been learning so well! Time for a quick game. Want to play?",
      play: "Let's play!", later: 'Later',
      startLearning: "Let's play Maths Match! Tap a question, then tap its answer.",
      startFun: "Let's play Memory Flip! Find all the matching pairs.",
      win: "Yay, you won! Amazing job! Now let's get back to learning.",
      lose: "Oh no, you lost the game this time. Better luck next time! Let's continue learning, and we'll play again after some time.",
      laterSaid: "Okay! Let's keep learning. We'll play later.",
      learningTitle: 'Maths Match', funTitle: 'Memory Flip',
      timeLeft: 'seconds left', mistakes: 'Mistakes', back: 'Back to learning'
    },
    kn: {
      offer: 'ವಾಹ್, ನೀನು ತುಂಬಾ ಚೆನ್ನಾಗಿ ಕಲಿಯುತ್ತಿದ್ದೀಯ! ಒಂದು ಚಿಕ್ಕ ಆಟದ ಸಮಯ. ಆಡೋಣವಾ?',
      play: 'ಆಡೋಣ!', later: 'ನಂತರ',
      startLearning: 'ಗಣಿತ ಜೋಡಿ ಆಟ ಆಡೋಣ! ಒಂದು ಪ್ರಶ್ನೆ ಒತ್ತು, ನಂತರ ಅದರ ಉತ್ತರ ಒತ್ತು.',
      startFun: 'ನೆನಪಿನ ಕಾರ್ಡ್ ಆಟ ಆಡೋಣ! ಒಂದೇ ರೀತಿಯ ಎಲ್ಲಾ ಜೋಡಿಗಳನ್ನು ಹುಡುಕು.',
      win: 'ಹುರ್ರೇ, ನೀನು ಗೆದ್ದೆ! ಅದ್ಭುತ! ಈಗ ಮತ್ತೆ ಕಲಿಯೋಣ.',
      lose: 'ಅಯ್ಯೋ, ಈ ಬಾರಿ ಆಟದಲ್ಲಿ ಸೋತೆ. ಮುಂದಿನ ಸಲ ಖಂಡಿತ ಗೆಲ್ಲುತ್ತೀಯ! ಕಲಿಕೆ ಮುಂದುವರಿಸೋಣ, ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಆಡೋಣ.',
      laterSaid: 'ಸರಿ! ಕಲಿಕೆ ಮುಂದುವರಿಸೋಣ. ನಂತರ ಆಡೋಣ.',
      learningTitle: 'ಗಣಿತ ಜೋಡಿ', funTitle: 'ನೆನಪಿನ ಕಾರ್ಡ್',
      timeLeft: 'ಸೆಕೆಂಡುಗಳು ಉಳಿದಿವೆ', mistakes: 'ತಪ್ಪುಗಳು', back: 'ಕಲಿಕೆಗೆ ಹಿಂತಿರುಗು'
    },
    hi: {
      offer: 'वाह, तुम बहुत अच्छे से सीख रहे हो! अब एक छोटे से खेल का समय। खेलें?',
      play: 'चलो खेलें!', later: 'बाद में',
      startLearning: 'चलो गणित मिलान खेलते हैं! एक सवाल चुनो, फिर उसका जवाब चुनो।',
      startFun: 'चलो मेमोरी कार्ड खेलते हैं! सारे एक जैसे जोड़े ढूँढो।',
      win: 'हुर्रे, तुम जीत गए! शानदार! अब फिर से सीखते हैं।',
      lose: 'अरे, इस बार तुम खेल हार गए। अगली बार ज़रूर जीतोगे! चलो पढ़ाई जारी रखते हैं, थोड़ी देर बाद फिर खेलेंगे।',
      laterSaid: 'ठीक है! चलो सीखते रहते हैं। बाद में खेलेंगे।',
      learningTitle: 'गणित मिलान', funTitle: 'मेमोरी कार्ड',
      timeLeft: 'सेकंड बाकी', mistakes: 'गलतियाँ', back: 'पढ़ाई पर वापस'
    }
  };

  // Language-neutral maths pairs, so the learning game works in every UI language.
  const MATHS_PAIRS = {
    junior: [['7 × 8', '56'], ['9 × 6', '54'], ['45 ÷ 5', '9'], ['½ of 30', '15'], ['12 + 19', '31'], ['100 − 37', '63'], ['3²', '9'], ['0.5 + 0.25', '0.75'], ['8 × 12', '96'], ['¼ of 20', '5']],
    senior: [['√81', '9'], ['15% of 200', '30'], ['2³', '8'], ['−4 + 9', '5'], ['3x = 21, x =', '7'], ['¾', '0.75'], ['12²', '144'], ['(−3) × (−5)', '15'], ['⅖ of 50', '20'], ['√144', '12']]
  };
  const FLIP_EMOJIS = ['🐘', '🚀', '🌈', '🦋', '🍉', '⚽', '🌻', '🐢'];

  const state = { activeMs: 0, lastInputAt: 0, lastTickAt: 0, open: false, timers: [], audio: null };

  const lang = () => { const l = window.currentLang || localStorage.getItem('appu_lang') || 'en'; return COPY[l] ? l : 'en'; };
  const t = (key) => COPY[lang()][key];
  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function childGrade() {
    try {
      const g = typeof window.getActiveChildGrade === 'function' ? window.getActiveChildGrade() : null;
      if (g) return parseInt(g, 10);
      const guest = JSON.parse(localStorage.getItem('appu_guest_profile') || 'null');
      return guest && guest.grade ? parseInt(guest.grade, 10) : null;
    } catch (_) { return null; }
  }
  const isEligible = () => { const g = childGrade(); return g >= 5 && g <= 8; };

  function appuIsBusy() {
    const typing = document.getElementById('chat-typing');
    if (typing && typing.style.display !== 'none' && typing.offsetParent !== null) return true;
    if (window.speechSynthesis && window.speechSynthesis.speaking) return true;
    return Array.from(document.querySelectorAll('audio')).some((a) => a !== state.audio && !a.paused && !a.ended);
  }

  function inAppView() {
    return document.visibilityState === 'visible' && !document.body.classList.contains('view-landing');
  }

  function say(key) {
    try {
      if (state.audio) state.audio.pause();
      const base = window.AppuBackendClient && typeof window.AppuBackendClient.getApiBaseUrl === 'function'
        ? window.AppuBackendClient.getApiBaseUrl() : 'https://api.appuai.online';
      const audio = new Audio(`${base}/api/appu/voice-line/${key}?lang=${lang()}`);
      state.audio = audio;
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) { /* silent: the text is always on screen */ }
  }

  function clearTimers() { state.timers.forEach((id) => clearInterval(id)); state.timers = []; }

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function nextGameType() {
    let next = 'learning';
    try { next = localStorage.getItem(NEXT_GAME_KEY) === 'fun' ? 'fun' : 'learning'; } catch (_) {}
    try { localStorage.setItem(NEXT_GAME_KEY, next === 'fun' ? 'learning' : 'fun'); } catch (_) {}
    return next;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function scrollIntoView(node) {
    try { node.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'end' }); } catch (_) {}
  }

  // ---- Offer -------------------------------------------------------------------------
  function offer() {
    const host = document.getElementById('chat-messages');
    if (!host || state.open) return false;
    state.open = true;
    state.activeMs = 0;

    const row = el('div', 'message-row appu brain-break-row');
    const card = el('section', 'brain-break');
    card.setAttribute('aria-label', 'Brain break');
    const msg = el('p', 'brain-break-msg', t('offer'));
    const actions = el('div', 'brain-break-actions');
    const play = el('button', 'brain-break-btn is-primary', t('play'));
    const later = el('button', 'brain-break-btn', t('later'));
    play.type = 'button'; later.type = 'button';
    play.dataset.action = 'play'; later.dataset.action = 'later';
    actions.append(play, later);
    card.append(el('div', 'brain-break-icon', '🎮'), msg, actions);
    row.appendChild(card);
    host.appendChild(row);
    scrollIntoView(row);
    say('offer');

    play.addEventListener('click', () => startGame(card, nextGameType()));
    later.addEventListener('click', () => {
      msg.textContent = t('laterSaid');
      actions.remove();
      say('later');
      finish();
    });
    return true;
  }

  function finish() {
    clearTimers();
    state.open = false;
    state.activeMs = 0;
  }

  // ---- Game shell --------------------------------------------------------------------
  function startGame(card, type) {
    card.innerHTML = '';
    card.classList.add('is-playing');
    const head = el('div', 'brain-break-head');
    head.append(el('h3', 'brain-break-title', type === 'fun' ? t('funTitle') : t('learningTitle')));
    const clock = el('span', 'brain-break-clock');
    clock.setAttribute('role', 'timer');
    head.appendChild(clock);
    const hint = el('p', 'brain-break-msg', type === 'fun' ? t('startFun') : t('startLearning'));
    const board = el('div', 'brain-break-board');
    const status = el('p', 'brain-break-status');
    status.setAttribute('aria-live', 'polite');
    card.append(head, hint, board, status);
    say(type === 'fun' ? 'startFun' : 'startLearning');

    let secondsLeft = GAME_SECONDS;
    let over = false;
    const renderClock = () => { clock.textContent = `${secondsLeft} ${t('timeLeft')}`; clock.classList.toggle('is-low', secondsLeft <= 10); };
    renderClock();

    const end = (won) => {
      if (over) return;
      over = true;
      clearTimers();
      board.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      card.classList.add(won ? 'is-won' : 'is-lost');
      hint.textContent = won ? t('win') : t('lose');
      status.textContent = '';
      const back = el('button', 'brain-break-btn is-primary', t('back'));
      back.type = 'button';
      back.addEventListener('click', () => {
        const input = document.getElementById('home-ask-input') || document.getElementById('chat-input');
        if (input) input.focus();
      });
      card.appendChild(back);
      say(won ? 'win' : 'lose');
      finish();
      scrollIntoView(card);
    };

    state.timers.push(setInterval(() => {
      secondsLeft -= 1;
      renderClock();
      if (secondsLeft <= 0) end(false);
    }, 1000));

    if (type === 'fun') buildMemoryFlip(board, end);
    else buildMathsMatch(board, status, end);
    scrollIntoView(card);
  }

  // ---- Learning game: tap a question, then its answer ---------------------------------
  function buildMathsMatch(board, status, end) {
    const grade = childGrade() || 5;
    const pairs = shuffle(MATHS_PAIRS[grade >= 7 ? 'senior' : 'junior']).slice(0, 4);
    board.classList.add('is-match');
    const left = el('div', 'brain-break-col');
    const right = el('div', 'brain-break-col');
    let picked = null;
    let matched = 0;
    let mistakes = 0;
    const showMistakes = () => { status.textContent = `${t('mistakes')}: ${mistakes} / ${MAX_MISTAKES}`; };

    pairs.forEach(([q], i) => {
      const b = el('button', 'brain-break-tile', q);
      b.type = 'button'; b.dataset.pair = String(i); b.dataset.side = 'q';
      left.appendChild(b);
    });
    shuffle(pairs.map((p, i) => [p[1], i])).forEach(([a, i]) => {
      const b = el('button', 'brain-break-tile', a);
      b.type = 'button'; b.dataset.pair = String(i); b.dataset.side = 'a';
      right.appendChild(b);
    });
    board.append(left, right);

    board.addEventListener('click', (e) => {
      const tile = e.target.closest('.brain-break-tile');
      if (!tile || tile.disabled) return;
      if (!picked || picked.dataset.side === tile.dataset.side) {
        if (picked) picked.classList.remove('is-picked');
        picked = tile;
        tile.classList.add('is-picked');
        return;
      }
      const first = picked;
      picked = null;
      first.classList.remove('is-picked');
      if (first.dataset.pair === tile.dataset.pair) {
        [first, tile].forEach((b) => { b.classList.add('is-matched'); b.disabled = true; });
        matched += 1;
        if (matched === pairs.length) end(true);
      } else {
        mistakes += 1;
        [first, tile].forEach((b) => { b.classList.add('is-wrong'); setTimeout(() => b.classList.remove('is-wrong'), 450); });
        showMistakes();
        if (mistakes > MAX_MISTAKES) end(false);
      }
    });
  }

  // ---- Fun game: flip cards to find matching pairs ------------------------------------
  function buildMemoryFlip(board, end) {
    const faces = shuffle(FLIP_EMOJIS).slice(0, 4);
    const deck = shuffle(faces.concat(faces));
    board.classList.add('is-flip');
    let open = [];
    let found = 0;
    deck.forEach((face) => {
      const b = el('button', 'brain-break-card');
      b.type = 'button';
      b.dataset.face = face;
      b.setAttribute('aria-label', 'Hidden card');
      b.textContent = '?';
      board.appendChild(b);
    });

    board.addEventListener('click', (e) => {
      const card = e.target.closest('.brain-break-card');
      if (!card || card.disabled || open.length === 2 || open.includes(card)) return;
      card.classList.add('is-open');
      card.textContent = card.dataset.face;
      card.setAttribute('aria-label', card.dataset.face);
      open.push(card);
      if (open.length < 2) return;
      const [a, b] = open;
      if (a.dataset.face === b.dataset.face) {
        [a, b].forEach((c) => { c.classList.add('is-matched'); c.disabled = true; });
        open = [];
        found += 1;
        if (found === faces.length) end(true);
      } else {
        setTimeout(() => {
          [a, b].forEach((c) => { c.classList.remove('is-open'); c.textContent = '?'; c.setAttribute('aria-label', 'Hidden card'); });
          open = [];
        }, 700);
      }
    });
  }

  // ---- Active-time tracker -----------------------------------------------------------
  function markInput() { state.lastInputAt = Date.now(); }

  function tick() {
    const now = Date.now();
    const elapsed = state.lastTickAt ? Math.min(now - state.lastTickAt, TICK_MS * 2) : 0;
    state.lastTickAt = now;
    if (state.open || !inAppView() || !isEligible()) return;
    if (now - state.lastInputAt <= IDLE_AFTER_MS || appuIsBusy()) state.activeMs += elapsed;
    if (state.activeMs >= ACTIVE_MS_FOR_BREAK && !appuIsBusy()) offer();
  }

  function init() {
    ['keydown', 'pointerdown', 'submit'].forEach((type) => document.addEventListener(type, markInput, true));
    setInterval(tick, TICK_MS);
  }

  window.AppuBrainBreak = { offerNow: offer, isEligible, _state: state };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
