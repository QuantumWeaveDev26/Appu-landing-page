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
          this.enterApp('', btnTryFree);
        });
      }

      // "Start with one question" form submit
      if (questionForm) {
        questionForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const query = questionInput ? questionInput.value.trim() : '';
          this.enterApp(query, questionForm);
        });
      }

      // Starter prompt chips
      promptChips.forEach(chip => {
        chip.addEventListener('click', () => {
          const q = chip.getAttribute('data-question') || chip.textContent.trim();
          if (questionInput) questionInput.value = q;
          this.enterApp(q, chip);
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

    /**
     * Pro-Grade Physics Animation Engine driven by Motion (motion.dev)
     * Loaded via ESM on marketing landing only, with fail-safe no-FOUC architecture.
     */
    initMotionDev(Motion) {
      if (!Motion) return;
      this.motionDev = Motion;
      const win = getWin();
      if (typeof win !== 'undefined') win.__MotionDev = Motion;
      if (this.motionDevActive) return;
      if (typeof win.document === 'undefined') return;

      const prefersReduced = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) return;

      const hero = document.querySelector('.landing-hero');
      if (!hero) return;

      this.motionDevActive = true;
      const { animate, hover, press, inView, scroll, stagger, transform } = Motion;

      const safeMap = (val, inRange, outRange) => {
        if (typeof transform === 'function') {
          try {
            const res = transform(val, inRange, outRange);
            if (typeof res === 'number') return res;
            if (typeof res === 'function') return res(val);
          } catch (_) {}
        }
        const [inMin, inMax] = inRange;
        const [outMin, outMax] = outRange;
        const progress = (val - inMin) / (inMax - inMin);
        return outMin + progress * (outMax - outMin);
      };

      // 1. ENTRANCE CHOREOGRAPHY (Once on load with confident spring)
      // Sequence: kicker -> headline -> subtext -> badge -> CTA
      const copyElements = [
        document.querySelector('.landing-kicker'),
        document.querySelector('.landing-hero-title'),
        document.querySelector('.landing-hero-subtext'),
        document.querySelector('.landing-grade-badge'),
        document.querySelector('.landing-cta-group')
      ].filter(Boolean);

      if (copyElements.length > 0 && typeof animate === 'function') {
        const staggerFn = typeof stagger === 'function' ? stagger(0.07, { start: 0.04 }) : 0.08;
        animate(copyElements, {
          opacity: [0, 1],
          y: [18, 0]
        }, {
          delay: staggerFn,
          type: "spring",
          stiffness: 120,
          damping: 18
        });
      }

      // Headline clip-mask wipe upward
      const headline = document.querySelector('.landing-hero-title');
      if (headline && typeof animate === 'function') {
        animate(headline, {
          clipPath: ['inset(100% 0 0 0)', 'inset(0% 0 0 0)']
        }, {
          delay: 0.11,
          duration: 0.85,
          ease: [0.16, 1, 0.3, 1]
        });
      }

      // Highlight line gradient sweep
      const highlight = document.querySelector('.landing-hero-highlight');
      if (highlight && typeof animate === 'function') {
        animate(highlight, {
          backgroundPosition: ['100% 50%', '0% 50%']
        }, {
          delay: 0.25,
          duration: 1.8,
          ease: [0.16, 1, 0.3, 1]
        });
      }

      // Mentor Card scale/rise from .96 / translateY(16)
      const mentorCard = document.getElementById('landing-mentor-card');
      if (mentorCard && typeof animate === 'function') {
        animate(mentorCard, {
          opacity: [0, 1],
          scale: [0.96, 1],
          y: [16, 0]
        }, {
          delay: 0.16,
          type: "spring",
          stiffness: 115,
          damping: 18
        });
      }

      // Speech bubble pops in after
      const speechBubble = document.querySelector('.landing-speech-bubble');
      if (speechBubble && typeof animate === 'function') {
        animate(speechBubble, {
          opacity: [0, 1],
          scale: [0.9, 1],
          y: [10, 0]
        }, {
          delay: 0.42,
          type: "spring",
          stiffness: 140,
          damping: 16
        });
      }

      // Mascot powers on (antenna flare + eyes awake) and waves ONCE
      const antenna = document.getElementById('mascot-antenna-bulb');
      const mascotFace = document.getElementById('mascot-face-expr');
      const mascotArm = document.getElementById('mascot-arm-right-group');
      const mascot = document.getElementById('landing-mascot-companion');
      const mascotSpeech = document.getElementById('landing-mascot-speech-text');

      if (antenna && typeof animate === 'function') {
        animate(antenna, {
          opacity: [0.2, 1],
          scale: [0.8, 1.25, 1]
        }, {
          delay: 0.45,
          duration: 0.8
        });
      }

      if (mascotFace && typeof animate === 'function') {
        animate(mascotFace, {
          scaleY: [0.1, 1, 0.1, 1]
        }, {
          delay: 0.48,
          duration: 0.75,
          times: [0, 0.35, 0.55, 1]
        });
      }

      if (mascotArm && typeof animate === 'function') {
        animate(mascotArm, {
          rotate: [0, -32, 12, -24, 6, 0]
        }, {
          delay: 0.85,
          duration: 1.1,
          ease: [0.16, 1, 0.3, 1]
        });
      }

      // 2. CURSOR-AWARE HERO (rAF-throttled transform mapping & spring physics)
      const cardGlare = document.getElementById('landing-card-glare');
      const depthElements = document.querySelectorAll('#landing-depth-field [data-depth]');

      if (hero && typeof animate === 'function') {
        let rafId = null;
        let pointerX = 0;
        let pointerY = 0;

        const onPointerMove = (e) => {
          pointerX = e.clientX;
          pointerY = e.clientY;

          if (!rafId && win.requestAnimationFrame) {
            rafId = win.requestAnimationFrame(() => {
              rafId = null;
              const rect = hero.getBoundingClientRect();
              if (rect.width <= 0 || rect.height <= 0) return;

              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              const normX = Math.max(-1, Math.min(1, (pointerX - centerX) / (rect.width / 2)));
              const normY = Math.max(-1, Math.min(1, (pointerY - centerY) / (rect.height / 2)));

              // A) 3D Card Tilt (desktop only > 768px, cap 6deg) + glare sheen
              if (mentorCard && (win.innerWidth || 1024) > 768) {
                const rotX = safeMap(normY, [-1, 1], [6, -6]);
                const rotY = safeMap(normX, [-1, 1], [-6, 6]);

                animate(mentorCard, {
                  rotateX: rotX,
                  rotateY: rotY
                }, {
                  type: "spring",
                  stiffness: 150,
                  damping: 22
                });
                mentorCard.classList.add('is-tilted');

                if (cardGlare) {
                  const cardRect = mentorCard.getBoundingClientRect();
                  if (cardRect.width > 0 && cardRect.height > 0) {
                    const glareX = Math.max(0, Math.min(100, ((pointerX - cardRect.left) / cardRect.width) * 100));
                    const glareY = Math.max(0, Math.min(100, ((pointerY - cardRect.top) / cardRect.height) * 100));
                    cardGlare.style.background = `radial-gradient(circle at ${glareX.toFixed(1)}% ${glareY.toFixed(1)}%, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0) 65%)`;
                    cardGlare.style.opacity = '1';
                  }
                }
              }

              // B) Orbs & Glyphs Parallax Offsets with Motion springs
              if (depthElements && depthElements.length > 0) {
                depthElements.forEach(el => {
                  const depth = parseFloat(el.getAttribute('data-depth')) || 0.05;
                  const maxOffset = depth * 220;
                  const targetX = safeMap(normX, [-1, 1], [-maxOffset, maxOffset]);
                  const targetY = safeMap(normY, [-1, 1], [-maxOffset, maxOffset]);

                  animate(el, {
                    x: targetX,
                    y: targetY
                  }, {
                    type: "spring",
                    stiffness: 130,
                    damping: 20
                  });
                });
              }

              // C) Mascot Pupil Tracking via transform mapping and spring
              if (mascotFace) {
                const pupilX = safeMap(normX, [-1, 1], [-2.4, 2.4]);
                const pupilY = safeMap(normY, [-1, 1], [-2.4, 2.4]);
                animate(mascotFace, {
                  x: pupilX,
                  y: pupilY
                }, {
                  type: "spring",
                  stiffness: 180,
                  damping: 22
                });
              }
            });
          }
        };

        const onPointerLeave = () => {
          if (rafId && win.cancelAnimationFrame) {
            win.cancelAnimationFrame(rafId);
            rafId = null;
          }
          if (mentorCard) {
            animate(mentorCard, {
              rotateX: 0,
              rotateY: 0
            }, {
              type: "spring",
              stiffness: 140,
              damping: 20
            });
            mentorCard.classList.remove('is-tilted');
            if (cardGlare) cardGlare.style.opacity = '0';
          }
          if (mascotFace) {
            animate(mascotFace, {
              x: 0,
              y: 0
            }, {
              type: "spring",
              stiffness: 140,
              damping: 20
            });
          }
          if (depthElements && depthElements.length > 0) {
            depthElements.forEach(el => {
              animate(el, {
                x: 0,
                y: 0
              }, {
                type: "spring",
                stiffness: 120,
                damping: 20
              });
            });
          }
        };

        hero.addEventListener('pointermove', onPointerMove, { passive: true });
        hero.addEventListener('pointerleave', onPointerLeave);
      }

      // 3. LIVING GEOMETRIC & SCIENCE OBJECTS (Continuous float, drift, rotation, and sub-orbits)
      const sciObjects = document.querySelectorAll('.sci-obj');
      const activeLoops = [];

      if (sciObjects.length > 0 && typeof animate === 'function') {
        sciObjects.forEach((obj, idx) => {
          const inner = obj.querySelector('.sci-obj-inner') || obj;

          // Varied periods (14s to 28s) and directional offsets for organic, unsynchronized float
          const durations = [18, 22, 16, 26, 20, 24, 25, 19];
          const dur = durations[idx % durations.length];

          const yDeltas = [-14, -18, -12, -15, -13, -16, -11, -12];
          const xDeltas = [8, -10, 6, -7, 9, -8, 6, -6];
          const yOff = yDeltas[idx % yDeltas.length];
          const xOff = xDeltas[idx % xDeltas.length];

          const rotDeltas = [
            [-8, 12, -4, -8],
            [-6, 8, -6],
            [-10, 10, -10],
            [0, 180, 360],
            [-6, 12, -6],
            [-8, 8, -8],
            [-5, 8, -5],
            [-8, 6, -8]
          ];
          const rotAnim = rotDeltas[idx % rotDeltas.length];

          try {
            const floatLoop = animate(inner, {
              y: [0, yOff, -yOff * 0.6, 0],
              x: [0, xOff, -xOff * 0.5, 0],
              rotate: rotAnim
            }, {
              duration: dur,
              repeat: Infinity,
              ease: "easeInOut"
            });
            activeLoops.push(floatLoop);
          } catch (_) {}
        });

        // Sub-motion: Electron orbits in Rutherford atom
        const atomOrbits = [
          { sel: '.obj-atom .orbit-1', dur: 12, dir: [0, 360] },
          { sel: '.obj-atom .orbit-2', dur: 16, dir: [60, 420] },
          { sel: '.obj-atom .orbit-3', dur: 14, dir: [120, -240] }
        ];
        atomOrbits.forEach(cfg => {
          const el = document.querySelector(cfg.sel);
          if (el) {
            try {
              const loop = animate(el, {
                rotate: cfg.dir
              }, {
                duration: cfg.dur,
                repeat: Infinity,
                ease: "linear"
              });
              activeLoops.push(loop);
            } catch (_) {}
          }
        });

        // Sub-motion: Moon orbit around Saturnian planet
        const moonOrbit = document.querySelector('.obj-planet .planet-moon-orbit');
        if (moonOrbit) {
          try {
            const loop = animate(moonOrbit, {
              rotate: [0, 360]
            }, {
              duration: 15,
              repeat: Infinity,
              ease: "linear"
            });
            activeLoops.push(loop);
          } catch (_) {}
        }

        // Sub-motion: Concentric Gyroscope Rings
        const gyroMid = document.querySelector('.obj-torus .gyro-ring-mid');
        if (gyroMid) {
          try {
            const loop = animate(gyroMid, {
              rotate: [0, 360]
            }, {
              duration: 18,
              repeat: Infinity,
              ease: "linear"
            });
            activeLoops.push(loop);
          } catch (_) {}
        }
        const gyroInner = document.querySelector('.obj-torus .gyro-ring-inner');
        if (gyroInner) {
          try {
            const loop = animate(gyroInner, {
              rotate: [360, 0]
            }, {
              duration: 14,
              repeat: Infinity,
              ease: "linear"
            });
            activeLoops.push(loop);
          } catch (_) {}
        }

        // Pause all animation loops when hero section is offscreen
        if ('IntersectionObserver' in win && hero) {
          try {
            const heroObserver = new win.IntersectionObserver((entries) => {
              entries.forEach(entry => {
                if (entry.isIntersecting) {
                  activeLoops.forEach(l => {
                    try { if (l && typeof l.play === 'function') l.play(); } catch (_) {}
                  });
                } else {
                  activeLoops.forEach(l => {
                    try { if (l && typeof l.pause === 'function') l.pause(); } catch (_) {}
                  });
                }
              });
            }, { threshold: 0.05 });
            heroObserver.observe(hero);
          } catch (_) {}
        }
      }

      // 4. GESTURES: hover() and press()
      const btnTryFree = document.getElementById('landing-btn-try-free');
      const arrowIcon = btnTryFree ? btnTryFree.querySelector('i') : null;

      if (btnTryFree && typeof hover === 'function') {
        hover(btnTryFree, () => {
          animate(btnTryFree, {
            y: -2.5,
            boxShadow: "0 16px 32px -4px rgba(79, 70, 229, 0.48), 0 6px 16px -2px rgba(6, 182, 212, 0.32)"
          }, {
            type: "spring",
            stiffness: 300,
            damping: 20
          });
          if (arrowIcon) {
            animate(arrowIcon, { x: 3 }, { type: "spring", stiffness: 320, damping: 20 });
          }

          if (mascot) {
            animate(mascot, { y: -8, scale: 1.06 }, { type: "spring", stiffness: 260, damping: 18 });
            mascot.classList.add('is-hopping');
          }
          if (mascotArm) {
            mascotArm.classList.add('is-waving');
          }
          if (mascotSpeech) {
            const dict = this.translations[this.currentLang] || this.translations.en;
            if (dict && dict.landingMascotEncourage) {
              mascotSpeech.textContent = dict.landingMascotEncourage;
            }
          }

          return () => {
            animate(btnTryFree, {
              y: 0,
              boxShadow: "0 10px 24px -4px rgba(79, 70, 229, 0.36), 0 4px 10px -2px rgba(6, 182, 212, 0.24)"
            }, {
              type: "spring",
              stiffness: 380,
              damping: 26
            });
            if (arrowIcon) {
              animate(arrowIcon, { x: 0 }, { type: "spring", stiffness: 380, damping: 26 });
            }

            if (mascot) {
              animate(mascot, { y: 0, scale: 1 }, { type: "spring", stiffness: 320, damping: 22 });
              mascot.classList.remove('is-hopping');
            }
            if (mascotArm) {
              mascotArm.classList.remove('is-waving');
            }
            if (mascotSpeech) {
              const dict = this.translations[this.currentLang] || this.translations.en;
              if (dict && dict.landingMascotSpeech) {
                mascotSpeech.textContent = dict.landingMascotSpeech;
              }
            }
          };
        });

        if (typeof press === 'function') {
          press(btnTryFree, () => {
            animate(btnTryFree, { scale: 0.98 }, { type: "spring", stiffness: 500, damping: 25 });
            return () => {
              animate(btnTryFree, { scale: 1 }, { type: "spring", stiffness: 400, damping: 25 });
            };
          });
        }
      }

      // Prompt chips hover & press
      const promptChips = document.querySelectorAll('.landing-prompt-chip');
      if (promptChips.length > 0 && typeof hover === 'function') {
        promptChips.forEach(chip => {
          hover(chip, () => {
            animate(chip, {
              y: -2,
              boxShadow: "0 6px 16px rgba(14, 165, 233, 0.18)"
            }, {
              type: "spring",
              stiffness: 320,
              damping: 22
            });
            return () => {
              animate(chip, {
                y: 0,
                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.04)"
              }, {
                type: "spring",
                stiffness: 400,
                damping: 26
              });
            };
          });

          if (typeof press === 'function') {
            press(chip, () => {
              animate(chip, { scale: 0.98 }, { type: "spring", stiffness: 500, damping: 25 });
              return () => {
                animate(chip, { scale: 1 }, { type: "spring", stiffness: 420, damping: 25 });
              };
            });
          }
        });
      }

      // Feature cards hover
      const featureCards = document.querySelectorAll('.landing-feature-card');
      if (featureCards.length > 0 && typeof hover === 'function') {
        featureCards.forEach(card => {
          hover(card, () => {
            animate(card, {
              y: -3,
              boxShadow: "0 16px 32px -6px rgba(15, 23, 42, 0.1)"
            }, {
              type: "spring",
              stiffness: 280,
              damping: 22
            });
            return () => {
              animate(card, {
                y: 0,
                boxShadow: "0 8px 24px -5px rgba(15, 23, 42, 0.05)"
              }, {
                type: "spring",
                stiffness: 360,
                damping: 26
              });
            };
          });
        });
      }

      // 4. SCROLL REVEALS with inView()
      const valueBand = document.querySelector('.landing-value-band');
      if (valueBand && typeof inView === 'function') {
        inView(valueBand, () => {
          animate(valueBand, {
            opacity: [0, 1],
            y: [20, 0]
          }, {
            duration: 0.65,
            ease: [0.16, 1, 0.3, 1]
          });
        }, { amount: 0.15 });
      }

      const featuresGrid = document.querySelector('.landing-features-grid');
      if (featuresGrid && typeof inView === 'function') {
        const cards = featuresGrid.querySelectorAll('.landing-feature-card');
        if (cards.length > 0) {
          inView(featuresGrid, () => {
            const staggerCards = typeof stagger === 'function' ? stagger(0.1, { start: 0.05 }) : 0.1;
            animate(cards, {
              opacity: [0, 1],
              y: [22, 0]
            }, {
              delay: staggerCards,
              duration: 0.7,
              ease: [0.16, 1, 0.3, 1]
            });
          }, { amount: 0.15 });
        }
      }

      // 5. BLINK LOOP (paused when mascot is offscreen)
      if (mascot && mascotFace && typeof animate === 'function') {
        let mascotVisible = true;
        if ('IntersectionObserver' in win) {
          const heroObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              mascotVisible = entry.isIntersecting;
            });
          }, { threshold: 0.1 });
          heroObserver.observe(mascot);
        }

        const runBlink = () => {
          const delay = 4000 + Math.random() * 2000;
          setTimeout(() => {
            if (mascotVisible && mascotFace && !mascotFace.classList.contains('is-blinking')) {
              animate(mascotFace, {
                scaleY: [1, 0.1, 1]
              }, {
                duration: 0.22,
                times: [0, 0.5, 1],
                ease: "easeInOut"
              });
            }
            runBlink();
          }, delay);
        };
        runBlink();
      }
    },

    initHeroMotionCraft() {
      if (this.motionDevActive) return;
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
            this.enterApp(finalQuery, micBtn);
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

    dispatchUserInteraction(queryText) {
      const win = getWin();
      if (!queryText) return;
      if (typeof win.handleUserInteraction === 'function') {
        win.handleUserInteraction(queryText);
      } else if (win.app && typeof win.app.handleUserInteraction === 'function') {
        win.app.handleUserInteraction(queryText);
      } else if (typeof document !== 'undefined') {
        const chatInput = document.getElementById('chat-input');
        const chatSendBtn = document.getElementById('btn-chat-send');
        if (chatInput && chatSendBtn) {
          chatInput.value = queryText;
          chatSendBtn.click();
        }
      }
    },

    animateZoomCrossfade() {
      const win = getWin();
      const landing = document.getElementById('marketing-landing');
      const appShell = document.getElementById('app-shell');
      const orbs = document.querySelectorAll('.ambient-orb');

      if (!landing || !appShell) {
        this.showApp();
        if (typeof win.scrollTo === 'function') win.scrollTo({ top: 0, behavior: 'instant' });
        this.isTransitioning = false;
        return;
      }

      const scrollY = win.scrollY || win.pageYOffset || 0;
      document.body.classList.add('is-transitioning-to-app');

      landing.style.position = 'fixed';
      landing.style.top = `-${scrollY}px`;
      landing.style.left = '0';
      landing.style.width = '100%';
      landing.style.zIndex = '20';
      landing.style.pointerEvents = 'none';

      appShell.style.display = 'grid';
      appShell.style.position = 'fixed';
      appShell.style.inset = '0';
      appShell.style.width = '100vw';
      appShell.style.height = '100vh';
      appShell.style.zIndex = '10';
      appShell.style.opacity = '0';
      appShell.style.transform = 'scale(0.98)';
      appShell.style.pointerEvents = 'none';
      orbs.forEach(orb => { orb.style.display = ''; });

      let completed = false;
      const finish = () => {
        if (completed) return;
        completed = true;

        landing.style.position = '';
        landing.style.top = '';
        landing.style.left = '';
        landing.style.width = '';
        landing.style.zIndex = '';
        landing.style.pointerEvents = '';
        landing.style.opacity = '';
        landing.style.transform = '';

        appShell.style.position = '';
        appShell.style.inset = '';
        appShell.style.width = '';
        appShell.style.height = '';
        appShell.style.zIndex = '';
        appShell.style.pointerEvents = '';
        appShell.style.opacity = '';
        appShell.style.transform = '';

        document.body.classList.remove('is-transitioning-to-app');

        this.showApp();
        if (typeof win.scrollTo === 'function') win.scrollTo({ top: 0, behavior: 'instant' });
        this.isTransitioning = false;
      };

      const motionDev = this.motionDev || win.__MotionDev;
      if (motionDev && typeof motionDev.animate === 'function') {
        motionDev.animate(landing, {
          opacity: [1, 0],
          transform: ['scale(1) translateY(0px)', 'scale(0.96) translateY(-14px)']
        }, { duration: 0.38, ease: [0.16, 1, 0.3, 1] });

        motionDev.animate(appShell, {
          opacity: [0, 1],
          transform: ['scale(0.98)', 'scale(1)']
        }, { duration: 0.46, ease: [0.16, 1, 0.3, 1] }).then(finish);
      } else if (typeof landing.animate === 'function') {
        landing.animate([
          { opacity: 1, transform: 'scale(1) translateY(0px)' },
          { opacity: 0, transform: 'scale(0.96) translateY(-14px)' }
        ], { duration: 380, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });

        const anim = appShell.animate([
          { opacity: 0, transform: 'scale(0.98)' },
          { opacity: 1, transform: 'scale(1)' }
        ], { duration: 460, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });
        anim.onfinish = finish;
      } else {
        finish();
      }

      setTimeout(() => { if (!completed) finish(); }, 900);
    },

    animateFlightTransition(queryText, originEl = null) {
      const win = getWin();
      const landing = document.getElementById('marketing-landing');
      const appShell = document.getElementById('app-shell');
      const orbs = document.querySelectorAll('.ambient-orb');

      if (!landing || !appShell) {
        this.showApp();
        if (typeof win.scrollTo === 'function') win.scrollTo({ top: 0, behavior: 'instant' });
        this.dispatchUserInteraction(queryText);
        this.isTransitioning = false;
        return;
      }

      // 1. Identify source element for FLIP coordinates
      const sourceEl = originEl || 
        document.querySelector('.landing-input-wrap') || 
        document.getElementById('landing-question-input') || 
        document.getElementById('landing-question-form');
      
      const rawSourceRect = sourceEl ? sourceEl.getBoundingClientRect() : null;
      const sourceRect = (rawSourceRect && rawSourceRect.width > 0)
        ? rawSourceRect
        : { left: Math.max(16, (win.innerWidth - 360) / 2), top: win.innerHeight * 0.45, width: 360, height: 48 };

      const scrollY = win.scrollY || win.pageYOffset || (document.documentElement && document.documentElement.scrollTop) || 0;

      // 2. Layering swap setup: dark app shell fades/scales underneath landing
      document.body.classList.add('is-transitioning-to-app');

      landing.style.position = 'fixed';
      landing.style.top = `-${scrollY}px`;
      landing.style.left = '0';
      landing.style.width = '100%';
      landing.style.zIndex = '20';
      landing.style.pointerEvents = 'none';

      appShell.style.display = 'grid';
      appShell.style.position = 'fixed';
      appShell.style.inset = '0';
      appShell.style.width = '100vw';
      appShell.style.height = '100vh';
      appShell.style.zIndex = '10';
      appShell.style.opacity = '0';
      appShell.style.transform = 'scale(0.98)';
      appShell.style.pointerEvents = 'none';
      orbs.forEach(orb => { orb.style.display = ''; });

      // 3. Determine destination coordinates inside app shell
      const destEl = document.getElementById('subtitles-text') || 
                     document.getElementById('response-card') || 
                     document.querySelector('.response-card');
      const rawDestRect = destEl ? destEl.getBoundingClientRect() : null;

      // 4. Create floating clone styled like the app's user chat bubble
      const clone = document.createElement('div');
      clone.className = 'flight-chat-bubble';
      clone.setAttribute('aria-hidden', 'true');

      const iconSpan = document.createElement('span');
      iconSpan.className = 'flight-bubble-icon';
      iconSpan.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>';

      const textSpan = document.createElement('span');
      textSpan.className = 'flight-bubble-text';
      textSpan.textContent = queryText;

      clone.appendChild(iconSpan);
      clone.appendChild(textSpan);
      document.body.appendChild(clone);

      const cloneWidth = clone.offsetWidth || Math.min(sourceRect.width * 0.75, 380);
      const cloneHeight = clone.offsetHeight || 44;

      const startX = sourceRect.left + (sourceRect.width - cloneWidth) / 2;
      const startY = sourceRect.top + (sourceRect.height - cloneHeight) / 2;

      // Seed starting hardware transform immediately
      clone.style.transform = `translate3d(${startX}px, ${startY}px, 0) scale(1)`;
      clone.style.zIndex = '999999';

      let targetX = (rawDestRect && rawDestRect.width > 0)
        ? rawDestRect.left + Math.max(16, (rawDestRect.width - cloneWidth) / 2)
        : (win.innerWidth - cloneWidth) / 2;
      let targetY = (rawDestRect && rawDestRect.height > 0)
        ? rawDestRect.top + (rawDestRect.height - cloneHeight) / 2
        : win.innerHeight - 110;

      // Ensure target coordinates are well within viewport
      targetX = Math.max(16, Math.min(targetX, win.innerWidth - cloneWidth - 16));
      targetY = Math.max(60, Math.min(targetY, win.innerHeight - cloneHeight - 16));

      // Calculate gentle physical arc (lifting upward midflight, then sweeping down into response area)
      const deltaX = targetX - startX;
      const deltaY = targetY - startY;
      const arcLift = Math.max(26, Math.min(Math.abs(deltaY) * 0.16, 68));
      const midY = startY + deltaY * 0.42 - arcLift;
      const midX = startX + deltaX * 0.52 + (Math.abs(deltaX) > 40 ? 0 : 16);

      // Trail particles helper (dropping 6 subtle glowing stardust markers along flight arc)
      const trailTimeouts = [];
      const spawnTrailDot = (currX, currY) => {
        try {
          const dot = document.createElement('div');
          dot.className = 'flight-trail-particle';
          dot.style.transform = `translate3d(${currX + cloneWidth / 2}px, ${currY + cloneHeight / 2}px, 0)`;
          document.body.appendChild(dot);
          if (typeof dot.animate === 'function') {
            dot.animate([
              { opacity: 0.95, transform: `translate3d(${currX + cloneWidth / 2}px, ${currY + cloneHeight / 2}px, 0) scale(1.15)` },
              { opacity: 0, transform: `translate3d(${currX + cloneWidth / 2}px, ${currY + cloneHeight / 2 + 14}px, 0) scale(0.2)` }
            ], { duration: 420, fill: 'forwards' });
          }
          setTimeout(() => { if (dot.parentNode) dot.remove(); }, 460);
        } catch (_) {}
      };

      // Trail timing during flight phase (340ms to 1100ms)
      trailTimeouts.push(setTimeout(() => spawnTrailDot(startX, startY - 14), 320));
      trailTimeouts.push(setTimeout(() => spawnTrailDot(startX + (midX - startX) * 0.3, startY + (midY - startY) * 0.3), 480));
      trailTimeouts.push(setTimeout(() => spawnTrailDot(midX, midY), 640));
      trailTimeouts.push(setTimeout(() => spawnTrailDot(midX + (targetX - midX) * 0.4, midY + (targetY - midY) * 0.4), 800));
      trailTimeouts.push(setTimeout(() => spawnTrailDot(midX + (targetX - midX) * 0.75, midY + (targetY - midY) * 0.75), 960));
      trailTimeouts.push(setTimeout(() => spawnTrailDot(targetX, targetY), 1120));

      let completed = false;
      const finalize = () => {
        if (completed) return;
        completed = true;
        trailTimeouts.forEach(t => clearTimeout(t));

        if (clone && clone.parentNode) clone.remove();

        landing.style.position = '';
        landing.style.top = '';
        landing.style.left = '';
        landing.style.width = '';
        landing.style.zIndex = '';
        landing.style.pointerEvents = '';
        landing.style.opacity = '';
        landing.style.transform = '';

        appShell.style.position = '';
        appShell.style.inset = '';
        appShell.style.width = '';
        appShell.style.height = '';
        appShell.style.zIndex = '';
        appShell.style.pointerEvents = '';
        appShell.style.opacity = '';
        appShell.style.transform = '';

        document.body.classList.remove('is-transitioning-to-app');

        this.showApp();
        if (typeof win.scrollTo === 'function') win.scrollTo({ top: 0, behavior: 'instant' });

        this.isTransitioning = false;
        this.dispatchUserInteraction(queryText);
      };

      // Near arrival (~1250ms): prime the subtitles and Appu's mood for seamless zero-pop handoff
      setTimeout(() => {
        if (completed) return;
        const subtitles = document.getElementById('subtitles-text');
        if (subtitles) subtitles.textContent = `"${queryText}"`;

        if (win.appMascot && typeof win.appMascot.setMood === 'function') {
          try { win.appMascot.setMood('thinking'); } catch (_) {}
        }
        const stage = win.avatarStage || (win.app && win.app.avatarStage);
        if (stage && typeof stage.setState === 'function') {
          try { stage.setState('thinking'); } catch (_) {}
        }
      }, 1250);

      const motionDev = this.motionDev || win.__MotionDev;
      const totalDurationSec = 1.45;
      const totalDurationMs = 1450;
      const fluidEase = [0.22, 1, 0.36, 1];

      if (motionDev && typeof motionDev.animate === 'function') {
        // 1. Landing exit: holds presence during lift-out beat, then gracefully fades away
        motionDev.animate(landing, {
          opacity: [1.0, 1.0, 0.45, 0.0],
          transform: [
            'translate3d(0, 0, 0) scale(1)',
            'translate3d(0, -3px, 0) scale(0.996)',
            'translate3d(0, -14px, 0) scale(0.975)',
            'translate3d(0, -24px, 0) scale(0.95)'
          ]
        }, {
          duration: 1.20,
          ease: fluidEase,
          times: [0, 0.26, 0.68, 1.0]
        });

        // 2. App shell entrance: fades/scales in gradually so the bubble is the hero
        motionDev.animate(appShell, {
          opacity: [0.0, 0.12, 0.72, 1.0],
          transform: ['scale(0.965)', 'scale(0.975)', 'scale(0.99)', 'scale(1.0)']
        }, {
          duration: 1.38,
          ease: fluidEase,
          times: [0, 0.25, 0.68, 1.0]
        });

        // 3. Floating message bubble: Lift-Out beat (0-320ms), graceful flight arc (320-1300ms), and dissolve (1300-1450ms)
        const flightAnim = motionDev.animate(clone, {
          transform: [
            `translate3d(${startX}px, ${startY}px, 0) scale(0.98) rotate(0deg)`,
            `translate3d(${startX}px, ${startY - 22}px, 0) scale(1.08) rotate(-0.5deg)`,
            `translate3d(${midX}px, ${midY}px, 0) scale(1.04) rotate(-3.0deg)`,
            `translate3d(${targetX}px, ${targetY}px, 0) scale(0.93) rotate(0.5deg)`,
            `translate3d(${targetX}px, ${targetY}px, 0) scale(0.90) rotate(0deg)`
          ],
          opacity: [0.9, 1.0, 1.0, 1.0, 0.0]
        }, {
          duration: totalDurationSec,
          ease: fluidEase,
          times: [0, 0.22, 0.60, 0.90, 1.0]
        });

        if (flightAnim && flightAnim.finished && typeof flightAnim.finished.then === 'function') {
          flightAnim.finished.then(finalize);
        } else if (flightAnim && typeof flightAnim.then === 'function') {
          flightAnim.then(finalize);
        } else {
          setTimeout(finalize, totalDurationMs);
        }
      } else if (typeof clone.animate === 'function') {
        if (typeof landing.animate === 'function') {
          landing.animate([
            { opacity: 1.0, transform: 'translate3d(0, 0, 0) scale(1)', offset: 0 },
            { opacity: 1.0, transform: 'translate3d(0, -3px, 0) scale(0.996)', offset: 0.26 },
            { opacity: 0.45, transform: 'translate3d(0, -14px, 0) scale(0.975)', offset: 0.68 },
            { opacity: 0.0, transform: 'translate3d(0, -24px, 0) scale(0.95)', offset: 1.0 }
          ], { duration: 1200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' });
        }
        if (typeof appShell.animate === 'function') {
          appShell.animate([
            { opacity: 0.0, transform: 'scale(0.965)', offset: 0 },
            { opacity: 0.12, transform: 'scale(0.975)', offset: 0.25 },
            { opacity: 0.72, transform: 'scale(0.99)', offset: 0.68 },
            { opacity: 1.0, transform: 'scale(1.0)', offset: 1.0 }
          ], { duration: 1380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' });
        }
        const anim = clone.animate([
          { transform: `translate3d(${startX}px, ${startY}px, 0) scale(0.98) rotate(0deg)`, opacity: 0.9, offset: 0 },
          { transform: `translate3d(${startX}px, ${startY - 22}px, 0) scale(1.08) rotate(-0.5deg)`, opacity: 1.0, offset: 0.22 },
          { transform: `translate3d(${midX}px, ${midY}px, 0) scale(1.04) rotate(-3.0deg)`, opacity: 1.0, offset: 0.60 },
          { transform: `translate3d(${targetX}px, ${targetY}px, 0) scale(0.93) rotate(0.5deg)`, opacity: 1.0, offset: 0.90 },
          { transform: `translate3d(${targetX}px, ${targetY}px, 0) scale(0.90) rotate(0deg)`, opacity: 0.0, offset: 1.0 }
        ], {
          duration: totalDurationMs,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards'
        });
        anim.onfinish = finalize;
      } else {
        finalize();
      }

      // Hard safety timer (expanded to 2400ms to comfortably accommodate slower animation)
      setTimeout(() => { if (!completed) finalize(); }, 2400);
    },

    enterApp(question = '', originEl = null) {
      const win = getWin();
      const queryText = (typeof question === 'string') ? question.trim() : '';

      if (this.isTransitioning) return;

      const prefersReduced = Boolean(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
      const isBrowserDOM = typeof document !== 'undefined' && 
                           typeof document.getElementById === 'function' && 
                           document.getElementById('marketing-landing') && 
                           document.getElementById('app-shell');

      // If in mock/node test environment or reduced-motion requested, skip animation
      if (!isBrowserDOM || prefersReduced) {
        this.showApp();
        if (typeof win.scrollTo === 'function') {
          try { win.scrollTo({ top: 0, behavior: 'instant' }); } catch (_) {}
        }
        if (queryText) {
          setTimeout(() => {
            this.dispatchUserInteraction(queryText);
          }, 150);
        }
        return;
      }

      this.isTransitioning = true;

      // Play soft tactile click if available
      try {
        const ve = win.voiceEngine || (win.app && win.app.voiceEngine);
        if (ve && typeof ve.playClick === 'function') ve.playClick();
      } catch (_) {}

      try {
        if (queryText) {
          this.animateFlightTransition(queryText, originEl);
        } else {
          this.animateZoomCrossfade();
        }
      } catch (err) {
        console.warn('[LandingPage] Transition error, activating fail-safe:', err);
        this.isTransitioning = false;
        this.showApp();
        if (typeof win.scrollTo === 'function') {
          try { win.scrollTo({ top: 0, behavior: 'instant' }); } catch (_) {}
        }
        if (queryText) {
          this.dispatchUserInteraction(queryText);
        }
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
