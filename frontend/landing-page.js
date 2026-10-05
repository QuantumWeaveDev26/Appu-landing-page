/**
 * APPU Marketing Landing Page Controller
 * Handles view transitions between marketing landing and app shell,
 * language switching, speech recognition input, and anonymous question handoff.
 */
(function(root) {
  'use strict';

  function getWin() {
    if (typeof window !== 'undefined') return window;
    if (typeof globalThis !== 'undefined' && globalThis.window) return globalThis.window;
    if (typeof globalThis !== 'undefined') return globalThis;
    return root || {};
  }

  const LANDING_TRANSLATIONS = {
    en: {
      landingBrandBy: '— by IGr Academy',
      landingLangAria: 'Choose language',
      landingLangCurrent: 'English',
      landingBtnSignin: 'Sign in',
      landingKicker: 'HYPER-PERSONALISED LEARNING',
      landingHeroTitleHtml: 'Every student is different. <br><span class="landing-hero-highlight">Learning should be too.</span>',
      landingHeroSubtext: 'Meet APPU, your AI mentor for academic excellence.',
      landingGradeBadge: 'Class 5 onwards',
      landingBtnTryFree: 'Try APPU free',
      landingCtaSub: 'No sign-up needed to try',
      landingSpeechBubble: '"Let\'s learn your way."',
      landingMascotSpeech: "Hi! Let's learn 🚀",
      landingMascotEncourage: "Ready when you are! 🚀",
      landingMentorRole: 'Your AI learning mentor',
      landingMentorAlt: 'APPU — Your AI learning mentor',
      landingValue1: 'Understand clearly',
      landingValue2: 'Practise confidently',
      landingValue3: 'Learn at your pace',
      landingQuestionTitle: 'Start with one question.',
      landingQuestionSubtitle: 'Ask anything from your school textbook or curiosity.',
      landingQuestionPlaceholder: 'What would you like to understand?',
      landingQuestionHelper: 'Type or speak in English, Kannada or Hindi',
      landingPromptLabel: 'Try asking:',
      landingChip1Text: 'Why is the sky blue?',
      landingChip1Prompt: 'Why is the sky blue?',
      landingChip2Text: 'How does photosynthesis work?',
      landingChip2Prompt: 'How does photosynthesis work?',
      landingChip3Text: 'Explain Pythagoras theorem',
      landingChip3Prompt: 'Explain Pythagoras theorem with an example',
      landingChip4Text: 'What causes seasons?',
      landingChip4Prompt: 'What causes seasons on Earth?',
      landingMicAria: 'Speak your question',
      landingSendAria: 'Ask Appu',
      landingAdvantageKicker: 'THE APPU ADVANTAGE',
      landingAdvantageTitle: 'How Appu transforms your study hours',
      landingFeature1Title: 'Visual Concept Trees & Mind Maps',
      landingFeature1Desc: 'Every answer generates structured diagrams and concept branches so you comprehend the foundation instead of rote-memorizing.',
      landingFeature2Title: 'Multilingual AI Voice Companion',
      landingFeature2Desc: 'Speak naturally in English, ಕನ್ನಡ, or हिंदी. Appu speaks back with clear audio explanations and live subtitle pacing.',
      landingFeature3Title: 'Curriculum-Safe & Parent Verified',
      landingFeature3Desc: '100% kid-safe guardrails aligned with NCERT/CBSE standards. Parents get real-time learning insights and WhatsApp progress updates.',
      landingFooterCopy: '© 2026 IGR Academy • All rights reserved',
      landingFooterPrivacy: 'Privacy Policy',
      landingFooterTerms: 'Terms & Conditions',
      landingFooterPricing: 'Pricing',
      landingFooterContact: 'Contact Us',
      voiceListeningPlaceholder: 'Listening... Speak now'
    },
    kn: {
      landingBrandBy: '— IGr ಅಕಾಡೆಮಿಯಿಂದ',
      landingLangAria: 'ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
      landingLangCurrent: 'ಕನ್ನಡ',
      landingBtnSignin: 'ಸೈನ್ ಇನ್',
      landingKicker: 'ಅತ್ಯಂತ ವೈಯಕ್ತಿಕಗೊಳಿಸಿದ ಕಲಿಕೆ',
      landingHeroTitleHtml: 'ಪ್ರತಿಯೊಬ್ಬ ವಿದ್ಯಾರ್ಥಿಯೂ ವಿಭಿನ್ನ. <br><span class="landing-hero-highlight">ಕಲಿಕೆಯೂ ವಿಭಿನ್ನವಾಗಿರಬೇಕು.</span>',
      landingHeroSubtext: 'ಶೈಕ್ಷಣಿಕ ಶ್ರೇಷ್ಠತೆಗಾಗಿ ನಿಮ್ಮ ಎಐ ಮಾರ್ಗದರ್ಶಕ ಅಪ್ಪುವನ್ನು ಭೇಟಿ ಮಾಡಿ.',
      landingGradeBadge: '5ನೇ ತರಗತಿಯಿಂದ ಮುಂದಕ್ಕೆ',
      landingBtnTryFree: 'ಅಪ್ಪುವನ್ನು ಉಚಿತವಾಗಿ ಪ್ರಯತ್ನಿಸಿ',
      landingCtaSub: 'ಪ್ರಯತ್ನಿಸಲು ಸೈನ್-ಅಪ್ ಅಗತ್ಯವಿಲ್ಲ',
      landingSpeechBubble: '"ನಿಮ್ಮ ರೀತಿಯಲ್ಲಿ ಕಲಿಯೋಣ."',
      landingMascotSpeech: 'ನಮಸ್ಕಾರ! ಕಲಿಯೋಣ 🚀',
      landingMascotEncourage: 'ನೀವು ಸಿದ್ಧರಿದ್ದಾಗ ಪ್ರಾರಂಭಿಸೋಣ! 🚀',
      landingMentorRole: 'ನಿಮ್ಮ ಎಐ ಕಲಿಕಾ ಮಾರ್ಗದರ್ಶಕ',
      landingMentorAlt: 'ಅಪ್ಪು — ನಿಮ್ಮ ಎಐ ಕಲಿಕಾ ಮಾರ್ಗದರ್ಶಕ',
      landingValue1: 'ಸ್ಪಷ್ಟವಾಗಿ ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ',
      landingValue2: 'ಆತ್ಮವಿಶ್ವಾಸದಿಂದ ಅಭ್ಯಾಸ ಮಾಡಿ',
      landingValue3: 'ನಿಮ್ಮ ವೇಗದಲ್ಲಿ ಕಲಿಯಿರಿ',
      landingQuestionTitle: 'ಒಂದು ಪ್ರಶ್ನೆಯೊಂದಿಗೆ ಪ್ರಾರಂಭಿಸಿ.',
      landingQuestionSubtitle: 'ನಿಮ್ಮ ಶಾಲಾ ಪಠ್ಯಪುಸ್ತಕದಿಂದ ಅಥವಾ ನಿಮ್ಮ ಕುತೂಹಲದಿಂದ ಏನನ್ನಾದರೂ ಕೇಳಿ.',
      landingQuestionPlaceholder: 'ನೀವು ಏನನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಬಯಸುತ್ತೀರಿ?',
      landingQuestionHelper: 'ಇಂಗ್ಲಿಷ್, ಕನ್ನಡ ಅಥವಾ ಹಿಂದಿಯಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ ಅಥವಾ ಮಾತನಾಡಿ',
      landingPromptLabel: 'ಹೀಗೆ ಕೇಳಿ ನೋಡಿ:',
      landingChip1Text: 'ಆಕಾಶ ಏಕೆ ನೀಲಿಯಾಗಿದೆ?',
      landingChip1Prompt: 'ಆಕಾಶ ಏಕೆ ನೀಲಿಯಾಗಿದೆ?',
      landingChip2Text: 'ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ?',
      landingChip2Prompt: 'ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ?',
      landingChip3Text: 'ಪೈಥಾಗೊರಸ್ ಪ್ರಮೇಯವನ್ನು ವಿವರಿಸಿ',
      landingChip3Prompt: 'ಉದಾಹರಣೆಯೊಂದಿಗೆ ಪೈಥಾಗೊರಸ್ ಪ್ರಮೇಯವನ್ನು ವಿವರಿಸಿ',
      landingChip4Text: 'ಋತುಗಳು ಹೇಗೆ ಬದಲಾಗುತ್ತವೆ?',
      landingChip4Prompt: 'ಭೂಮಿಯ ಮೇಲೆ ಋತುಗಳು ಹೇಗೆ ಬದಲಾಗುತ್ತವೆ?',
      landingMicAria: 'ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಮಾತನಾಡಿ',
      landingSendAria: 'ಅಪ್ಪುವನ್ನು ಕೇಳಿ',
      landingAdvantageKicker: 'ಅಪ್ಪು ವಿಶೇಷತೆ',
      landingAdvantageTitle: 'ಅಪ್ಪು ನಿಮ್ಮ ಅಧ್ಯಯನದ ಸಮಯವನ್ನು ಹೇಗೆ ಪರಿವರ್ತಿಸುತ್ತದೆ',
      landingFeature1Title: 'ದೃಶ್ಯ ಪರಿಕಲ್ಪನಾ ನಕ್ಷೆಗಳು & ಮೈಂಡ್ ಮ್ಯಾಪ್‌ಗಳು',
      landingFeature1Desc: 'ಪ್ರತಿಯೊಂದು ಉತ್ತರವೂ ರಚನಾತ್ಮಕ ರೇಖಾಚಿತ್ರಗಳು ಮತ್ತು ಪರಿಕಲ್ಪನೆಗಳ ಕವಲುಗಳನ್ನು ನೀಡುತ್ತದೆ, ಇದರಿಂದ ನೀವು ಕಂಠಪಾಠ ಮಾಡುವ ಬದಲು ಮೂಲ ಪರಿಕಲ್ಪನೆಯನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳುತ್ತೀರಿ.',
      landingFeature2Title: 'ಬಹುಭಾಷಾ ಎಐ ಧ್ವನಿ ಸಂಗಾತಿ',
      landingFeature2Desc: 'ಇಂಗ್ಲಿಷ್, ಕನ್ನಡ ಅಥವಾ ಹಿಂದಿಯಲ್ಲಿ ಸಹಜವಾಗಿ ಮಾತನಾಡಿ. ಅಪ್ಪು ಸ್ಪಷ್ಟ ಆಡಿಯೋ ವಿವರಣೆಗಳು ಮತ್ತು ನೇರ ಉಪಶೀರ್ಷಿಕೆಗಳೊಂದಿಗೆ ಉತ್ತರಿಸುತ್ತಾನೆ.',
      landingFeature3Title: 'ಪಠ್ಯಕ್ರಮಕ್ಕೆ ಸುರಕ್ಷಿತ & ಪೋಷಕರಿಂದ ಪರಿಶೀಲಿಸಲ್ಪಟ್ಟಿದೆ',
      landingFeature3Desc: 'NCERT/CBSE ಮಾನದಂಡಗಳಿಗೆ ಅನುಗುಣವಾಗಿ 100% ಮಕ್ಕಳಿಗೆ ಸುರಕ್ಷಿತ. ಪೋಷಕರು ನೈಜ-ಸಮಯದ ಕಲಿಕಾ ಒಳನೋಟಗಳು ಮತ್ತು WhatsApp ಪ್ರಗತಿ ವರದಿಗಳನ್ನು ಪಡೆಯುತ್ತಾರೆ.',
      landingFooterCopy: '© 2026 IGR Academy • ಎಲ್ಲ ಹಕ್ಕುಗಳನ್ನು ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ',
      landingFooterPrivacy: 'ಗೌಪ್ಯತಾ ನೀತಿ',
      landingFooterTerms: 'ನಿಯಮಗಳು ಮತ್ತು ಷರತ್ತುಗಳು',
      landingFooterPricing: 'ದರ ವಿವರ',
      landingFooterContact: 'ನಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಿ',
      voiceListeningPlaceholder: 'ಆಲಿಸಲಾಗುತ್ತಿದೆ... ಈಗ ಮಾತನಾಡಿ'
    },
    hi: {
      landingBrandBy: '— IGr अकादमी द्वारा',
      landingLangAria: 'भाषा चुनें',
      landingLangCurrent: 'हिंदी',
      landingBtnSignin: 'साइन इन',
      landingKicker: 'अति-व्यक्तिगत शिक्षण',
      landingHeroTitleHtml: 'हर छात्र अलग होता है। <br><span class="landing-hero-highlight">सीखने का तरीका भी अलग होना चाहिए।</span>',
      landingHeroSubtext: 'शैक्षणिक उत्कृष्टता के लिए अपने एआई मेंटर अप्पू से मिलें।',
      landingGradeBadge: 'कक्षा 5 से आगे',
      landingBtnTryFree: 'अप्पू को मुफ़्त आज़माएं',
      landingCtaSub: 'आज़माने के लिए साइन-अप की ज़रूरत नहीं',
      landingSpeechBubble: '"आइए आपके तरीके से सीखें।"',
      landingMascotSpeech: 'नमस्ते! चलिए सीखें 🚀',
      landingMascotEncourage: 'जब आप तैयार हों, तब शुरू करें! 🚀',
      landingMentorRole: 'आपका एआई लर्निंग मेंटर',
      landingMentorAlt: 'अप्पू — आपका एआई लर्निंग मेंटर',
      landingValue1: 'स्पष्ट रूप से समझें',
      landingValue2: 'आत्मविश्वास से अभ्यास करें',
      landingValue3: 'अपनी गति से सीखें',
      landingQuestionTitle: 'एक प्रश्न से शुरुआत करें।',
      landingQuestionSubtitle: 'अपनी स्कूल की पाठ्यपुस्तक से या अपनी जिज्ञासा से कुछ भी पूछें।',
      landingQuestionPlaceholder: 'आप क्या समझना चाहते हैं?',
      landingQuestionHelper: 'अंग्रेज़ी, कन्नड़ या हिंदी में टाइप करें या बोलें',
      landingPromptLabel: 'यह पूछकर देखें:',
      landingChip1Text: 'आसमान नीला क्यों है?',
      landingChip1Prompt: 'आसमान नीला क्यों होता है?',
      landingChip2Text: 'प्रकाश संश्लेषण कैसे काम करता है?',
      landingChip2Prompt: 'प्रकाश संश्लेषण कैसे काम करता है?',
      landingChip3Text: 'पाइथागोरस प्रमेय समझाएं',
      landingChip3Prompt: 'उदाहरण के साथ पाइथागोरस प्रमेय समझाएं',
      landingChip4Text: 'ऋतुएं कैसे बदलती हैं?',
      landingChip4Prompt: 'पृथ्वी पर मौसम या ऋतुएं कैसे बदलती हैं?',
      landingMicAria: 'अपना प्रश्न बोलें',
      landingSendAria: 'अप्पू से पूछें',
      landingAdvantageKicker: 'अप्पू की विशेषताएं',
      landingAdvantageTitle: 'अप्पू आपकी पढ़ाई के समय को कैसे बेहतर बनाता है',
      landingFeature1Title: 'दृश्य कॉन्सेप्ट ट्री और माइंड मैप',
      landingFeature1Desc: 'प्रत्येक उत्तर संरचित रेखाचित्र और अवधारणा शाखाएं उत्पन्न करता है ताकि आप रटने के बजाय बुनियादी समझ विकसित कर सकें।',
      landingFeature2Title: 'बहुभाषी एआई वॉइस साथी',
      landingFeature2Desc: 'अंग्रेज़ी, ಕನ್ನಡ या हिंदी में स्वाभाविक रूप से बोलें। अप्पू स्पष्ट ऑडियो विवरण और लाइव सबटाइटल के साथ उत्तर देता है।',
      landingFeature3Title: 'पाठ्यक्रम-सुरक्षित और अभिभावक-सत्यापित',
      landingFeature3Desc: 'NCERT/CBSE मानकों के अनुरूप 100% बच्चों के लिए सुरक्षित। अभिभावकों को वास्तविक समय में सीखने की प्रगति और WhatsApp अपडेट मिलते हैं।',
      landingFooterCopy: '© 2026 IGR Academy • सर्वाधिकार सुरक्षित',
      landingFooterPrivacy: 'गोपनीयता नीति',
      landingFooterTerms: 'नियम और शर्तें',
      landingFooterPricing: 'मूल्य निर्धारण',
      landingFooterContact: 'संपर्क करें',
      voiceListeningPlaceholder: 'सुन रहे हैं... अब बोलें'
    }
  };

  const LandingPage = {
    currentLang: 'en',
    recognition: null,
    isListening: false,
    initialized: false,
    translations: LANDING_TRANSLATIONS,

    init() {
      if (this.initialized) return;
      this.initialized = true;

      const win = getWin();
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
      const urlParams = new URLSearchParams(win.location ? win.location.search : '');
      const viewParam = urlParams.get('view');
      const appParam = urlParams.get('app');
      const hash = win.location ? win.location.hash : '';

      if (viewParam === 'app' || appParam === '1' || hash === '#app') {
        this.showApp();
      } else {
        this.showLanding();
      }

      // Check stored language and apply initial translations
      let savedLang = 'en';
      try {
        savedLang = urlParams.get('lang') ||
                    (win.localStorage ? (win.localStorage.getItem('appu_lang') || win.localStorage.getItem('appu_language')) : null) ||
                    (win.app && win.app.currentLang) || 'en';
      } catch (_) {}
      if (savedLang && (savedLang === 'kn' || savedLang === 'hi' || savedLang === 'en')) {
        this.setLanguage(savedLang, false);
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

      // "Sign in" Header CTA -> reveal app shell and open parent setup/auth modal
      if (btnSignIn) {
        btnSignIn.addEventListener('click', () => {
          this.showApp();
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

      this.initHeroMotionCraft();
    },

    initHeroMotionCraft() {
      const win = getWin();
      if (typeof document === 'undefined') return;

      const prefersReduced = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const revealElements = document.querySelectorAll('.landing-scroll-reveal');

      // 1. Tasteful Scroll Reveal (Observer)
      if (revealElements.length > 0) {
        if (prefersReduced || !('IntersectionObserver' in win)) {
          revealElements.forEach(el => el.classList.add('is-revealed'));
        } else {
          try {
            const observer = new IntersectionObserver((entries, obs) => {
              entries.forEach(entry => {
                if (entry.isIntersecting) {
                  entry.target.classList.add('is-revealed');
                  obs.unobserve(entry.target);
                }
              });
            }, {
              threshold: 0.12,
              rootMargin: '0px 0px -30px 0px'
            });
            revealElements.forEach(el => observer.observe(el));
          } catch (_) {
            revealElements.forEach(el => el.classList.add('is-revealed'));
          }
        }
      }

      const mascot = document.getElementById('landing-mascot-companion');
      const mascotArm = document.getElementById('mascot-arm-right-group');
      const mascotFace = document.getElementById('mascot-face-expr');
      const mascotSpeech = document.getElementById('landing-mascot-speech-text');
      const btnTryFree = document.getElementById('landing-btn-try-free');
      const mentorCard = document.getElementById('landing-mentor-card');
      const cardGlare = document.getElementById('landing-card-glare');
      const hero = document.querySelector('.landing-hero');
      const depthElements = document.querySelectorAll('#landing-depth-field [data-depth]');

      // 2. Mascot Interactive CTA Hover (Hop, wave & encourage speech swap)
      if (btnTryFree && mascot) {
        const handleCtaEnter = () => {
          mascot.classList.add('is-hopping');
          if (mascotArm) mascotArm.classList.add('is-waving');
          if (mascotSpeech) {
            const dict = this.translations[this.currentLang] || this.translations.en;
            if (dict && dict.landingMascotEncourage) {
              mascotSpeech.textContent = dict.landingMascotEncourage;
            }
          }
        };

        const handleCtaLeave = () => {
          mascot.classList.remove('is-hopping');
          if (mascotArm) mascotArm.classList.remove('is-waving');
          if (mascotSpeech) {
            const dict = this.translations[this.currentLang] || this.translations.en;
            if (dict && dict.landingMascotSpeech) {
              mascotSpeech.textContent = dict.landingMascotSpeech;
            }
          }
        };

        btnTryFree.addEventListener('mouseenter', handleCtaEnter);
        btnTryFree.addEventListener('mouseleave', handleCtaLeave);
        btnTryFree.addEventListener('focus', handleCtaEnter);
        btnTryFree.addEventListener('blur', handleCtaLeave);

        // Mascot itself can also be tapped/hovered playfully
        mascot.addEventListener('mouseenter', handleCtaEnter);
        mascot.addEventListener('mouseleave', handleCtaLeave);
      }

      // If reduced motion is requested, stop here (no tilt or parallax listeners)
      if (prefersReduced) return;

      // 3. Mascot Natural Blink Cycle (every ~4-6 seconds)
      const scheduleBlink = () => {
        const delay = 4000 + Math.random() * 2000;
        setTimeout(() => {
          if (mascotFace && !mascotFace.classList.contains('is-blinking')) {
            mascotFace.classList.add('is-blinking');
            setTimeout(() => {
              if (mascotFace) mascotFace.classList.remove('is-blinking');
              scheduleBlink();
            }, 180);
          } else {
            scheduleBlink();
          }
        }, delay);
      };
      scheduleBlink();

      // 4. Cursor-Aware Depth Parallax, 3D Card Tilt, Sheen Glare & Pupil Tracking
      if (hero) {
        let rafId = null;
        let mouseX = 0;
        let mouseY = 0;

        const updateFrame = () => {
          rafId = null;
          if (!hero) return;
          const rect = hero.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;

          // Normalized coordinates (-1 to 1)
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const normX = Math.max(-1, Math.min(1, (mouseX - centerX) / (rect.width / 2)));
          const normY = Math.max(-1, Math.min(1, (mouseY - centerY) / (rect.height / 2)));

          // A) Depth Orbs & Vector Glyphs Parallax
          if (depthElements && depthElements.length > 0) {
            depthElements.forEach(el => {
              const depth = parseFloat(el.getAttribute('data-depth')) || 0.05;
              const px = normX * depth * 220;
              const py = normY * depth * 220;
              el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
            });
          }

          // B) 3D Tilt on Mentor Card (capped at ~6deg) & Glare Sheen
          if (mentorCard && (win.innerWidth || 1024) > 768) {
            const rotX = -normY * 6; // pointer up tilts card up
            const rotY = normX * 6;  // pointer right tilts card right
            mentorCard.style.transform = `rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
            mentorCard.classList.add('is-tilted');

            if (cardGlare) {
              const cardRect = mentorCard.getBoundingClientRect();
              if (cardRect.width > 0 && cardRect.height > 0) {
                const glareX = Math.max(0, Math.min(100, ((mouseX - cardRect.left) / cardRect.width) * 100));
                const glareY = Math.max(0, Math.min(100, ((mouseY - cardRect.top) / cardRect.height) * 100));
                cardGlare.style.background = `radial-gradient(circle at ${glareX.toFixed(1)}% ${glareY.toFixed(1)}%, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0) 65%)`;
              }
            }
          }

          // C) Mascot Pupil Tracking (moves slightly towards cursor)
          if (mascot && mascotFace) {
            const mRect = mascot.getBoundingClientRect();
            const mCenterX = mRect.left + mRect.width / 2;
            const mCenterY = mRect.top + mRect.height / 2;
            const dx = mouseX - mCenterX;
            const dy = mouseY - mCenterY;
            const dist = Math.hypot(dx, dy) || 1;
            const maxShift = 2.4; // px
            const pupilX = (dx / dist) * Math.min(maxShift, Math.abs(dx) * 0.04);
            const pupilY = (dy / dist) * Math.min(maxShift, Math.abs(dy) * 0.04);
            mascotFace.style.transform = `translate(${pupilX.toFixed(1)}px, ${pupilY.toFixed(1)}px)`;
          }
        };

        const onPointerMove = (e) => {
          mouseX = e.clientX;
          mouseY = e.clientY;
          if (!rafId && win.requestAnimationFrame) {
            rafId = win.requestAnimationFrame(updateFrame);
          }
        };

        const onPointerLeave = () => {
          if (rafId && win.cancelAnimationFrame) {
            win.cancelAnimationFrame(rafId);
            rafId = null;
          }
          // Smooth return to resting state
          if (depthElements && depthElements.length > 0) {
            depthElements.forEach(el => {
              el.style.transform = 'translate3d(0, 0, 0)';
            });
          }
          if (mentorCard) {
            mentorCard.style.transform = 'rotateX(0deg) rotateY(0deg)';
            mentorCard.classList.remove('is-tilted');
          }
          if (mascotFace) {
            mascotFace.style.transform = 'translate(0, 0)';
          }
        };

        hero.addEventListener('pointermove', onPointerMove, { passive: true });
        hero.addEventListener('pointerleave', onPointerLeave);
      }
    },

    setLanguage(lang, syncApp = true) {
      if (!lang || !['en', 'kn', 'hi'].includes(lang)) lang = 'en';
      this.currentLang = lang;
      const langLabels = { en: 'English', kn: 'ಕನ್ನಡ', hi: 'हिंदी' };
      const currentLabelEl = document.getElementById('landing-lang-current');
      if (currentLabelEl) {
        currentLabelEl.textContent = langLabels[lang] || 'English';
      }

      const langMenu = document.getElementById('landing-lang-menu');
      if (langMenu && typeof langMenu.querySelectorAll === 'function') {
        langMenu.querySelectorAll('li[data-lang]').forEach(li => {
          const isMatch = li.getAttribute('data-lang') === lang;
          li.classList.toggle('is-selected', isMatch);
          li.setAttribute('aria-selected', String(isMatch));
        });
      }

      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('appu_lang', lang);
          localStorage.setItem('appu_language', lang);
        }
      } catch (_) {}

      this.applyTranslations(lang);

      // Propagate language to existing app if loaded
      const win = getWin();
      if (syncApp && win.app && typeof win.app.setLanguage === 'function') {
        if (win.app.currentLang !== lang) {
          win.app.setLanguage(lang);
        }
      }
    },

    applyTranslations(lang) {
      const win = getWin();
      const t = (win.UI_TRANSLATIONS && win.UI_TRANSLATIONS[lang]) || this.translations[lang] || this.translations.en;
      if (!t || typeof document === 'undefined') return;

      const currentLabelEl = document.getElementById('landing-lang-current');
      if (currentLabelEl) {
        currentLabelEl.textContent = t.landingLangCurrent || (lang === 'kn' ? 'ಕನ್ನಡ' : (lang === 'hi' ? 'हिंदी' : 'English'));
      }

      if (typeof document.querySelectorAll === 'function') {
        document.querySelectorAll('[data-i18n]').forEach((el) => {
          const key = el.getAttribute('data-i18n');
          if (key && t[key] !== undefined) {
            el.textContent = t[key];
          }
        });

        document.querySelectorAll('[data-i18n-html]').forEach((el) => {
          const key = el.getAttribute('data-i18n-html');
          if (key && t[key] !== undefined) {
            el.innerHTML = t[key];
          }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
          const key = el.getAttribute('data-i18n-placeholder');
          if (key && t[key] !== undefined) {
            el.placeholder = t[key];
          }
        });

        document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
          const key = el.getAttribute('data-i18n-aria-label');
          if (key && t[key] !== undefined) {
            el.setAttribute('aria-label', t[key]);
          }
        });

        document.querySelectorAll('[data-i18n-title]').forEach((el) => {
          const key = el.getAttribute('data-i18n-title');
          if (key && t[key] !== undefined) {
            el.setAttribute('title', t[key]);
          }
        });

        document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
          const key = el.getAttribute('data-i18n-alt');
          if (key && t[key] !== undefined) {
            el.setAttribute('alt', t[key]);
          }
        });

        document.querySelectorAll('[data-i18n-question]').forEach((el) => {
          const key = el.getAttribute('data-i18n-question');
          if (key && t[key] !== undefined) {
            el.setAttribute('data-question', t[key]);
          }
        });
      }

      this.updateLanguageCopy(lang);
    },

    updateLanguageCopy(lang) {
      if (typeof document === 'undefined') return;
      const helper = document.querySelector('.landing-question-helper span');
      const speech = document.querySelector('.landing-speech-bubble span');
      const input = document.getElementById('landing-question-input');

      if (lang === 'kn') {
        if (helper) helper.textContent = 'ಇಂಗ್ಲಿಷ್, ಕನ್ನಡ ಅಥವಾ ಹಿಂದಿಯಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ ಅಥವಾ ಮಾತನಾಡಿ';
        if (speech) speech.textContent = '"ನಿಮ್ಮ ರೀತಿಯಲ್ಲಿ ಕಲಿಯೋಣ."';
        if (input) {
          input.placeholder = 'ನೀವು ಏನನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಬಯಸುತ್ತೀರಿ?';
          input.setAttribute('aria-label', 'ನೀವು ಏನನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಬಯಸುತ್ತೀರಿ?');
        }
      } else if (lang === 'hi') {
        if (helper) helper.textContent = 'अंग्रेज़ी, कन्नड़ या हिंदी में टाइप करें या बोलें';
        if (speech) speech.textContent = '"आइए आपके तरीके से सीखें।"';
        if (input) {
          input.placeholder = 'आप क्या समझना चाहते हैं?';
          input.setAttribute('aria-label', 'आप क्या समझना चाहते हैं?');
        }
      } else {
        if (helper) helper.textContent = 'Type or speak in English, Kannada or Hindi';
        if (speech) speech.textContent = '"Let\'s learn your way."';
        if (input) {
          input.placeholder = 'What would you like to understand?';
          input.setAttribute('aria-label', 'What would you like to understand?');
        }
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
          const win = getWin();
          const t = (win.UI_TRANSLATIONS && win.UI_TRANSLATIONS[this.currentLang]) || this.translations[this.currentLang] || this.translations.en;
          if (input) input.placeholder = t.voiceListeningPlaceholder || 'Listening... Speak now';
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
            const win = getWin();
            const t = (win.UI_TRANSLATIONS && win.UI_TRANSLATIONS[this.currentLang]) || this.translations[this.currentLang] || this.translations.en;
            if (input) input.placeholder = t.landingQuestionPlaceholder || 'What would you like to understand?';
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
      const win = getWin();
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
      if (document.body) {
        document.body.classList.remove('view-app');
        document.body.classList.add('view-landing');
      }
      orbs.forEach(orb => { orb.style.display = 'none'; });

      try {
        if (win.history && typeof win.history.replaceState === 'function' && win.location) {
          const url = new URL(win.location.href);
          url.searchParams.delete('app');
          url.searchParams.set('view', 'landing');
          url.hash = '';
          win.history.replaceState({}, '', url.toString());
        }
      } catch (_) {}
    },

    showApp() {
      const win = getWin();
      const landing = document.getElementById('marketing-landing');
      const appShell = document.getElementById('app-shell');
      const orbs = document.querySelectorAll('.ambient-orb');

      if (landing) {
        landing.classList.add('is-hidden');
        landing.style.display = 'none';
      }
      if (appShell) {
        appShell.classList.remove('is-hidden');
        appShell.style.display = '';
      }
      if (document.body) {
        document.body.classList.remove('view-landing');
        document.body.classList.add('view-app');
      }
      orbs.forEach(orb => { orb.style.display = ''; });

      try {
        if (win.history && typeof win.history.replaceState === 'function' && win.location) {
          const url = new URL(win.location.href);
          url.searchParams.set('app', '1');
          url.searchParams.delete('view');
          win.history.replaceState({}, '', url.toString());
        }
      } catch (_) {}

      // Re-layout and re-initialize stage and topbar components on reveal
      try {
        if (typeof win.dispatchEvent === 'function') {
          win.dispatchEvent(new Event('resize'));
        }
      } catch (_) {}

      if (typeof win.syncResponsiveSlots === 'function') {
        try { win.syncResponsiveSlots(); } catch (_) {}
      }

      const stage = win.avatarStage || (win.app && win.app.avatarStage);
      if (stage) {
        if (typeof stage.initTalkingAvatarDOM === 'function') {
          try { stage.initTalkingAvatarDOM(); } catch (_) {}
        }
        if (typeof stage.setState === 'function') {
          try { stage.setState(stage.currentState || 'idle'); } catch (_) {}
        }
      }

      if (win.appMascot && typeof win.appMascot.setMood === 'function') {
        try { win.appMascot.setMood('idle'); } catch (_) {}
      }
    },

    enterApp(question = '') {
      const win = getWin();
      this.showApp();
      if (typeof win.scrollTo === 'function') {
        try { win.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {}
      }

      if (question && question.trim()) {
        const queryText = question.trim();
        setTimeout(() => {
          if (typeof win.handleUserInteraction === 'function') {
            win.handleUserInteraction(queryText);
          } else if (win.app && typeof win.app.handleUserInteraction === 'function') {
            win.app.handleUserInteraction(queryText);
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

  getWin().LandingPage = LandingPage;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => LandingPage.init());
    } else {
      LandingPage.init();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LandingPage;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
