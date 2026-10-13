/**
 * AppuDaily: real daily streak, "ask 3 questions today" challenge and Question of the Day.
 *
 * - Per child, per local calendar day. State lives in localStorage under
 *   `appu_daily_v1:<childId>` (device-local, like the rest of the gamification state).
 * - The streak counts consecutive days with at least one question; a missed day resets it.
 * - Logic is pure (injectable storage/clock) so it can be unit-tested in Node.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) {
    root.AppuDaily = api.createDaily({
      storage: (function () { try { return root.localStorage; } catch (_) { return null; } })(),
      getChildId: () => (root.AppuSession && root.AppuSession.childId) || null,
      getGrade: () => (root.AppuSession && typeof root.AppuSession.getGrade === 'function' ? root.AppuSession.getGrade() : null),
      now: () => new Date()
    });
    api.mountCard(root, root.AppuDaily);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const GOAL = 3;
  const BONUS_XP = 30;
  const KEY_PREFIX = 'appu_daily_v1:';

  // Question of the Day bank: three grade bands x 7 questions, each in en / kn / hi.
  const BANK = {
    '5-7': [
      { en: 'Why is the sky blue?', kn: 'ಆಕಾಶ ಏಕೆ ನೀಲಿಯಾಗಿದೆ?', hi: 'आसमान नीला क्यों होता है?' },
      { en: 'How do plants make their own food?', kn: 'ಸಸ್ಯಗಳು ತಮ್ಮ ಆಹಾರವನ್ನು ಹೇಗೆ ತಯಾರಿಸುತ್ತವೆ?', hi: 'पौधे अपना भोजन कैसे बनाते हैं?' },
      { en: 'Why do we have day and night?', kn: 'ನಮಗೆ ಹಗಲು ಮತ್ತು ರಾತ್ರಿ ಏಕೆ ಇರುತ್ತವೆ?', hi: 'दिन और रात क्यों होते हैं?' },
      { en: 'What is a fraction, and where do we use it in daily life?', kn: 'ಭಿನ್ನರಾಶಿ ಎಂದರೇನು, ದೈನಂದಿನ ಜೀವನದಲ್ಲಿ ಅದನ್ನು ಎಲ್ಲಿ ಬಳಸುತ್ತೇವೆ?', hi: 'भिन्न क्या होता है और हम इसे रोज़ की ज़िंदगी में कहाँ इस्तेमाल करते हैं?' },
      { en: 'Why does ice float on water?', kn: 'ಮಂಜುಗಡ್ಡೆ ನೀರಿನ ಮೇಲೆ ಏಕೆ ತೇಲುತ್ತದೆ?', hi: 'बर्फ़ पानी पर क्यों तैरती है?' },
      { en: 'How does the water cycle work?', kn: 'ನೀರಿನ ಚಕ್ರ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ?', hi: 'जल चक्र कैसे काम करता है?' },
      { en: 'Why does a magnet stick to some things but not others?', kn: 'ಆಯಸ್ಕಾಂತ ಕೆಲವು ವಸ್ತುಗಳಿಗೆ ಮಾತ್ರ ಏಕೆ ಅಂಟಿಕೊಳ್ಳುತ್ತದೆ?', hi: 'चुंबक कुछ चीज़ों से ही क्यों चिपकता है?' }
    ],
    '8-10': [
      { en: 'Why do we see lightning before we hear thunder?', kn: 'ನಾವು ಗುಡುಗಿಗಿಂತ ಮೊದಲು ಮಿಂಚನ್ನು ಏಕೆ ನೋಡುತ್ತೇವೆ?', hi: 'हमें बिजली की चमक गरज से पहले क्यों दिखती है?' },
      { en: 'How does a vaccine train the body to fight germs?', kn: 'ಲಸಿಕೆ ಸೂಕ್ಷ್ಮಾಣುಗಳ ವಿರುದ್ಧ ಹೋರಾಡಲು ದೇಹಕ್ಕೆ ಹೇಗೆ ತರಬೇತಿ ನೀಡುತ್ತದೆ?', hi: 'टीका शरीर को कीटाणुओं से लड़ना कैसे सिखाता है?' },
      { en: 'Why do some things dissolve in water and others do not?', kn: 'ಕೆಲವು ವಸ್ತುಗಳು ನೀರಿನಲ್ಲಿ ಕರಗುತ್ತವೆ, ಇನ್ನು ಕೆಲವು ಏಕೆ ಕರಗುವುದಿಲ್ಲ?', hi: 'कुछ चीज़ें पानी में घुल जाती हैं और कुछ क्यों नहीं घुलतीं?' },
      { en: 'How do we use algebra to solve real-life problems?', kn: 'ನಿಜ ಜೀವನದ ಸಮಸ್ಯೆಗಳನ್ನು ಬಿಡಿಸಲು ನಾವು ಬೀಜಗಣಿತವನ್ನು ಹೇಗೆ ಬಳಸುತ್ತೇವೆ?', hi: 'असल ज़िंदगी की समस्याएँ हल करने में हम बीजगणित का उपयोग कैसे करते हैं?' },
      { en: 'What causes earthquakes?', kn: 'ಭೂಕಂಪಗಳಿಗೆ ಕಾರಣವೇನು?', hi: 'भूकंप क्यों आते हैं?' },
      { en: 'How do mirrors and lenses bend light?', kn: 'ಕನ್ನಡಿಗಳು ಮತ್ತು ಮಸೂರಗಳು ಬೆಳಕನ್ನು ಹೇಗೆ ತಿರುಗಿಸುತ್ತವೆ?', hi: 'दर्पण और लेंस प्रकाश को कैसे मोड़ते हैं?' },
      { en: 'How was the Indian Constitution written?', kn: 'ಭಾರತದ ಸಂವಿಧಾನ ಹೇಗೆ ರಚನೆಯಾಯಿತು?', hi: 'भारत का संविधान कैसे लिखा गया?' }
    ],
    '11-12': [
      { en: 'How does DNA copy itself?', kn: 'ಡಿಎನ್‌ಎ ತನ್ನನ್ನು ತಾನೇ ಹೇಗೆ ನಕಲು ಮಾಡಿಕೊಳ್ಳುತ್ತದೆ?', hi: 'डीएनए अपनी प्रतिलिपि कैसे बनाता है?' },
      { en: 'Why does the derivative give the slope of a curve?', kn: 'ಅವಕಲನವು ವಕ್ರರೇಖೆಯ ಇಳಿಜಾರನ್ನು ಏಕೆ ಕೊಡುತ್ತದೆ?', hi: 'अवकलज वक्र की ढलान क्यों देता है?' },
      { en: 'How does a chemical equilibrium shift when conditions change?', kn: 'ಪರಿಸ್ಥಿತಿಗಳು ಬದಲಾದಾಗ ರಾಸಾಯನಿಕ ಸಮತೋಲನ ಹೇಗೆ ಬದಲಾಗುತ್ತದೆ?', hi: 'स्थितियाँ बदलने पर रासायनिक साम्य कैसे बदलता है?' },
      { en: 'What is the difference between a market economy and a planned economy?', kn: 'ಮಾರುಕಟ್ಟೆ ಆರ್ಥಿಕತೆ ಮತ್ತು ಯೋಜಿತ ಆರ್ಥಿಕತೆಯ ನಡುವಿನ ವ್ಯತ್ಯಾಸವೇನು?', hi: 'बाज़ार अर्थव्यवस्था और योजनाबद्ध अर्थव्यवस्था में क्या अंतर है?' },
      { en: 'How do electric and magnetic fields create light waves?', kn: 'ವಿದ್ಯುತ್ ಮತ್ತು ಕಾಂತೀಯ ಕ್ಷೇತ್ರಗಳು ಬೆಳಕಿನ ತರಂಗಗಳನ್ನು ಹೇಗೆ ಸೃಷ್ಟಿಸುತ್ತವೆ?', hi: 'विद्युत और चुंबकीय क्षेत्र प्रकाश तरंगें कैसे बनाते हैं?' },
      { en: 'How does natural selection lead to new species?', kn: 'ನೈಸರ್ಗಿಕ ಆಯ್ಕೆಯು ಹೊಸ ಜಾತಿಗಳಿಗೆ ಹೇಗೆ ಕಾರಣವಾಗುತ್ತದೆ?', hi: 'प्राकृतिक चयन से नई जातियाँ कैसे बनती हैं?' },
      { en: 'Why is compound interest more powerful than simple interest over time?', kn: 'ಕಾಲಕ್ರಮೇಣ ಚಕ್ರಬಡ್ಡಿ ಸರಳ ಬಡ್ಡಿಗಿಂತ ಏಕೆ ಹೆಚ್ಚು ಪರಿಣಾಮಕಾರಿ?', hi: 'समय के साथ चक्रवृद्धि ब्याज साधारण ब्याज से अधिक प्रभावशाली क्यों होता है?' }
    ]
  };

  const LABELS = {
    en: { tag: 'Question of the day', ask: 'Ask Appu', today: (n, g) => `${n}/${g} today`, done: 'Challenge done!', streak: (n) => `${n}-day streak`, goal: (g) => `Ask ${g} questions today` },
    kn: { tag: 'ಇಂದಿನ ಪ್ರಶ್ನೆ', ask: 'ಅಪ್ಪುವನ್ನು ಕೇಳಿ', today: (n, g) => `ಇಂದು ${n}/${g}`, done: 'ಸವಾಲು ಪೂರ್ಣ!', streak: (n) => `${n} ದಿನದ ಸರಣಿ`, goal: (g) => `ಇಂದು ${g} ಪ್ರಶ್ನೆ ಕೇಳಿ` },
    hi: { tag: 'आज का सवाल', ask: 'अप्पू से पूछें', today: (n, g) => `आज ${n}/${g}`, done: 'चुनौती पूरी!', streak: (n) => `${n} दिन लगातार`, goal: (g) => `आज ${g} सवाल पूछें` }
  };

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function dayKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function dayNumber(d) { return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }

  function bandFor(grade) {
    const n = parseInt(String(grade == null ? '' : grade).replace(/\D+/g, ''), 10);
    if (n >= 11) return '11-12';
    if (n >= 8) return '8-10';
    return '5-7';
  }

  function createDaily(deps) {
    const storage = deps.storage || null;
    const getChildId = deps.getChildId || (() => null);
    const getGrade = deps.getGrade || (() => null);
    const now = deps.now || (() => new Date());

    function keyFor() { return KEY_PREFIX + (getChildId() || 'guest'); }

    function load() {
      try {
        const raw = storage && storage.getItem(keyFor());
        const p = raw ? JSON.parse(raw) : null;
        if (p && typeof p === 'object') {
          return {
            lastDate: typeof p.lastDate === 'string' ? p.lastDate : null,
            streak: Number.isFinite(p.streak) ? p.streak : 0,
            best: Number.isFinite(p.best) ? p.best : 0,
            countDate: typeof p.countDate === 'string' ? p.countDate : null,
            count: Number.isFinite(p.count) ? p.count : 0,
            awardedDate: typeof p.awardedDate === 'string' ? p.awardedDate : null
          };
        }
      } catch (_) {}
      return { lastDate: null, streak: 0, best: 0, countDate: null, count: 0, awardedDate: null };
    }

    function save(s) {
      try { if (storage) storage.setItem(keyFor(), JSON.stringify(s)); } catch (_) {}
    }

    // The streak shown right now: alive if the last question was today or yesterday.
    function getStreak() {
      const s = load();
      const d = now();
      return s.lastDate === dayKey(d) || s.lastDate === dayKey(addDays(d, -1)) ? s.streak : 0;
    }

    function getProgress() {
      const s = load();
      const today = dayKey(now());
      const count = s.countDate === today ? s.count : 0;
      return { count, goal: GOAL, done: s.awardedDate === today || count >= GOAL, streak: getStreak() };
    }

    // Call once per real question the learner asks. Returns what changed.
    function noteQuestion() {
      const s = load();
      const d = now();
      const today = dayKey(d);
      let streakIncreased = false;

      if (s.lastDate !== today) {
        s.streak = s.lastDate === dayKey(addDays(d, -1)) ? s.streak + 1 : 1;
        s.lastDate = today;
        streakIncreased = true;
      }
      if (s.streak > s.best) s.best = s.streak;

      if (s.countDate !== today) { s.countDate = today; s.count = 0; }
      s.count += 1;

      let completed = false;
      if (s.count >= GOAL && s.awardedDate !== today) {
        s.awardedDate = today;
        completed = true;
      }
      save(s);
      return { streak: s.streak, count: s.count, goal: GOAL, completed, streakIncreased, bonusXp: completed ? BONUS_XP : 0 };
    }

    // Same question all day for a given grade band; rotates daily.
    function getQuestionOfTheDay(lang) {
      const list = BANK[bandFor(getGrade())];
      const item = list[((dayNumber(now()) % list.length) + list.length) % list.length];
      return item[lang] || item.en;
    }

    return { getStreak, getProgress, noteQuestion, getQuestionOfTheDay, GOAL, BONUS_XP };
  }

  // ---- Browser card (mission stage) ----
  function mountCard(win, daily) {
    const doc = win.document;
    let card = null;

    function lang() {
      const l = (win.app && win.app.currentLang) || (function () { try { return win.localStorage.getItem('appu_lang'); } catch (_) { return null; } })();
      return LABELS[l] ? l : 'en';
    }

    function authed() {
      return Boolean(win.AppuSession && typeof win.AppuSession.isAuthenticated === 'function' && win.AppuSession.isAuthenticated());
    }

    // Wide screens: the stage's free top-left corner (the centre is the avatar). Narrower
    // screens: inline under the mission title. Same element, re-parented on resize.
    const wide = typeof win.matchMedia === 'function' ? win.matchMedia('(min-width: 1000px)') : null;

    function place() {
      if (!card) return;
      const stage = doc.querySelector('.mission-stage');
      const anchor = doc.getElementById('mission-subtitle');
      if (wide && wide.matches && stage) {
        if (card.parentNode !== stage) stage.appendChild(card);
      } else if (anchor && anchor.parentNode) {
        if (card.previousSibling !== anchor || card.parentNode !== anchor.parentNode) {
          anchor.parentNode.insertBefore(card, anchor.nextSibling);
        }
      }
    }

    function ensureCard() {
      if (card && card.isConnected) return card;
      if (!doc.getElementById('mission-subtitle')) return null;
      card = doc.createElement('div');
      card.id = 'daily-card';
      card.className = 'daily-card';
      doc.body.appendChild(card);
      place();
      return card;
    }

    function render() {
      const el = ensureCard();
      if (!el) return;
      if (!authed()) { el.hidden = true; return; }
      const t = LABELS[lang()];
      const p = daily.getProgress();
      const q = daily.getQuestionOfTheDay(lang());
      const pct = Math.min(100, Math.round((p.count / p.goal) * 100));
      el.hidden = false;
      el.innerHTML = '';

      const qBtn = doc.createElement('button');
      qBtn.type = 'button';
      qBtn.className = 'daily-qotd';
      qBtn.setAttribute('aria-label', `${t.tag}: ${q}. ${t.ask}`);
      const tag = doc.createElement('span'); tag.className = 'daily-tag'; tag.textContent = t.tag;
      const qt = doc.createElement('span'); qt.className = 'daily-q'; qt.textContent = q;
      const ask = doc.createElement('span'); ask.className = 'daily-ask'; ask.textContent = t.ask + ' →';
      qBtn.append(tag, qt, ask);
      qBtn.addEventListener('click', () => {
        if (typeof win.handleUserInteraction === 'function') win.handleUserInteraction(q);
      });

      const prog = doc.createElement('div');
      prog.className = 'daily-progress';
      prog.setAttribute('role', 'progressbar');
      prog.setAttribute('aria-valuemin', '0');
      prog.setAttribute('aria-valuemax', String(p.goal));
      prog.setAttribute('aria-valuenow', String(Math.min(p.count, p.goal)));
      prog.setAttribute('aria-label', t.goal(p.goal));
      const flame = doc.createElement('span'); flame.className = 'daily-flame';
      flame.title = t.streak(p.streak);
      flame.textContent = '🔥 ' + p.streak;
      const bar = doc.createElement('span'); bar.className = 'daily-bar';
      const fill = doc.createElement('i'); fill.style.width = pct + '%'; bar.appendChild(fill);
      const cnt = doc.createElement('span'); cnt.className = 'daily-count';
      cnt.textContent = p.done ? '✅ ' + t.done : t.today(Math.min(p.count, p.goal), p.goal);
      prog.append(flame, bar, cnt);

      el.append(qBtn, prog);
    }

    // Called by app.js after each real question.
    daily.afterQuestion = function () {
      const r = daily.noteQuestion();
      if (r.completed && win.AppuGamification && typeof win.AppuGamification.awardXP === 'function') {
        win.AppuGamification.awardXP(r.bonusXp, lang() === 'kn' ? 'ಇಂದಿನ ಸವಾಲು ಪೂರ್ಣ! 🔥' : (lang() === 'hi' ? 'आज की चुनौती पूरी! 🔥' : 'Daily challenge complete! 🔥'));
      }
      if (win.AppuGamification && typeof win.AppuGamification.updateUI === 'function') win.AppuGamification.updateUI();
      render();
      return r;
    };
    daily.render = render;

    if (wide && typeof wide.addEventListener === 'function') wide.addEventListener('change', place);
    win.addEventListener('appu:auth-status', render);
    doc.addEventListener('click', (e) => {
      if (e.target && e.target.closest && e.target.closest('.lang-btn')) win.setTimeout(render, 80);
    });
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', render);
    else render();
    // The session can become authenticated without a status event (e.g. child launch).
    win.setTimeout(render, 1500);
    win.setTimeout(render, 4000);
  }

  return { createDaily, mountCard, BANK, LABELS, GOAL, BONUS_XP, bandFor, dayKey };
});
