/**
 * APPU Marketing Landing Page Controller
 * Handles view transitions between marketing landing and app shell,
 * language switching, speech recognition input, and anonymous question handoff.
 */
(function(window) {
  'use strict';

  const LandingPage = {
    currentLang: 'en',
    recognition: null,
    isListening: false,
    initialized: false,

    init() {
      if (this.initialized) return;
      this.initialized = true;

      const btnTryFree = document.getElementById('landing-btn-try-free');
      const questionForm = document.getElementById('landing-question-form');
      const questionInput = document.getElementById('landing-question-input');
      const btnMic = document.getElementById('landing-btn-mic');
      const btnSignIn = document.getElementById('landing-btn-signin');
      const promptChips = document.querySelectorAll('.landing-prompt-chip');
      const langTrigger = document.getElementById('landing-lang-btn');
      const langMenu = document.getElementById('landing-lang-menu');
      const btnBackToLanding = document.getElementById('btn-back-to-landing');
      const topbarBrand = document.querySelector('.topbar .brand');

      // Check URL parameters and location hash
      const urlParams = new URLSearchParams(window.location.search);
      const viewParam = urlParams.get('view');
      const appParam = urlParams.get('app');
      const hash = window.location.hash;

      if (viewParam === 'app' || appParam === '1' || hash === '#app') {
        this.showApp();
      } else {
        this.showLanding();
      }

      // "Try APPU free" CTA
      if (btnTryFree) {
        btnTryFree.addEventListener('click', () => {
          this.enterApp('');
        });
      }

      // "Start with one question" form submit
      if (questionForm) {
        questionForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const query = questionInput ? questionInput.value.trim() : '';
          this.enterApp(query);
        });
      }

      // Starter prompt chips
      promptChips.forEach(chip => {
        chip.addEventListener('click', () => {
          const q = chip.getAttribute('data-question') || chip.textContent.trim();
          if (questionInput) questionInput.value = q;
          this.enterApp(q);
        });
      });

      // "Sign in" Header CTA -> open parent setup/auth modal
      if (btnSignIn) {
        btnSignIn.addEventListener('click', () => {
          if (window.ParentSetupUI && typeof window.ParentSetupUI.openModal === 'function') {
            window.ParentSetupUI.openModal(1);
          } else {
            const mainAuthBtn = document.getElementById('btn-main-auth');
            if (mainAuthBtn) mainAuthBtn.click();
          }
        });
      }

      // Mic Voice Input (Web Speech API)
      if (btnMic) {
        btnMic.addEventListener('click', (e) => {
          e.preventDefault();
          this.toggleVoiceInput();
        });
      }

      // Language Switcher Dropdown
      if (langTrigger && langMenu) {
        langTrigger.addEventListener('click', (e) => {
          e.stopPropagation();
          const isExp = langTrigger.getAttribute('aria-expanded') === 'true';
          langTrigger.setAttribute('aria-expanded', String(!isExp));
          langMenu.hidden = isExp;
        });

        document.addEventListener('click', () => {
          langTrigger.setAttribute('aria-expanded', 'false');
          langMenu.hidden = true;
        });

        langMenu.querySelectorAll('li[data-lang]').forEach(item => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            const lang = item.getAttribute('data-lang');
            this.setLanguage(lang);
            langTrigger.setAttribute('aria-expanded', 'false');
            langMenu.hidden = true;
          });
        });
      }

      // Return to Landing Page Affordances
      if (btnBackToLanding) {
        btnBackToLanding.addEventListener('click', (e) => {
          e.preventDefault();
          this.showLanding();
        });
      }
      if (topbarBrand) {
        topbarBrand.addEventListener('click', (e) => {
          // If clicked in app view, allow user to return to marketing landing
          if (document.body.classList.contains('view-app')) {
            e.preventDefault();
            this.showLanding();
          }
        });
      }
    },

    setLanguage(lang) {
      this.currentLang = lang;
      const langLabels = { en: 'English', kn: 'ಕನ್ನಡ', hi: 'हिंदी' };
      const currentLabelEl = document.getElementById('landing-lang-current');
      if (currentLabelEl) {
        currentLabelEl.textContent = langLabels[lang] || 'English';
      }

      const langMenu = document.getElementById('landing-lang-menu');
      if (langMenu) {
        langMenu.querySelectorAll('li[data-lang]').forEach(li => {
          const isMatch = li.getAttribute('data-lang') === lang;
          li.classList.toggle('is-selected', isMatch);
          li.setAttribute('aria-selected', String(isMatch));
        });
      }

      // Propagate language to existing app if loaded
      if (window.app && typeof window.app.setLanguage === 'function') {
        window.app.setLanguage(lang);
      } else {
        try { localStorage.setItem('appu_language', lang); } catch (_) {}
      }

      this.updateLanguageCopy(lang);
    },

    updateLanguageCopy(lang) {
      const helper = document.querySelector('.landing-question-helper span');
      const speech = document.querySelector('.landing-speech-bubble span');
      const input = document.getElementById('landing-question-input');

      if (lang === 'kn') {
        if (helper) helper.textContent = 'ಇಂಗ್ಲಿಷ್, ಕನ್ನಡ ಅಥವಾ ಹಿಂದಿಯಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ ಅಥವಾ ಮಾತನಾಡಿ';
        if (speech) speech.textContent = '"ನಿಮ್ಮ ರೀತಿಯಲ್ಲಿ ಕಲಿಯೋಣ."';
        if (input) input.placeholder = 'ನೀವು ಏನನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಬಯಸುತ್ತೀರಿ?';
      } else if (lang === 'hi') {
        if (helper) helper.textContent = 'अंग्रेजी, कन्नड़ या हिंदी में टाइप करें या बोलें';
        if (speech) speech.textContent = '"आइए आपके तरीके से सीखें।"';
        if (input) input.placeholder = 'आप क्या समझना चाहते हैं?';
      } else {
        if (helper) helper.textContent = 'Type or speak in English, Kannada or Hindi';
        if (speech) speech.textContent = '"Let\'s learn your way."';
        if (input) input.placeholder = 'What would you like to understand?';
      }
    },

    toggleVoiceInput() {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      const micBtn = document.getElementById('landing-btn-mic');
      const input = document.getElementById('landing-question-input');

      if (!SpeechRec) {
        if (input) {
          input.focus();
          input.placeholder = 'Mic unavailable in this browser. Please type here...';
        }
        return;
      }

      if (this.isListening) {
        if (this.recognition) {
          try { this.recognition.stop(); } catch (_) {}
        }
        this.isListening = false;
        if (micBtn) micBtn.classList.remove('is-listening');
        return;
      }

      try {
        const rec = new SpeechRec();
        this.recognition = rec;
        rec.lang = this.currentLang === 'kn' ? 'kn-IN' : (this.currentLang === 'hi' ? 'hi-IN' : 'en-IN');
        rec.interimResults = true;
        rec.maxAlternatives = 1;

        rec.onstart = () => {
          this.isListening = true;
          if (micBtn) micBtn.classList.add('is-listening');
          if (input) input.placeholder = 'Listening... Speak now';
        };

        rec.onresult = (event) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
          }
          if (input) input.value = transcript;
        };

        rec.onerror = (err) => {
          console.warn('[LandingVoice] Speech error:', err);
          this.isListening = false;
          if (micBtn) micBtn.classList.remove('is-listening');
        };

        rec.onend = () => {
          this.isListening = false;
          if (micBtn) micBtn.classList.remove('is-listening');
          const finalQuery = input ? input.value.trim() : '';
          if (finalQuery) {
            this.enterApp(finalQuery);
          } else {
            if (input) input.placeholder = 'What would you like to understand?';
          }
        };

        rec.start();
      } catch (err) {
        console.warn('[LandingVoice] Start failed:', err);
        this.isListening = false;
        if (micBtn) micBtn.classList.remove('is-listening');
      }
    },

    showLanding() {
      const landing = document.getElementById('marketing-landing');
      const appShell = document.getElementById('app-shell');
      const orbs = document.querySelectorAll('.ambient-orb');

      if (landing) {
        landing.classList.remove('is-hidden');
        landing.style.display = 'block';
      }
      if (appShell) {
        appShell.classList.add('is-hidden');
        appShell.style.display = 'none';
      }
      document.body.classList.remove('view-app');
      document.body.classList.add('view-landing');
      orbs.forEach(orb => { orb.style.display = 'none'; });

      try {
        if (window.history && typeof window.history.replaceState === 'function') {
          const url = new URL(window.location.href);
          url.searchParams.delete('app');
          url.searchParams.set('view', 'landing');
          url.hash = '';
          window.history.replaceState({}, '', url.toString());
        }
      } catch (_) {}
    },

    showApp() {
      const landing = document.getElementById('marketing-landing');
      const appShell = document.getElementById('app-shell');
      const orbs = document.querySelectorAll('.ambient-orb');

      if (landing) {
        landing.classList.add('is-hidden');
        landing.style.display = 'none';
      }
      if (appShell) {
        appShell.classList.remove('is-hidden');
        appShell.style.display = 'flex';
      }
      document.body.classList.remove('view-landing');
      document.body.classList.add('view-app');
      orbs.forEach(orb => { orb.style.display = ''; });

      try {
        if (window.history && typeof window.history.replaceState === 'function') {
          const url = new URL(window.location.href);
          url.searchParams.set('app', '1');
          url.searchParams.delete('view');
          window.history.replaceState({}, '', url.toString());
        }
      } catch (_) {}
    },

    enterApp(question = '') {
      this.showApp();
      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (question && question.trim()) {
        const queryText = question.trim();
        setTimeout(() => {
          if (typeof window.handleUserInteraction === 'function') {
            window.handleUserInteraction(queryText);
          } else {
            const chatInput = document.getElementById('chat-input');
            const chatSendBtn = document.getElementById('btn-chat-send');
            if (chatInput && chatSendBtn) {
              chatInput.value = queryText;
              chatSendBtn.click();
            }
          }
        }, 200);
      }
    }
  };

  window.LandingPage = LandingPage;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => LandingPage.init());
    } else {
      LandingPage.init();
    }
  }
})(typeof window !== 'undefined' ? window : this);
