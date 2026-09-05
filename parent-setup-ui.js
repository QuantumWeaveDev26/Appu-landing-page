/**
 * ParentSetupUI: DOM Controller for Parent Setup, Subscription Visibility & Onboarding
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.ParentSetupUI = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ==========================================
  // PARENT SETUP TRANSLATION LAYER (mirrors UI_TRANSLATIONS in app.js)
  // ==========================================
  const POS_TRANSLATIONS = {
    en: {
      modalKicker: 'Parent Zone • Setup',
      modalTitle: 'Personalized Appu Setup',
      modalLead: "Configure your learner's companion, active learning plan, and personalized preferences.",
      betaModalKicker: 'Public Beta • Free Signup',
      betaModalTitle: 'Join the APPU Beta — Free',
      betaModalLead: 'No payment required. Sign up, verify your email, and get {limit} free personalised chats.',
      tabLogin: 'Sign In',
      tabSignup: 'Create Account',
      authEmailLabel: 'Parent / Guardian Email',
      authPasswordLabel: 'Password',
      authHouseholdLabel: 'Household / Family Name',
      btnAuthSubmitSignIn: 'Sign In to Parent Zone',
      btnAuthSubmitSignUp: 'Create Parent Account',
      alertEnterBoth: 'Please enter both email and password.',
      authCreatingAccount: 'Creating Account...',
      authenticating: 'Authenticating...',
      authFailedDefault: 'Authentication failed. Please check your credentials.',
      emailVerifiedSuccess: 'Email verified successfully! Sign in with your password to continue your APPU setup.',
      verifyTitle: 'Check your email',
      verifyLead: 'We sent a verification link to {email}. Open your inbox and click the link to verify your account.',
      verifySub: "After verification, we'll bring you back to APPU and continue your setup.",
      btnCheckVerification: "I've verified my email",
      btnResendVerification: 'Resend verification email',
      btnBackSignin: 'Back to sign in',
      checkingVerification: 'Checking verification...',
      notYetVerifiedMsg: "We haven't detected a verified session yet. Open the verification link from your email, then return here.",
      checkVerificationErrorDefault: 'Unable to check verification status. Please try again.',
      sendingResend: 'Sending...',
      resendSuccessMsg: 'Verification email resent to {email}. Please check your inbox and spam folder.',
      resendInSeconds: 'Resend in {s}s',
      resendErrorDefault: 'Failed to resend verification email. Please try again later.',
      childFormTitle: 'Add New Learner Profile:',
      childNameLabel: 'Learner Preferred Name',
      childGradeLabel: 'Class / Grade Band',
      gradeOptions: ['Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
      btnChildSubmit: 'Save Learner & Continue',
      learnerProfileHeading: 'Learner Profile:',
      btnSelectLearner: 'Select',
      quotaActiveTitle: 'Learner profile active',
      quotaActiveDesc: 'Your student companion is configured for this learner profile.',
      btnManagePlans: 'Manage Subscription Plans',
      childAlertEnterNameClass: 'Please enter learner name and class.',
      childAddErrorDefault: 'Failed to add learner profile.',
      childLoadErrorDefault: 'Failed to load learners',
      loadingLearners: 'Loading learners...',
      persIntroText: 'Personalize Appu for',
      persLangLabel: 'Primary Language',
      persStyleLabel: 'Learning Style',
      styleOptInteractive: 'Interactive (conversations & questions)',
      styleOptVisual: 'Visual (examples & diagrams)',
      styleOptAuditory: 'Auditory (spoken explanations)',
      styleOptReading: 'Reading & Writing (structured notes)',
      persResponseLabel: 'Response Style',
      responseOptPlayful: 'Playful & Encouraging',
      responseOptBalanced: 'Balanced & Clear',
      responseOptFocused: 'Focused & Direct',
      persFontLabel: 'Reading Font Style',
      fontOptRounded: 'Friendly Rounded',
      fontOptFriendly: 'Friendly Standard',
      fontOptClean: 'Clean Minimal',
      persThemeLabel: 'Theme Mode',
      themeOptAuto: 'Auto',
      themeOptBright: 'Bright & Energetic',
      themeOptCalm: 'Calm & Focused',
      persSubjectsLabel: 'Favorite Subjects',
      persSubjectsPlaceholder: 'Science, Mathematics, Coding',
      persInterestsLabel: 'Favorite Interests & Hobbies (comma-separated)',
      persInterestsPlaceholder: 'Space, Robotics, Astronomy, Dinosaurs',
      persGoalsLabel: 'Learning Goal for Appu',
      persGoalsPlaceholder: 'Master school science and build creative curiosity',
      posWhatsappTitle: 'Parent WhatsApp Learning Updates',
      posParentPhoneLabel: 'Parent WhatsApp Number',
      posParentPhonePlaceholder: '+91 98765 43210',
      posWhatsappConsentLabel: 'Send me occasional learning milestones, daily study summaries, and study notes for my child on WhatsApp.',
      posWhatsappRationale: 'Why we ask: We use your number exclusively to share study summaries and learning milestones. We never share phone numbers with third parties or send promotional spam. You can opt out anytime.',
      phoneInvalidAlert: 'Please enter a valid phone number (e.g., 9876543210 or +919876543210).',
      phoneRequiredForConsentAlert: 'Please enter your phone number to receive WhatsApp updates, or uncheck the box.',
      btnPersSubmit: 'Save Preferences & Launch',
      alertNoChildSelected: 'No child selected',
      persSaveErrorDefault: 'Failed to save personalisation.',
      successTitle: 'Personalized Appu is Ready!',
      successDesc: 'Your learner profile and active subscription are set up. Appu will now tailor responses and voice explanations specifically for your child.',
      btnLaunchText: 'Launch Appu Now'
    },
    kn: {
      modalKicker: 'ಪೋಷಕರ ವಲಯ • ಸೆಟಪ್',
      modalTitle: 'ವೈಯಕ್ತೀಕರಿಸಿದ ಅಪ್ಪು ಸೆಟಪ್',
      modalLead: 'ನಿಮ್ಮ ಕಲಿಕಾರ್ಥಿಯ ಸಂಗಾತಿ, ಸಕ್ರಿಯ ಕಲಿಕಾ ಯೋಜನೆ ಮತ್ತು ವೈಯಕ್ತಿಕ ಆದ್ಯತೆಗಳನ್ನು ಹೊಂದಿಸಿ.',
      betaModalKicker: 'ಸಾರ್ವಜನಿಕ ಬೀಟಾ • ಉಚಿತ ನೋಂದಣಿ',
      betaModalTitle: 'APPU ಬೀಟಾಗೆ ಸೇರಿ — ಉಚಿತ',
      betaModalLead: 'ಪಾವತಿ ಅಗತ್ಯವಿಲ್ಲ. ನೋಂದಾಯಿಸಿ, ನಿಮ್ಮ ಇಮೇಲ್ ಪರಿಶೀಲಿಸಿ, ಮತ್ತು {limit} ಉಚಿತ ವೈಯಕ್ತೀಕರಿಸಿದ ಸಂಭಾಷಣೆಗಳನ್ನು ಪಡೆಯಿರಿ.',
      tabLogin: 'ಸೈನ್ ಇನ್',
      tabSignup: 'ಖಾತೆ ರಚಿಸಿ',
      authEmailLabel: 'ಪೋಷಕ / ಪಾಲಕರ ಇಮೇಲ್',
      authPasswordLabel: 'ಪಾಸ್‌ವರ್ಡ್',
      authHouseholdLabel: 'ಕುಟುಂಬದ ಹೆಸರು',
      btnAuthSubmitSignIn: 'ಪೋಷಕರ ವಲಯಕ್ಕೆ ಸೈನ್ ಇನ್ ಮಾಡಿ',
      btnAuthSubmitSignUp: 'ಪೋಷಕರ ಖಾತೆ ರಚಿಸಿ',
      alertEnterBoth: 'ದಯವಿಟ್ಟು ಇಮೇಲ್ ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್ ಎರಡನ್ನೂ ನಮೂದಿಸಿ.',
      authCreatingAccount: 'ಖಾತೆ ರಚಿಸಲಾಗುತ್ತಿದೆ...',
      authenticating: 'ಪ್ರಮಾಣೀಕರಿಸಲಾಗುತ್ತಿದೆ...',
      authFailedDefault: 'ಪ್ರಮಾಣೀಕರಣ ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ರುಜುವಾತುಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.',
      emailVerifiedSuccess: 'ಇಮೇಲ್ ಯಶಸ್ವಿಯಾಗಿ ಪರಿಶೀಲಿಸಲಾಗಿದೆ! ನಿಮ್ಮ APPU ಸೆಟಪ್ ಮುಂದುವರಿಸಲು ಪಾಸ್‌ವರ್ಡ್‌ನೊಂದಿಗೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.',
      verifyTitle: 'ನಿಮ್ಮ ಇಮೇಲ್ ಪರಿಶೀಲಿಸಿ',
      verifyLead: 'ನಾವು {email} ಗೆ ಪರಿಶೀಲನಾ ಲಿಂಕ್ ಕಳುಹಿಸಿದ್ದೇವೆ. ನಿಮ್ಮ ಖಾತೆಯನ್ನು ಪರಿಶೀಲಿಸಲು ನಿಮ್ಮ ಇನ್‌ಬಾಕ್ಸ್ ತೆರೆದು ಲಿಂಕ್ ಕ್ಲಿಕ್ ಮಾಡಿ.',
      verifySub: 'ಪರಿಶೀಲನೆಯ ನಂತರ, ನಾವು ನಿಮ್ಮನ್ನು APPU ಗೆ ಹಿಂತಿರುಗಿಸಿ ನಿಮ್ಮ ಸೆಟಪ್ ಮುಂದುವರಿಸುತ್ತೇವೆ.',
      btnCheckVerification: 'ನಾನು ನನ್ನ ಇಮೇಲ್ ಪರಿಶೀಲಿಸಿದ್ದೇನೆ',
      btnResendVerification: 'ಪರಿಶೀಲನಾ ಇಮೇಲ್ ಮರುಕಳುಹಿಸಿ',
      btnBackSignin: 'ಸೈನ್ ಇನ್‌ಗೆ ಹಿಂತಿರುಗಿ',
      checkingVerification: 'ಪರಿಶೀಲನೆ ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ...',
      notYetVerifiedMsg: 'ನಾವು ಇನ್ನೂ ಪರಿಶೀಲಿಸಿದ ಸೆಷನ್ ಪತ್ತೆ ಮಾಡಿಲ್ಲ. ನಿಮ್ಮ ಇಮೇಲ್‌ನಿಂದ ಪರಿಶೀಲನಾ ಲಿಂಕ್ ತೆರೆದು, ನಂತರ ಇಲ್ಲಿಗೆ ಹಿಂತಿರುಗಿ.',
      checkVerificationErrorDefault: 'ಪರಿಶೀಲನಾ ಸ್ಥಿತಿಯನ್ನು ಪರಿಶೀಲಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
      sendingResend: 'ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ...',
      resendSuccessMsg: 'ಪರಿಶೀಲನಾ ಇಮೇಲ್ ಅನ್ನು {email} ಗೆ ಮರುಕಳುಹಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಇನ್‌ಬಾಕ್ಸ್ ಮತ್ತು ಸ್ಪ್ಯಾಮ್ ಫೋಲ್ಡರ್ ಪರಿಶೀಲಿಸಿ.',
      resendInSeconds: '{s} ಸೆಕೆಂಡುಗಳಲ್ಲಿ ಮರುಕಳುಹಿಸಿ',
      resendErrorDefault: 'ಪರಿಶೀಲನಾ ಇಮೇಲ್ ಮರುಕಳುಹಿಸಲು ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
      childFormTitle: 'ಹೊಸ ಕಲಿಕಾರ್ಥಿ ಪ್ರೊಫೈಲ್ ಸೇರಿಸಿ:',
      childNameLabel: 'ಕಲಿಕಾರ್ಥಿಯ ಆದ್ಯತೆಯ ಹೆಸರು',
      childGradeLabel: 'ತರಗತಿ / ಗ್ರೇಡ್ ಬ್ಯಾಂಡ್',
      gradeOptions: ['5ನೇ ತರಗತಿ', '6ನೇ ತರಗತಿ', '7ನೇ ತರಗತಿ', '8ನೇ ತರಗತಿ', '9ನೇ ತರಗತಿ', '10ನೇ ತರಗತಿ', '11ನೇ ತರಗತಿ', '12ನೇ ತರಗತಿ'],
      btnChildSubmit: 'ಕಲಿಕಾರ್ಥಿಯನ್ನು ಉಳಿಸಿ ಮತ್ತು ಮುಂದುವರಿಸಿ',
      learnerProfileHeading: 'ಕಲಿಕಾರ್ಥಿ ಪ್ರೊಫೈಲ್:',
      btnSelectLearner: 'ಆಯ್ಕೆಮಾಡಿ',
      quotaActiveTitle: 'ಕಲಿಕಾರ್ಥಿ ಪ್ರೊಫೈಲ್ ಸಕ್ರಿಯವಾಗಿದೆ',
      quotaActiveDesc: 'ಈ ಕಲಿಕಾರ್ಥಿ ಪ್ರೊಫೈಲ್‌ಗಾಗಿ ನಿಮ್ಮ ವಿದ್ಯಾರ್ಥಿ ಸಂಗಾತಿಯನ್ನು ಸಂರಚಿಸಲಾಗಿದೆ.',
      btnManagePlans: 'ಚಂದಾದಾರಿಕೆ ಯೋಜನೆಗಳನ್ನು ನಿರ್ವಹಿಸಿ',
      childAlertEnterNameClass: 'ದಯವಿಟ್ಟು ಕಲಿಕಾರ್ಥಿಯ ಹೆಸರು ಮತ್ತು ತರಗತಿಯನ್ನು ನಮೂದಿಸಿ.',
      childAddErrorDefault: 'ಕಲಿಕಾರ್ಥಿ ಪ್ರೊಫೈಲ್ ಸೇರಿಸಲು ವಿಫಲವಾಗಿದೆ.',
      childLoadErrorDefault: 'ಕಲಿಕಾರ್ಥಿಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ',
      loadingLearners: 'ಕಲಿಕಾರ್ಥಿಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...',
      persIntroText: 'ಇವರಿಗಾಗಿ ಅಪ್ಪುವನ್ನು ವೈಯಕ್ತೀಕರಿಸಿ',
      persLangLabel: 'ಪ್ರಾಥಮಿಕ ಭಾಷೆ',
      persStyleLabel: 'ಕಲಿಕಾ ಶೈಲಿ',
      styleOptInteractive: 'ಸಂವಾದಾತ್ಮಕ (ಸಂಭಾಷಣೆ ಮತ್ತು ಪ್ರಶ್ನೆಗಳು)',
      styleOptVisual: 'ದೃಶ್ಯ (ಉದಾಹರಣೆಗಳು ಮತ್ತು ರೇಖಾಚಿತ್ರಗಳು)',
      styleOptAuditory: 'ಶ್ರವಣ (ಮಾತಿನ ವಿವರಣೆಗಳು)',
      styleOptReading: 'ಓದುವಿಕೆ ಮತ್ತು ಬರವಣಿಗೆ (ರಚನಾತ್ಮಕ ಟಿಪ್ಪಣಿಗಳು)',
      persResponseLabel: 'ಪ್ರತಿಕ್ರಿಯೆ ಶೈಲಿ',
      responseOptPlayful: 'ಆಟಿಕೆ ಮತ್ತು ಪ್ರೋತ್ಸಾಹದಾಯಕ',
      responseOptBalanced: 'ಸಮತೋಲಿತ ಮತ್ತು ಸ್ಪಷ್ಟ',
      responseOptFocused: 'ಕೇಂದ್ರೀಕೃತ ಮತ್ತು ನೇರ',
      persFontLabel: 'ಓದುವ ಫಾಂಟ್ ಶೈಲಿ',
      fontOptRounded: 'ಸ್ನೇಹಪರ ಸುತ್ತಿನ',
      fontOptFriendly: 'ಸ್ನೇಹಪರ ಪ್ರಮಾಣಿತ',
      fontOptClean: 'ಸ್ವಚ್ಛ ಮಿನಿಮಲ್',
      persThemeLabel: 'ಥೀಮ್ ಮೋಡ್',
      themeOptAuto: 'ಸ್ವಯಂಚಾಲಿತ',
      themeOptBright: 'ಪ್ರಕಾಶಮಾನ ಮತ್ತು ಚೈತನ್ಯಶೀಲ',
      themeOptCalm: 'ಶಾಂತ ಮತ್ತು ಕೇಂದ್ರೀಕೃತ',
      persSubjectsLabel: 'ಮೆಚ್ಚಿನ ವಿಷಯಗಳು',
      persSubjectsPlaceholder: 'ವಿಜ್ಞಾನ, ಗಣಿತ, ಕೋಡಿಂಗ್',
      persInterestsLabel: 'ಮೆಚ್ಚಿನ ಆಸಕ್ತಿಗಳು ಮತ್ತು ಹವ್ಯಾಸಗಳು (ಅಲ್ಪವಿರಾಮದಿಂದ ಬೇರ್ಪಡಿಸಿ)',
      persInterestsPlaceholder: 'ಬಾಹ್ಯಾಕಾಶ, ರೊಬೊಟಿಕ್ಸ್, ಖಗೋಳಶಾಸ್ತ್ರ, ಡೈನೋಸಾರ್‌ಗಳು',
      persGoalsLabel: 'ಅಪ್ಪುಗಾಗಿ ಕಲಿಕಾ ಗುರಿ',
      persGoalsPlaceholder: 'ಶಾಲಾ ವಿಜ್ಞಾನವನ್ನು ಕರಗತ ಮಾಡಿಕೊಂಡು ಸೃಜನಶೀಲ ಕುತೂಹಲ ಬೆಳೆಸಿಕೊಳ್ಳಿ',
      posWhatsappTitle: 'ಪಾಲಕರ WhatsApp ಕಲಿಕಾ ಅಪ್‌ಡೇಟ್‌ಗಳು',
      posParentPhoneLabel: 'ಪಾಲಕರ WhatsApp ಸಂಖ್ಯೆ',
      posParentPhonePlaceholder: '+91 98765 43210',
      posWhatsappConsentLabel: 'ನನ್ನ ಮಗುವಿನ ಕಲಿಕೆಯ ಮೈಲಿಗಲ್ಲುಗಳು ಮತ್ತು ದಿನನಿತ್ಯದ ಅಧ್ಯಯನ ಸಾರಾಂಶಗಳನ್ನು WhatsApp ನಲ್ಲಿ ಕಳುಹಿಸಿ.',
      posWhatsappRationale: 'ಏಕೆ ಕೇಳುತ್ತಿದ್ದೇವೆ: ನಿಮ್ಮ ಸಂಖ್ಯೆಯನ್ನು ಕೇವಲ ಅಧ್ಯಯನ ಸಾರಾಂಶ ಮತ್ತು ಕಲಿಕೆಯ ಮೈಲಿಗಲ್ಲುಗಳನ್ನು ಹಂಚಿಕೊಳ್ಳಲು ಬಳಸಲಾಗುತ್ತದೆ. ಮೂರನೇ ವ್ಯಕ್ತಿಗಳೊಂದಿಗೆ ಎಂದಿಗೂ ಹಂಚಿಕೊಳ್ಳುವುದಿಲ್ಲ. ಯಾವುದೇ ಸಮಯದಲ್ಲಿ ರದ್ದುಗೊಳಿಸಬಹುದು.',
      phoneInvalidAlert: 'ದಯವಿಟ್ಟು ಮಾನ್ಯವಾದ ಫೋನ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ (ಉದಾ: 9876543210 ಅಥವಾ +919876543210).',
      phoneRequiredForConsentAlert: 'WhatsApp ಅಪ್‌ಡೇಟ್‌ಗಳನ್ನು ಪಡೆಯಲು ದಯವಿಟ್ಟು ಫೋನ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ, ಅಥವಾ ಬಾಕ್ಸ್ ಅನ್ನು ಗುರುತಿಸಬೇಡಿ.',
      btnPersSubmit: 'ಆದ್ಯತೆಗಳನ್ನು ಉಳಿಸಿ ಮತ್ತು ಪ್ರಾರಂಭಿಸಿ',
      alertNoChildSelected: 'ಯಾವುದೇ ಮಗುವನ್ನು ಆಯ್ಕೆ ಮಾಡಿಲ್ಲ',
      persSaveErrorDefault: 'ವೈಯಕ್ತೀಕರಣ ಉಳಿಸಲು ವಿಫಲವಾಗಿದೆ.',
      successTitle: 'ವೈಯಕ್ತೀಕರಿಸಿದ ಅಪ್ಪು ಸಿದ್ಧವಾಗಿದೆ!',
      successDesc: 'ನಿಮ್ಮ ಕಲಿಕಾರ್ಥಿ ಪ್ರೊಫೈಲ್ ಮತ್ತು ಸಕ್ರಿಯ ಚಂದಾದಾರಿಕೆ ಸಿದ್ಧವಾಗಿದೆ. ಅಪ್ಪು ಈಗ ನಿಮ್ಮ ಮಗುವಿಗಾಗಿ ನಿರ್ದಿಷ್ಟವಾಗಿ ಪ್ರತಿಕ್ರಿಯೆಗಳು ಮತ್ತು ಧ್ವನಿ ವಿವರಣೆಗಳನ್ನು ಹೊಂದಿಸುತ್ತಾನೆ.',
      btnLaunchText: 'ಈಗ ಅಪ್ಪುವನ್ನು ಪ್ರಾರಂಭಿಸಿ'
    },
    hi: {
      modalKicker: 'पेरेंट ज़ोन • सेटअप',
      modalTitle: 'व्यक्तिगत अप्पू सेटअप',
      modalLead: 'अपने बच्चे के साथी, सक्रिय लर्निंग प्लान और व्यक्तिगत प्राथमिकताओं को कॉन्फ़िगर करें।',
      betaModalKicker: 'सार्वजनिक बीटा • मुफ़्त साइनअप',
      betaModalTitle: 'APPU बीटा में शामिल हों — मुफ़्त',
      betaModalLead: 'कोई भुगतान आवश्यक नहीं। साइन अप करें, अपना ईमेल सत्यापित करें, और {limit} मुफ़्त व्यक्तिगत बातचीत पाएं।',
      tabLogin: 'साइन इन',
      tabSignup: 'खाता बनाएं',
      authEmailLabel: 'माता-पिता / अभिभावक ईमेल',
      authPasswordLabel: 'पासवर्ड',
      authHouseholdLabel: 'परिवार का नाम',
      btnAuthSubmitSignIn: 'पेरेंट ज़ोन में साइन इन करें',
      btnAuthSubmitSignUp: 'पेरेंट खाता बनाएं',
      alertEnterBoth: 'कृपया ईमेल और पासवर्ड दोनों दर्ज करें।',
      authCreatingAccount: 'खाता बनाया जा रहा है...',
      authenticating: 'प्रमाणीकरण हो रहा है...',
      authFailedDefault: 'प्रमाणीकरण विफल हुआ। कृपया अपनी जानकारी जांचें।',
      emailVerifiedSuccess: 'ईमेल सफलतापूर्वक सत्यापित हुआ! अपना APPU सेटअप जारी रखने के लिए पासवर्ड से साइन इन करें।',
      verifyTitle: 'अपना ईमेल जांचें',
      verifyLead: 'हमने {email} पर एक सत्यापन लिंक भेजा है। अपना खाता सत्यापित करने के लिए अपना इनबॉक्स खोलें और लिंक पर क्लिक करें।',
      verifySub: 'सत्यापन के बाद, हम आपको वापस APPU पर लाएंगे और आपका सेटअप जारी रखेंगे।',
      btnCheckVerification: 'मैंने अपना ईमेल सत्यापित कर लिया है',
      btnResendVerification: 'सत्यापन ईमेल फिर से भेजें',
      btnBackSignin: 'साइन इन पर वापस जाएं',
      checkingVerification: 'सत्यापन जांचा जा रहा है...',
      notYetVerifiedMsg: 'हमें अभी तक सत्यापित सत्र नहीं मिला है। अपने ईमेल से सत्यापन लिंक खोलें, फिर यहां वापस आएं।',
      checkVerificationErrorDefault: 'सत्यापन स्थिति जांचने में असमर्थ। कृपया फिर से प्रयास करें।',
      sendingResend: 'भेजा जा रहा है...',
      resendSuccessMsg: 'सत्यापन ईमेल {email} पर फिर से भेजा गया। कृपया अपना इनबॉक्स और स्पैम फ़ोल्डर जांचें।',
      resendInSeconds: '{s}s में फिर से भेजें',
      resendErrorDefault: 'सत्यापन ईमेल फिर से भेजने में विफल। कृपया बाद में फिर से प्रयास करें।',
      childFormTitle: 'नई शिक्षार्थी प्रोफ़ाइल जोड़ें:',
      childNameLabel: 'शिक्षार्थी का पसंदीदा नाम',
      childGradeLabel: 'कक्षा / ग्रेड बैंड',
      gradeOptions: ['कक्षा 5', 'कक्षा 6', 'कक्षा 7', 'कक्षा 8', 'कक्षा 9', 'कक्षा 10', 'कक्षा 11', 'कक्षा 12'],
      btnChildSubmit: 'शिक्षार्थी सहेजें और जारी रखें',
      learnerProfileHeading: 'शिक्षार्थी प्रोफ़ाइल:',
      btnSelectLearner: 'चुनें',
      quotaActiveTitle: 'शिक्षार्थी प्रोफ़ाइल सक्रिय है',
      quotaActiveDesc: 'आपका स्टूडेंट साथी इस शिक्षार्थी प्रोफ़ाइल के लिए कॉन्फ़िगर किया गया है।',
      btnManagePlans: 'सब्सक्रिप्शन प्लान प्रबंधित करें',
      childAlertEnterNameClass: 'कृपया शिक्षार्थी का नाम और कक्षा दर्ज करें।',
      childAddErrorDefault: 'शिक्षार्थी प्रोफ़ाइल जोड़ने में विफल।',
      childLoadErrorDefault: 'शिक्षार्थी लोड करने में विफल',
      loadingLearners: 'शिक्षार्थी लोड हो रहे हैं...',
      persIntroText: 'इनके लिए अप्पू को व्यक्तिगत बनाएं',
      persLangLabel: 'मुख्य भाषा',
      persStyleLabel: 'सीखने की शैली',
      styleOptInteractive: 'इंटरैक्टिव (बातचीत और सवाल)',
      styleOptVisual: 'दृश्य (उदाहरण और चित्र)',
      styleOptAuditory: 'श्रवण (बोले गए स्पष्टीकरण)',
      styleOptReading: 'पढ़ना और लिखना (संरचित नोट्स)',
      persResponseLabel: 'प्रतिक्रिया शैली',
      responseOptPlayful: 'चंचल और उत्साहवर्धक',
      responseOptBalanced: 'संतुलित और स्पष्ट',
      responseOptFocused: 'केंद्रित और सीधा',
      persFontLabel: 'पठन फ़ॉन्ट शैली',
      fontOptRounded: 'फ्रेंडली राउंडेड',
      fontOptFriendly: 'फ्रेंडली स्टैंडर्ड',
      fontOptClean: 'क्लीन मिनिमल',
      persThemeLabel: 'थीम मोड',
      themeOptAuto: 'ऑटो',
      themeOptBright: 'उज्ज्वल और ऊर्जावान',
      themeOptCalm: 'शांत और केंद्रित',
      persSubjectsLabel: 'पसंदीदा विषय',
      persSubjectsPlaceholder: 'विज्ञान, गणित, कोडिंग',
      persInterestsLabel: 'पसंदीदा रुचियां और शौक (अल्पविराम से अलग करें)',
      persInterestsPlaceholder: 'अंतरिक्ष, रोबोटिक्स, खगोल विज्ञान, डायनासोर',
      persGoalsLabel: 'अप्पू के लिए सीखने का लक्ष्य',
      persGoalsPlaceholder: 'स्कूल विज्ञान में महारत हासिल करें और रचनात्मक जिज्ञासा बढ़ाएं',
      posWhatsappTitle: 'अभिभावक WhatsApp लर्निंग अपडेट्स',
      posParentPhoneLabel: 'अभिभावक WhatsApp नंबर',
      posParentPhonePlaceholder: '+91 98765 43210',
      posWhatsappConsentLabel: 'मुझे WhatsApp पर मेरे बच्चे की सीखने की प्रगति और दैनिक अध्ययन नोट्स भेजें।',
      posWhatsappRationale: 'हम क्यों पूछ रहे हैं: आपके नंबर का उपयोग केवल अध्ययन सारांश और सीखने के मील के पत्थर साझा करने के लिए किया जाता है। तीसरे पक्ष के साथ कभी साझा नहीं किया जाता। आप कभी भी ऑप्ट-आउट कर सकते हैं।',
      phoneInvalidAlert: 'कृपया एक मान्य फ़ोन नंबर दर्ज करें (उदा: 9876543210 या +919876543210)।',
      phoneRequiredForConsentAlert: 'WhatsApp अपडेट प्राप्त करने के लिए कृपया अपना फ़ोन नंबर दर्ज करें, या चेकबॉक्स को अनचेक करें।',
      btnPersSubmit: 'प्राथमिकताएं सहेजें और शुरू करें',
      alertNoChildSelected: 'कोई बच्चा चयनित नहीं है',
      persSaveErrorDefault: 'वैयक्तिकरण सहेजने में विफल।',
      successTitle: 'व्यक्तिगत अप्पू तैयार है!',
      successDesc: 'आपकी शिक्षार्थी प्रोफ़ाइल और सक्रिय सब्सक्रिप्शन सेट हो चुके हैं। अब अप्पू आपके बच्चे के लिए विशेष रूप से प्रतिक्रियाएं और आवाज़ स्पष्टीकरण तैयार करेगा।',
      btnLaunchText: 'अभी अप्पू शुरू करें'
    }
  };

  let currentPosLang = 'en';

  function t(key) {
    const dict = POS_TRANSLATIONS[currentPosLang] || POS_TRANSLATIONS.en;
    return (key in dict) ? dict[key] : POS_TRANSLATIONS.en[key];
  }

  function init() {
    const modal = document.getElementById('parent-setup-modal');
    if (!modal) return;

    currentPosLang = (typeof localStorage !== 'undefined' && localStorage.getItem('appu_lang')) || 'en';
    if (currentPosLang !== 'kn' && currentPosLang !== 'hi') currentPosLang = 'en';

    const btnOpen = document.getElementById('btn-parent-setup');
    const btnClose = document.getElementById('btn-close-parent-setup');
    const btnHeroGetStarted = document.getElementById('btn-hero-primary-schedule');
    const btnSkip = document.getElementById('pos-btn-skip');

    // Steps containers
    const stepAuth = document.getElementById('pos-step-auth');
    const stepPlan = document.getElementById('pos-step-plan');
    const stepChild = document.getElementById('pos-step-child');
    const stepPers = document.getElementById('pos-step-pers');
    const stepSuccess = document.getElementById('pos-step-success');
    const stepTracker = document.getElementById('pos-step-tracker');
    const alertBox = document.getElementById('pos-alert');

    // Forms & Controls
    const authForm = document.getElementById('pos-auth-form');
    const tabLogin = document.getElementById('pos-tab-login');
    const tabSignup = document.getElementById('pos-tab-signup');
    const authEmail = document.getElementById('pos-auth-email');
    const authPassword = document.getElementById('pos-auth-password');
    const authHousehold = document.getElementById('pos-auth-household');
    const authHouseholdWrap = document.getElementById('pos-household-wrap');
    const btnAuthSubmit = document.getElementById('pos-btn-auth-submit');

    const plansContainer = document.getElementById('pos-plans-container');
    const planStatusText = document.getElementById('pos-plan-status');

    const childListContainer = document.getElementById('pos-child-list');
    const childNewFormWrap = document.getElementById('pos-child-form-wrap');
    const childNewForm = document.getElementById('pos-child-form');
    const childNameInput = document.getElementById('pos-child-name');
    const childGradeSelect = document.getElementById('pos-child-grade');

    const persForm = document.getElementById('pos-pers-form');
    const persLang = document.getElementById('pos-pers-lang');
    const persStyle = document.getElementById('pos-pers-style');
    const persFont = document.getElementById('pos-pers-font');
    const persResponse = document.getElementById('pos-pers-response');
    const persTheme = document.getElementById('pos-pers-theme');
    const persInterests = document.getElementById('pos-pers-interests');
    const persSubjects = document.getElementById('pos-pers-subjects');
    const persGoals = document.getElementById('pos-pers-goals');
    const posParentPhone = document.getElementById('pos-parent-phone');
    const posWhatsappConsent = document.getElementById('pos-whatsapp-consent');

    const btnLaunchAppu = document.getElementById('pos-btn-launch');

    let isSignUpMode = false;
    let currentStep = 1;
    let lastVerifyEmail = '';
    let lastVerifyHousehold = 'Family';

    function showAlert(message, type = 'error') {
      if (!alertBox) return;
      alertBox.textContent = message;
      alertBox.className = `pos-alert ${type}`;
      alertBox.style.display = 'block';
    }

    function clearAlert() {
      if (!alertBox) return;
      alertBox.textContent = '';
      alertBox.style.display = 'none';
    }

    // ==========================================
    // TRANSLATION APPLICATION (Parent Setup modal: steps 1, 3, 4, 5)
    // ==========================================
    function applyStaticPosLabels() {
      const kickerEl = document.getElementById('pos-modal-kicker');
      const titleEl = document.getElementById('pos-modal-title');
      const leadEl = document.getElementById('pos-modal-lead');
      if (typeof APPU_CONFIG !== 'undefined' && APPU_CONFIG.betaMode) {
        if (kickerEl) kickerEl.innerHTML = `<i class="fa-solid fa-flask" aria-hidden="true"></i> ${t('betaModalKicker')}`;
        if (titleEl) titleEl.textContent = t('betaModalTitle');
        if (leadEl) leadEl.textContent = t('betaModalLead').replace('{limit}', APPU_CONFIG.betaChatLimit || 30);
      } else {
        if (kickerEl) kickerEl.innerHTML = `<i class="fa-solid fa-user-gear" aria-hidden="true"></i> ${t('modalKicker')}`;
        if (titleEl) titleEl.textContent = t('modalTitle');
        if (leadEl) leadEl.textContent = t('modalLead');
      }

      // Step 1: Auth
      if (tabLogin) tabLogin.textContent = t('tabLogin');
      if (tabSignup) tabSignup.textContent = t('tabSignup');
      const authEmailLabel = document.getElementById('pos-auth-email-label');
      if (authEmailLabel) authEmailLabel.textContent = t('authEmailLabel');
      const authPasswordLabel = document.getElementById('pos-auth-password-label');
      if (authPasswordLabel) authPasswordLabel.textContent = t('authPasswordLabel');
      const authHouseholdLabel = document.getElementById('pos-auth-household-label');
      if (authHouseholdLabel) authHouseholdLabel.textContent = t('authHouseholdLabel');
      if (btnAuthSubmit && !btnAuthSubmit.disabled) {
        btnAuthSubmit.textContent = isSignUpMode ? t('btnAuthSubmitSignUp') : t('btnAuthSubmitSignIn');
      }

      // Step 3: Child
      const childFormTitle = document.getElementById('pos-child-form-title');
      if (childFormTitle) childFormTitle.textContent = t('childFormTitle');
      const childNameLabel = document.getElementById('pos-child-name-label');
      if (childNameLabel) childNameLabel.textContent = t('childNameLabel');
      const childGradeLabel = document.getElementById('pos-child-grade-label');
      if (childGradeLabel) childGradeLabel.textContent = t('childGradeLabel');
      const gradeOptions = t('gradeOptions') || [];
      ['5', '6', '7', '8', '9', '10', '11', '12'].forEach((grade, idx) => {
        const opt = document.getElementById(`pos-grade-opt-${grade}`);
        if (opt && gradeOptions[idx]) opt.textContent = gradeOptions[idx];
      });
      const btnChildSubmit = document.getElementById('pos-btn-child-submit');
      if (btnChildSubmit) btnChildSubmit.textContent = t('btnChildSubmit');

      // Step 4: Personalisation
      const persIntroText = document.getElementById('pos-pers-intro-text');
      if (persIntroText) persIntroText.textContent = t('persIntroText');
      const persLangLabel = document.getElementById('pos-pers-lang-label');
      if (persLangLabel) persLangLabel.textContent = t('persLangLabel');
      const persStyleLabel = document.getElementById('pos-pers-style-label');
      if (persStyleLabel) persStyleLabel.textContent = t('persStyleLabel');
      const styleOptInteractive = document.getElementById('pos-style-opt-interactive');
      if (styleOptInteractive) styleOptInteractive.textContent = t('styleOptInteractive');
      const styleOptVisual = document.getElementById('pos-style-opt-visual');
      if (styleOptVisual) styleOptVisual.textContent = t('styleOptVisual');
      const styleOptAuditory = document.getElementById('pos-style-opt-auditory');
      if (styleOptAuditory) styleOptAuditory.textContent = t('styleOptAuditory');
      const styleOptReading = document.getElementById('pos-style-opt-reading');
      if (styleOptReading) styleOptReading.textContent = t('styleOptReading');
      const persResponseLabel = document.getElementById('pos-pers-response-label');
      if (persResponseLabel) persResponseLabel.textContent = t('persResponseLabel');
      const responseOptPlayful = document.getElementById('pos-response-opt-playful');
      if (responseOptPlayful) responseOptPlayful.textContent = t('responseOptPlayful');
      const responseOptBalanced = document.getElementById('pos-response-opt-balanced');
      if (responseOptBalanced) responseOptBalanced.textContent = t('responseOptBalanced');
      const responseOptFocused = document.getElementById('pos-response-opt-focused');
      if (responseOptFocused) responseOptFocused.textContent = t('responseOptFocused');
      const persFontLabel = document.getElementById('pos-pers-font-label');
      if (persFontLabel) persFontLabel.textContent = t('persFontLabel');
      const fontOptRounded = document.getElementById('pos-font-opt-rounded');
      if (fontOptRounded) fontOptRounded.textContent = t('fontOptRounded');
      const fontOptFriendly = document.getElementById('pos-font-opt-friendly');
      if (fontOptFriendly) fontOptFriendly.textContent = t('fontOptFriendly');
      const fontOptClean = document.getElementById('pos-font-opt-clean');
      if (fontOptClean) fontOptClean.textContent = t('fontOptClean');
      const persThemeLabel = document.getElementById('pos-pers-theme-label');
      if (persThemeLabel) persThemeLabel.textContent = t('persThemeLabel');
      const themeOptAuto = document.getElementById('pos-theme-opt-auto');
      if (themeOptAuto) themeOptAuto.textContent = t('themeOptAuto');
      const themeOptBright = document.getElementById('pos-theme-opt-bright');
      if (themeOptBright) themeOptBright.textContent = t('themeOptBright');
      const themeOptCalm = document.getElementById('pos-theme-opt-calm');
      if (themeOptCalm) themeOptCalm.textContent = t('themeOptCalm');
      const persSubjectsLabel = document.getElementById('pos-pers-subjects-label');
      if (persSubjectsLabel) persSubjectsLabel.textContent = t('persSubjectsLabel');
      if (persSubjects) persSubjects.placeholder = t('persSubjectsPlaceholder');
      const persInterestsLabel = document.getElementById('pos-pers-interests-label');
      if (persInterestsLabel) persInterestsLabel.textContent = t('persInterestsLabel');
      if (persInterests) persInterests.placeholder = t('persInterestsPlaceholder');
      const persGoalsLabel = document.getElementById('pos-pers-goals-label');
      if (persGoalsLabel) persGoalsLabel.textContent = t('persGoalsLabel');
      if (persGoals) persGoals.placeholder = t('persGoalsPlaceholder');

      // WhatsApp section labels
      const posWhatsappTitleEl = document.getElementById('pos-whatsapp-title');
      if (posWhatsappTitleEl) posWhatsappTitleEl.textContent = t('posWhatsappTitle');
      const posParentPhoneLabelEl = document.getElementById('pos-parent-phone-label');
      if (posParentPhoneLabelEl) posParentPhoneLabelEl.textContent = t('posParentPhoneLabel');
      if (posParentPhone) posParentPhone.placeholder = t('posParentPhonePlaceholder');
      const posWhatsappConsentLabelEl = document.getElementById('pos-whatsapp-consent-label');
      if (posWhatsappConsentLabelEl) posWhatsappConsentLabelEl.textContent = t('posWhatsappConsentLabel');
      const posWhatsappRationaleEl = document.getElementById('pos-whatsapp-rationale-text');
      if (posWhatsappRationaleEl) posWhatsappRationaleEl.textContent = t('posWhatsappRationale');

      const btnPersSubmit = document.getElementById('pos-btn-pers-submit');
      if (btnPersSubmit) btnPersSubmit.textContent = t('btnPersSubmit');

      // Step 5: Success
      const successTitleEl = document.getElementById('pos-success-title');
      if (successTitleEl) successTitleEl.textContent = t('successTitle');
      const successDescEl = document.getElementById('pos-success-desc');
      if (successDescEl) successDescEl.textContent = t('successDesc');
      const btnLaunchTextEl = document.getElementById('pos-btn-launch-text');
      if (btnLaunchTextEl) btnLaunchTextEl.textContent = t('btnLaunchText');
    }

    function applyTranslations(lang) {
      currentPosLang = (lang === 'kn' || lang === 'hi') ? lang : 'en';
      applyStaticPosLabels();

      if (!modal.classList.contains('is-visible')) return;

      // Re-render whatever dynamic content is currently showing so it picks up the new language.
      const verifyWrap = document.getElementById('pos-verify-wrap');
      if (verifyWrap && verifyWrap.style.display === 'block') {
        renderVerificationView(lastVerifyEmail, lastVerifyHousehold);
      } else if (currentStep === 3) {
        renderChildStep();
      }
    }

    function setStep(step) {
      currentStep = step;
      clearAlert();

      if (stepAuth) stepAuth.style.display = step === 1 ? 'block' : 'none';

      if (stepPlan) stepPlan.style.display = step === 2 ? 'block' : 'none';
      if (stepChild) stepChild.style.display = step === 3 ? 'block' : 'none';
      if (stepPers) stepPers.style.display = step === 4 ? 'block' : 'none';
      if (stepSuccess) stepSuccess.style.display = step === 5 ? 'block' : 'none';

      // Update Step tracker dots
      if (stepTracker) {
        const dots = stepTracker.querySelectorAll('.pos-step-dot');
        dots.forEach((dot, index) => {
          if (index + 1 < step) {
            dot.className = 'pos-step-dot completed';
          } else if (index + 1 === step) {
            dot.className = 'pos-step-dot active';
          } else {
            dot.className = 'pos-step-dot';
          }
        });
      }
    }

    let lastFocusedElement = null;

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function openModal(preferredStep) {
      lastFocusedElement = document.activeElement;
      modal.classList.add('is-visible');
      modal.setAttribute('aria-hidden', 'false');
      clearAlert();

      // BETA: label the modal clearly as beta signup, not the normal paid-plan setup copy.
      // (applyStaticPosLabels() already applies the correct kicker/title/lead for beta vs.
      // normal mode, in the current language, so just re-apply it here on open.)
      applyStaticPosLabels();

      const shell = typeof window !== 'undefined' ? window.ParentOnboardingShell : null;
      const isAuthed = shell && shell.state.session;

      if (preferredStep === 1) {
        setStep(1);
      } else if (preferredStep === 2) {
        renderPlansStep();
      } else if (preferredStep === 3) {
        renderChildStep();
      } else if (isAuthed) {
        const sub = shell.state.subscription;
        if (sub && sub.status === 'ACTIVE') {
          // If child selection required or multiple learners, route to step 3
          if (shell.state.authStatus === 'CHILD_SELECTION_REQUIRED' || !shell.state.selectedChild) {
            renderChildStep();
          } else {
            renderPlansStep();
          }
        } else {
          renderPlansStep();
        }
      } else {
        setStep(1);
      }

      // If returning with email verification confirmation on a device without automatic session:
      if (!isAuthed && typeof window !== 'undefined' && window.location) {
        const hash = window.location.hash || '';
        if (hash.includes('type=signup') || hash.includes('type=email_verification')) {
          showAlert(t('emailVerifiedSuccess'), 'success');
        }
      }

      // Place focus inside modal safely
      window.requestAnimationFrame(() => {
        if (modal.classList.contains('is-visible')) {
          if (btnClose && typeof btnClose.focus === 'function') {
            btnClose.focus();
          } else if (modal && typeof modal.focus === 'function') {
            modal.focus();
          }
        }
      });
    }

    function closeModal() {
      // Restore focus to opener element BEFORE setting aria-hidden='true' to avoid:
      // "Blocked aria-hidden on an element because its descendant retained focus."
      if (modal.contains(document.activeElement)) {
        if (lastFocusedElement && typeof lastFocusedElement.focus === 'function' && lastFocusedElement.isConnected) {
          lastFocusedElement.focus();
        } else if (btnOpen && typeof btnOpen.focus === 'function' && btnOpen.isConnected) {
          btnOpen.focus();
        } else if (document.activeElement && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
      }
      modal.classList.remove('is-visible');
      modal.setAttribute('aria-hidden', 'true');
    }

    if (btnOpen) btnOpen.addEventListener('click', openModal);
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnSkip) btnSkip.addEventListener('click', closeModal);
    if (btnHeroGetStarted) {
      btnHeroGetStarted.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    }

    // Modal background dismiss
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeModal();
      }
    });

    // -------------------------------------------------------------
    // Step 1: Auth Tabs & Form
    // -------------------------------------------------------------
    function renderVerificationView(email, householdName = 'Family') {
      clearAlert();
      lastVerifyEmail = email;
      lastVerifyHousehold = householdName;
      let verifyWrap = document.getElementById('pos-verify-wrap');
      if (!verifyWrap) {
        verifyWrap = document.createElement('div');
        verifyWrap.id = 'pos-verify-wrap';
        if (stepAuth) stepAuth.appendChild(verifyWrap);
      }

      const tabsWrap = stepAuth?.querySelector('.pos-tabs');
      if (tabsWrap) tabsWrap.style.display = 'none';
      if (authForm) authForm.style.display = 'none';
      verifyWrap.style.display = 'block';

      verifyWrap.innerHTML = `
        <div id="pos-verify-container" class="pos-verify-card">
          <div class="pos-verify-icon-wrap">
            <i class="fa-solid fa-envelope-circle-check text-cyan"></i>
          </div>
          <h3 class="pos-verify-title">${t('verifyTitle')}</h3>
          <p class="pos-verify-lead">
            ${t('verifyLead').replace('{email}', `<strong class="text-cyan">${escapeHtml(email)}</strong>`)}
          </p>
          <p class="pos-verify-sub">
            ${t('verifySub')}
          </p>
          <div id="pos-verify-feedback" class="pos-alert" style="display:none; width: 100%;"></div>
          <div class="pos-verify-actions">
            <button id="pos-btn-check-verification" class="primary-modal-btn" type="button">
              <i class="fa-solid fa-arrows-rotate"></i> ${t('btnCheckVerification')}
            </button>
            <button id="pos-btn-resend-verification" class="pos-secondary-btn" type="button">
              <i class="fa-solid fa-paper-plane"></i> ${t('btnResendVerification')}
            </button>
            <button id="pos-btn-back-signin" class="pos-link-btn" type="button">
              ${t('btnBackSignin')}
            </button>
          </div>
        </div>
      `;

      const btnCheck = document.getElementById('pos-btn-check-verification');
      const btnResend = document.getElementById('pos-btn-resend-verification');
      const btnBack = document.getElementById('pos-btn-back-signin');
      const feedback = document.getElementById('pos-verify-feedback');

      function showVerifyFeedback(msg, type = 'info') {
        if (!feedback) return;
        feedback.textContent = msg;
        feedback.className = `pos-alert ${type}`;
        feedback.style.display = 'block';
      }

      if (btnCheck) {
        btnCheck.addEventListener('click', async () => {
          btnCheck.disabled = true;
          btnCheck.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${t('checkingVerification')}`;
          try {
            const result = typeof window.ParentOnboardingShell?.checkEmailVerificationSession === 'function'
              ? await window.ParentOnboardingShell.checkEmailVerificationSession({ householdName })
              : await window.ParentOnboardingShell.restoreSession();

            if (result && result.session && result.status !== 'UNAUTHENTICATED') {
              if (verifyWrap) verifyWrap.style.display = 'none';
              await renderPlansStep({ refresh: true });
            } else {
              showVerifyFeedback(t('notYetVerifiedMsg'), 'info');
            }
          } catch (err) {
            showVerifyFeedback(err.message || t('checkVerificationErrorDefault'), 'error');
          } finally {
            if (btnCheck) {
              btnCheck.disabled = false;
              btnCheck.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> ${t('btnCheckVerification')}`;
            }
          }
        });
      }

      let resendCooldownTimer = null;
      if (btnResend) {
        btnResend.addEventListener('click', async () => {
          btnResend.disabled = true;
          btnResend.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${t('sendingResend')}`;
          try {
            if (typeof window.ParentOnboardingShell?.resendVerificationEmail === 'function') {
              await window.ParentOnboardingShell.resendVerificationEmail(email);
            }
            showVerifyFeedback(t('resendSuccessMsg').replace('{email}', email), 'success');
            let cooldown = 30;
            btnResend.innerHTML = t('resendInSeconds').replace('{s}', cooldown);
            resendCooldownTimer = setInterval(() => {
              cooldown -= 1;
              if (cooldown <= 0) {
                clearInterval(resendCooldownTimer);
                if (btnResend) {
                  btnResend.disabled = false;
                  btnResend.innerHTML = `<i class="fa-solid fa-paper-plane"></i> ${t('btnResendVerification')}`;
                }
              } else {
                if (btnResend) {
                  btnResend.innerHTML = t('resendInSeconds').replace('{s}', cooldown);
                }
              }
            }, 1000);
          } catch (err) {
            showVerifyFeedback(err.message || t('resendErrorDefault'), 'error');
            btnResend.disabled = false;
            btnResend.innerHTML = `<i class="fa-solid fa-paper-plane"></i> ${t('btnResendVerification')}`;
          }
        });
      }

      if (btnBack) {
        btnBack.addEventListener('click', () => {
          restoreAuthFormToSignIn(email);
        });
      }
    }

    function restoreAuthFormToSignIn(prefillEmail = '') {
      const verifyWrap = document.getElementById('pos-verify-wrap');
      if (verifyWrap) verifyWrap.style.display = 'none';

      const tabsWrap = stepAuth?.querySelector('.pos-tabs');
      if (tabsWrap) tabsWrap.style.display = 'flex';
      if (authForm) authForm.style.display = 'block';

      isSignUpMode = false;
      if (tabLogin) tabLogin.classList.add('active');
      if (tabSignup) tabSignup.classList.remove('active');
      if (authHouseholdWrap) authHouseholdWrap.style.display = 'none';
      if (btnAuthSubmit) btnAuthSubmit.textContent = t('btnAuthSubmitSignIn');
      if (prefillEmail && authEmail) {
        authEmail.value = prefillEmail;
      }
      if (authPassword) {
        authPassword.value = '';
        authPassword.focus();
      }
      clearAlert();
    }

    if (tabLogin && tabSignup) {
      tabLogin.addEventListener('click', () => {
        restoreAuthFormToSignIn(authEmail ? authEmail.value : '');
      });

      tabSignup.addEventListener('click', () => {
        const verifyWrap = document.getElementById('pos-verify-wrap');
        if (verifyWrap) verifyWrap.style.display = 'none';
        const tabsWrap = stepAuth?.querySelector('.pos-tabs');
        if (tabsWrap) tabsWrap.style.display = 'flex';
        if (authForm) authForm.style.display = 'block';

        isSignUpMode = true;
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
        if (authHouseholdWrap) authHouseholdWrap.style.display = 'grid';
        if (btnAuthSubmit) btnAuthSubmit.textContent = t('btnAuthSubmitSignUp');
        clearAlert();
      });
    }

    if (authForm) {
      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert();

        const email = authEmail.value.trim();
        const password = authPassword.value.trim();
        const householdName = authHousehold?.value?.trim() || 'Family';

        if (!email || !password) {
          showAlert(t('alertEnterBoth'));
          return;
        }

        try {
          if (btnAuthSubmit) {
            btnAuthSubmit.disabled = true;
            btnAuthSubmit.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${isSignUpMode ? t('authCreatingAccount') : t('authenticating')}`;
          }

          const authState = await window.ParentOnboardingShell.signInParent({
            email,
            password,
            isSignUp: isSignUpMode,
            householdName
          });

          if (authState.status === 'VERIFICATION_REQUIRED' || authState.needsVerification) {
            renderVerificationView(email, householdName);
            return;
          }

          await renderPlansStep({ refresh: !authState.synchronized });
        } catch (err) {
          showAlert(err.message || t('authFailedDefault'), 'error');
        } finally {
          if (btnAuthSubmit) {
            btnAuthSubmit.disabled = false;
            btnAuthSubmit.textContent = isSignUpMode ? t('btnAuthSubmitSignUp') : t('btnAuthSubmitSignIn');
          }
        }
      });
    }

    // -------------------------------------------------------------
    // Step 2: Current Plan Summary & Subscription View
    // -------------------------------------------------------------
    async function renderPlansStep({ refresh = true } = {}) {
      // BETA: no plan selection at all -- straight to child/personalisation setup.
      // Remove this block to restore normal plan-selection step once beta ends.
      if (typeof APPU_CONFIG !== 'undefined' && APPU_CONFIG.betaMode) {
        if (refresh) {
          await Promise.all([
            window.ParentOnboardingShell.fetchCurrentSubscription().catch(() => null),
            window.ParentOnboardingShell.fetchUsageSummary().catch(() => null),
            window.ParentOnboardingShell.fetchChildren().catch(() => [])
          ]);
        }
        return renderChildStep();
      }

      setStep(2);
      if (plansContainer) {
        plansContainer.innerHTML = '<div class="pos-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading subscription details...</div>';
      }

      try {
        if (refresh) {
          await Promise.all([
            window.ParentOnboardingShell.fetchPlans(),
            window.ParentOnboardingShell.fetchCurrentSubscription(),
            window.ParentOnboardingShell.fetchUsageSummary().catch(() => null),
            window.ParentOnboardingShell.fetchChildren().catch(() => [])
          ]);
        }

        const vm = window.ParentOnboardingShell.getSubscriptionViewModel();
        if (!plansContainer) return;
        plansContainer.innerHTML = '';

        const cleanPlanName = (vm.planName || 'APPU Free').replace(/\s+Plan$/i, '').trim();

        if (vm.isPaidAccess) {
          // ACTIVE PLAN FULL-WIDTH DASHBOARD SUMMARY
          const currentPlanCard = document.createElement('div');
          currentPlanCard.className = 'pos-current-plan-dashboard';

          const pctAiUsed = Math.min(100, Math.round((vm.aiSessions.used / (vm.aiSessions.limit || 1)) * 100));
          const pctVoiceUsed = vm.voiceMinutes.used !== null
            ? Math.min(100, Math.round((vm.voiceMinutes.used / (vm.voiceMinutes.limit || 1)) * 100))
            : 0;

          const voiceStatusPill = vm.voiceMinutes.meteringStatus === 'active'
            ? `<span class="pos-pill-sm" style="background:rgba(34,197,94,.15);color:#22c55e;margin-left:4px;">Active</span>`
            : `<span class="pos-pill-sm" style="background:rgba(148,163,184,.15);color:#94a3b8;margin-left:4px;">Metering pending</span>`;

          const voiceMetricBox = `
            <div class="pos-dashboard-metric-box">
              <div class="pos-metric-header">
                <div class="pos-metric-title">
                  <i class="fa-solid fa-microphone text-cyan"></i>
                  <span>Voice Minutes (Monthly)</span>
                  ${voiceStatusPill}
                </div>
                <strong class="pos-metric-count">${vm.voiceMinutes.used !== null ? vm.voiceMinutes.used : 0} / ${vm.voiceMinutes.limit} min</strong>
              </div>
              <div class="pos-meter-track">
                <div class="pos-meter-fill" style="width: ${pctVoiceUsed}%;"></div>
              </div>
              <div class="pos-metric-sub">
                <span>${vm.voiceMinutes.remaining !== null ? vm.voiceMinutes.remaining : vm.voiceMinutes.limit} min remaining</span>
                <span>${pctVoiceUsed}% used</span>
              </div>
            </div>
          `;

          currentPlanCard.innerHTML = `
            <div class="pos-dashboard-header">
              <div class="pos-dashboard-plan-meta">
                <span class="pos-kicker">YOUR CURRENT SUBSCRIPTION</span>
                <div class="pos-dashboard-title-row">
                  <h3>${cleanPlanName}</h3>
                  <div class="pos-dashboard-price-pill">${vm.displayPrice} <span>/ ${vm.billingInterval || 'month'}</span></div>
                </div>
                <p class="pos-dashboard-msg">${vm.statusMessage}</p>
              </div>
              <div class="pos-status-pill active"><i class="fa-solid fa-circle-check"></i> ACTIVE</div>
            </div>

            <div class="pos-dashboard-metrics-grid">
              <div class="pos-dashboard-metric-box">
                <div class="pos-metric-header">
                  <div class="pos-metric-title">
                    <i class="fa-solid fa-bolt text-cyan"></i>
                    <span>AI Sessions (Monthly)</span>
                  </div>
                  <strong class="pos-metric-count">${vm.aiSessions.used} / ${vm.aiSessions.limit}</strong>
                </div>
                <div class="pos-meter-track">
                  <div class="pos-meter-fill" style="width: ${pctAiUsed}%;"></div>
                </div>
                <div class="pos-metric-sub">
                  <span>${vm.aiSessions.remaining} remaining</span>
                  <span>${pctAiUsed}% used</span>
                </div>
              </div>

              ${voiceMetricBox}
            </div>

            <div class="pos-dashboard-actions">
              <button id="pos-btn-continue-plan" class="primary-modal-btn" type="button">
                <span>Continue with ${cleanPlanName}</span>
                <i class="fa-solid fa-arrow-right"></i>
              </button>
              <button id="pos-btn-toggle-plans" class="pos-secondary-btn" type="button">
                <i class="fa-solid fa-table-columns"></i> View / Compare Plans
              </button>
            </div>

            <div id="pos-compare-grid-wrap" style="display: none; margin-top: 20px; width: 100%;">
              <p class="pos-subtitle">All Learning Companion Plans:</p>
              <div id="pos-compare-section-container"></div>
            </div>
          `;

          plansContainer.appendChild(currentPlanCard);

          const btnContinue = currentPlanCard.querySelector('#pos-btn-continue-plan');
          if (btnContinue) {
            btnContinue.addEventListener('click', () => renderChildStep());
          }

          const btnToggle = currentPlanCard.querySelector('#pos-btn-toggle-plans');
          const compareWrap = currentPlanCard.querySelector('#pos-compare-grid-wrap');
          const compareContainer = currentPlanCard.querySelector('#pos-compare-section-container');

          if (btnToggle && compareWrap && compareContainer) {
            btnToggle.addEventListener('click', () => {
              const isHidden = compareWrap.style.display === 'none';
              compareWrap.style.display = isHidden ? 'block' : 'none';
              btnToggle.innerHTML = isHidden
                ? '<i class="fa-solid fa-chevron-up"></i> Hide Plan Comparison'
                : '<i class="fa-solid fa-table-columns"></i> View / Compare Plans';

              if (isHidden && compareContainer.children.length === 0) {
                renderPricingSection(compareContainer, {
                  currentPlanCode: vm.planCode,
                  defaultInterval: (vm.planCode?.includes('annual') || vm.planCode?.includes('yearly')) ? 'yearly' : 'monthly',
                  onPlanActivated: renderPlansStep
                });
              }
            });
          }

        } else if (vm.hasSubscription && !vm.isPaidAccess) {
          // NON-ACTIVE SUBSCRIPTION STATUS CARD
          const subNotice = document.createElement('div');
          subNotice.className = 'pos-current-plan-dashboard';
          subNotice.innerHTML = `
            <div class="pos-dashboard-header">
              <div class="pos-dashboard-plan-meta">
                <span class="pos-kicker">SUBSCRIPTION STATUS</span>
                <div class="pos-dashboard-title-row">
                  <h3>${cleanPlanName}</h3>
                </div>
                <p class="pos-dashboard-msg">${vm.statusMessage}</p>
              </div>
              <div class="pos-status-pill ${vm.statusBadgeClass}">${vm.statusLabel}</div>
            </div>
            <div class="pos-dashboard-actions" style="margin-top: 10px;">
              <button id="pos-btn-activate-plan" class="primary-modal-btn" type="button">
                <span>Select Plan to Activate</span>
                <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>
            <div id="pos-plans-select-grid-wrap" style="display:none; margin-top: 20px; width: 100%;">
              <div id="pos-plans-select-grid"></div>
            </div>
          `;

          plansContainer.appendChild(subNotice);

          const btnAct = subNotice.querySelector('#pos-btn-activate-plan');
          const gridWrap = subNotice.querySelector('#pos-plans-select-grid-wrap');
          const gridContainer = subNotice.querySelector('#pos-plans-select-grid');
          if (btnAct && gridWrap && gridContainer) {
            btnAct.addEventListener('click', () => {
              gridWrap.style.display = 'block';
              btnAct.style.display = 'none';
              renderPricingSection(gridContainer, {
                currentPlanCode: null,
                defaultInterval: 'monthly',
                onPlanActivated: renderChildStep
              });
            });
          }

        } else {
          // NO SUBSCRIPTION: RENDER SELECTION VIEW WITH PROMINENT MONTHLY/ANNUAL TOGGLE
          const gridTitle = document.createElement('p');
          gridTitle.className = 'pos-subtitle';
          gridTitle.textContent = 'Choose an APPU AI Learning Companion Plan:';
          plansContainer.appendChild(gridTitle);

          const pricingContainer = document.createElement('div');
          pricingContainer.className = 'pos-pricing-root';
          plansContainer.appendChild(pricingContainer);

          renderPricingSection(pricingContainer, {
            currentPlanCode: null,
            defaultInterval: 'monthly',
            onPlanActivated: renderChildStep
          });
        }

      } catch (err) {
        showAlert(err.message || 'Failed to load plans');
      }
    }

    /**
     * Renders prominent Monthly / Annual toggle and exactly 4 tier-grouped cards
     * with outcome-focused content, annual savings, and Genesis contextual upsell.
     */
    function renderPricingSection(container, options = {}) {
      const currentPlanCode = options.currentPlanCode || null;
      let currentInterval = options.defaultInterval || ((currentPlanCode?.includes('annual') || currentPlanCode?.includes('yearly')) ? 'yearly' : 'monthly');
      const onPlanActivated = options.onPlanActivated || renderChildStep;

      container.innerHTML = '';

      // 1. Prominent Frequency Toggle: Monthly -> Annual
      const toggleWrap = document.createElement('div');
      toggleWrap.className = 'pos-billing-toggle-wrap';
      toggleWrap.innerHTML = `
        <div class="pos-billing-toggle" role="radiogroup" aria-label="Billing frequency">
          <button type="button" class="pos-billing-btn ${currentInterval === 'monthly' ? 'active' : ''}" data-interval="monthly" role="radio" aria-checked="${currentInterval === 'monthly'}">
            Monthly
          </button>
          <button type="button" class="pos-billing-btn ${currentInterval === 'yearly' ? 'active' : ''}" data-interval="yearly" role="radio" aria-checked="${currentInterval === 'yearly'}">
            Annual <span class="pos-billing-save-badge">Save up to 17%</span>
          </button>
        </div>
        <div class="pos-billing-caption">
          <i class="fa-solid fa-sparkles text-cyan"></i>
          <span>Flexible learning plans. Save up to 17% with annual billing.</span>
        </div>
      `;
      container.appendChild(toggleWrap);

      // 2. Primary 4-Cards Grid
      const grid = document.createElement('div');
      grid.className = 'pos-plans-grid';
      container.appendChild(grid);

      // 3. Genesis Contextual Upsell Strip (Below Primary Grid)
      const upsellWrap = document.createElement('div');
      upsellWrap.className = 'pos-genesis-upsell';
      upsellWrap.innerHTML = `
        <div class="pos-genesis-text">
          <i class="fa-solid fa-sparkles text-cyan" style="margin-right: 6px;"></i>
          <span>Need deeper personalisation and continuous Learning DNA coaching?</span>
        </div>
        <button type="button" class="pos-link-btn pos-btn-toggle-genesis">
          Explore APPU Genesis →
        </button>
      `;
      container.appendChild(upsellWrap);

      const genesisDetail = document.createElement('div');
      genesisDetail.className = 'pos-genesis-detail-box';
      genesisDetail.style.display = 'none';
      container.appendChild(genesisDetail);

      const btnToggleGenesis = upsellWrap.querySelector('.pos-btn-toggle-genesis');
      if (btnToggleGenesis) {
        btnToggleGenesis.addEventListener('click', () => {
          const isHidden = genesisDetail.style.display === 'none';
          genesisDetail.style.display = isHidden ? 'block' : 'none';
          btnToggleGenesis.textContent = isHidden
            ? 'Hide APPU Genesis Details'
            : 'Explore APPU Genesis →';
          if (isHidden) {
            renderGenesisDetailCard(genesisDetail, currentInterval, currentPlanCode);
          }
        });
      }

      function renderGenesisDetailCard(box, interval, activeCode) {
        const allTiers = (window.ParentOnboardingShell.groupPlansByTier && window.ParentOnboardingShell.groupPlansByTier()) || [];
        const genesisTier = allTiers.find((t) => t.tierCode === 'genesis') || {
          tierCode: 'genesis',
          tierName: 'APPU Genesis',
          description: 'Complete multimodal cognitive architecture with bespoke learning DNA and continuous coaching.',
          monthly: { code: 'genesis_monthly', amountPaise: 249900 },
          annual: { code: 'genesis_annual', amountPaise: 2499900 }
        };

        const genesisPlan = interval === 'yearly' ? genesisTier.annual : genesisTier.monthly;
        const targetCode = genesisPlan?.code || (interval === 'yearly' ? 'genesis_annual' : 'genesis_monthly');
        const isCurrent = activeCode === targetCode;
        // BETA: hide real pricing, show free-beta access instead. Remove to restore.
        const isBeta = typeof APPU_CONFIG !== 'undefined' && APPU_CONFIG.betaMode;
        const priceText = isBeta ? 'Free' : (interval === 'yearly' ? '₹24,999/year' : '₹2,499/month');
        const equivText = isBeta ? 'No payment required' : (interval === 'yearly' ? '₹2,083/mo billed annually • Save ₹4,989/yr' : 'Billed monthly');

        box.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
            <div>
              <span class="pos-kicker" style="color:#c084fc;">SPECIALIZED COGNITIVE ARCHITECTURE</span>
              <h4 style="margin:2px 0 0; color:#fff; font-size:16px;">APPU Genesis Tier</h4>
            </div>
            <span class="pos-badge bespoke">COGNITIVE DNA</span>
          </div>
          <div class="pos-price" style="font-size:18px; color:#c084fc; margin-bottom:2px;">${priceText}</div>
          <div class="pos-equiv-sub" style="margin-bottom:8px;">${equivText}</div>
          <div class="pos-plan-quota-badge" style="border-color:rgba(192,132,252,.3); background:rgba(192,132,252,.08); color:#e9d5ff; margin-bottom:10px;">
            <i class="fa-solid fa-bolt"></i> 1,000 AI sessions • 300 voice mins / mo
          </div>
          <p style="margin:0 0 10px; font-size:12px; color:#cbd5e1;">${genesisTier.description}</p>
          <ul class="pos-features" style="margin-bottom:12px;">
            <li><i class="fa-solid fa-check text-cyan"></i> Complete multimodal cognitive memory & learning DNA</li>
            <li><i class="fa-solid fa-check text-cyan"></i> Continuous 1-on-1 mentor guidance & goal mastery</li>
            <li><i class="fa-solid fa-check text-cyan"></i> Bespoke learning blueprints & priority advisory</li>
          </ul>
          ${
            isCurrent
              ? `<button class="pos-plan-btn current" type="button" disabled>Current Active Plan</button>`
              : `<button class="pos-plan-btn bespoke pos-btn-select-genesis" type="button" data-code="${targetCode}">Get Genesis (${priceText})</button>`
          }
        `;

        const btnGenesis = box.querySelector('.pos-btn-select-genesis');
        if (btnGenesis) {
          btnGenesis.addEventListener('click', async () => {
            try {
              btnGenesis.disabled = true;
              btnGenesis.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Starting Checkout...';
              await window.ParentOnboardingShell.subscribeToPlan(targetCode, (status) => {
                if (planStatusText) planStatusText.textContent = status;
              });
              await onPlanActivated();
            } catch (err) {
              showAlert(err.message || 'Subscription failed');
            } finally {
              btnGenesis.disabled = false;
              btnGenesis.textContent = `Get Genesis (${priceText})`;
              if (planStatusText) planStatusText.textContent = '';
            }
          });
        }
      }

      function renderCards() {
        grid.innerHTML = '';
        const allTiers = (window.ParentOnboardingShell.groupPlansByTier && window.ParentOnboardingShell.groupPlansByTier()) || [];
        const primaryTiers = allTiers.filter((t) => t.isPrimaryCard);

        primaryTiers.forEach((tier) => {
          const card = document.createElement('div');
          const isFree = tier.tierCode === 'free';
          const isSignature = tier.tierCode === 'signature';
          const isEvolvePlus = tier.tierCode === 'evolve_plus';

          const plan = isFree
            ? (tier.monthly || tier.annual)
            : isSignature
            ? ((currentInterval === 'yearly' ? tier.annual : tier.monthly) || tier.monthly || tier.annual)
            : (currentInterval === 'yearly' ? tier.annual : tier.monthly);

          const targetPlanCode = plan?.code || (isFree ? 'free' : isSignature ? 'signature' : `${tier.tierCode}_${currentInterval === 'yearly' ? 'annual' : 'monthly'}`);
          const isCurrent = currentPlanCode === targetPlanCode || (isFree && currentPlanCode === 'free');

          card.className = `pos-plan-card ${isEvolvePlus ? 'featured' : ''} ${isCurrent ? 'current' : ''}`;
          card.setAttribute('data-tier', tier.tierCode);

          // Badges
          let badgeHtml = '';
          if (isCurrent) {
            badgeHtml = '<span class="pos-badge current">CURRENT PLAN</span>';
          } else if (isEvolvePlus) {
            badgeHtml = '<span class="pos-badge">MOST POPULAR</span>';
          } else if (isSignature) {
            badgeHtml = '<span class="pos-badge bespoke">BESPOKE</span>';
          }

          // Pricing & Subtitles
          let priceHtml = '';
          let subHtml = '';

          if (isFree) {
            priceHtml = '<div class="pos-price">₹0 <span>Forever</span></div>';
            subHtml = '<div class="pos-equiv-sub"><span class="pos-save-tag">No credit card required</span></div>';
          } else if (isSignature) {
            const sigPrice = currentInterval === 'yearly' ? 'From ₹49,999' : 'From ₹4,999';
            const sigUnit = currentInterval === 'yearly' ? 'year' : 'month';
            priceHtml = `<div class="pos-price">${sigPrice} <span>/${sigUnit}</span></div>`;
            subHtml = '<div class="pos-equiv-sub">Custom institutional architecture</div>';
          } else {
            const amountPaise = plan?.amountPaise ?? (tier.tierCode === 'evolve' ? (currentInterval === 'yearly' ? 499900 : 49900) : (currentInterval === 'yearly' ? 999900 : 99900));
            const priceNum = Math.round(amountPaise / 100);

            if (currentInterval === 'yearly') {
              const equivMo = Math.round((plan?.monthlyEquivalentPaise || (tier.tierCode === 'evolve' ? 41700 : 83300)) / 100);
              const savings = Math.round((plan?.annualSavingsPaise || (tier.tierCode === 'evolve' ? 98900 : 198900)) / 100);
              const pct = tier.tierCode === 'evolve' ? '~16%' : '~17%';
              priceHtml = `<div class="pos-price">₹${priceNum.toLocaleString('en-IN')} <span>/year</span></div>`;
              subHtml = `<div class="pos-equiv-sub">₹${equivMo}/mo billed annually • <span class="pos-save-tag">Save ₹${savings.toLocaleString('en-IN')}/yr (${pct})</span></div>`;
            } else {
              priceHtml = `<div class="pos-price">₹${priceNum.toLocaleString('en-IN')} <span>/month</span></div>`;
              subHtml = '<div class="pos-equiv-sub">Billed monthly</div>';
            }
          }

          // BETA: hide real pricing, show free-beta access instead. Remove this block to restore.
          if (typeof APPU_CONFIG !== 'undefined' && APPU_CONFIG.betaMode) {
            priceHtml = '<div class="pos-price">Free <span>during Beta</span></div>';
            subHtml = '<div class="pos-equiv-sub"><span class="pos-save-tag">No payment required</span></div>';
          }

          // Quota Badges
          let quotaBadge = '';
          if (isFree) {
            quotaBadge = '<div class="pos-plan-quota-badge"><i class="fa-solid fa-bolt"></i> 20 AI sessions • 5 voice mins / mo</div>';
          } else if (tier.tierCode === 'evolve') {
            quotaBadge = '<div class="pos-plan-quota-badge"><i class="fa-solid fa-bolt"></i> 150 AI sessions • 45 voice mins / mo</div>';
          } else if (isEvolvePlus) {
            quotaBadge = '<div class="pos-plan-quota-badge"><i class="fa-solid fa-bolt"></i> 400 AI sessions • 120 voice mins / mo</div>';
          } else if (isSignature) {
            quotaBadge = '<div class="pos-plan-quota-badge"><i class="fa-solid fa-bolt"></i> Custom capacity & priority SLA</div>';
          }

          // Feature bullet points (Outcome focused per HR guidelines - No learner counts)
          let featuresHtml = '';
          if (isFree) {
            featuresHtml = `
              <li><i class="fa-solid fa-check text-cyan"></i> Basic AI learning companion</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Essential subject practice & discovery</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Interactive learning questions</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Standard safety & privacy guardrails</li>
            `;
          } else if (tier.tierCode === 'evolve') {
            featuresHtml = `
              <li><i class="fa-solid fa-check text-cyan"></i> APPU remembers how you learn</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Your learning path adapts</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Learn through stories and challenges</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Weekly missions and personalised quizzes</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Multilingual learning companion</li>
            `;
          } else if (isEvolvePlus) {
            featuresHtml = `
              <li><i class="fa-solid fa-check text-cyan"></i> Everything adapts more deeply to you</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Strength and learning-gap discovery</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Advanced missions and project learning</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Goal journeys and career exploration</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Parent insights and progress intelligence</li>
            `;
          } else if (isSignature) {
            featuresHtml = `
              <li><i class="fa-solid fa-check text-cyan"></i> Custom AI & voice session allocation</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Tailored curriculum & institutional blueprints</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Dedicated learning architect & priority SLA</li>
              <li><i class="fa-solid fa-check text-cyan"></i> Custom reporting & parent advisory</li>
            `;
          }

          // Action Button
          let btnHtml = '';
          if (isCurrent) {
            btnHtml = `<button class="pos-plan-btn current" type="button" disabled>Current Active Plan</button>`;
          } else if (isSignature) {
            btnHtml = `<button class="pos-plan-btn bespoke pos-btn-select-plan" type="button" data-action="signature">Apply for Signature</button>`;
          } else if (isFree) {
            btnHtml = `<button class="pos-plan-btn pos-btn-select-plan" type="button" data-code="free">Start Free</button>`;
          } else {
            const btnText = currentPlanCode ? `Switch to ${tier.tierName}` : `Choose ${tier.tierName}`;
            btnHtml = `<button class="pos-plan-btn pos-btn-select-plan" type="button" data-code="${targetPlanCode}">${btnText}</button>`;
          }

          card.innerHTML = `
            ${badgeHtml}
            <h3>${tier.tierName}</h3>
            ${priceHtml}
            ${subHtml}
            ${quotaBadge}
            <p class="pos-plan-desc">${tier.description}</p>
            <ul class="pos-features">
              ${featuresHtml}
            </ul>
            ${btnHtml}
          `;

          const btnSelect = card.querySelector('.pos-btn-select-plan');
          if (btnSelect) {
            btnSelect.addEventListener('click', async () => {
              if (btnSelect.dataset.action === 'signature') {
                showAlert('Signature is our bespoke institutional solution. Please reach out to our team at support@appu.ai or schedule an advisory session.', 'success');
                return;
              }

              const selectedCode = btnSelect.dataset.code;
              if (!selectedCode) return;

              try {
                btnSelect.disabled = true;
                btnSelect.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${selectedCode === 'free' ? 'Activating Free Plan...' : 'Starting Checkout...'}`;
                await window.ParentOnboardingShell.subscribeToPlan(selectedCode, (status) => {
                  if (planStatusText) planStatusText.textContent = status;
                });
                await onPlanActivated();
              } catch (err) {
                showAlert(err.message || 'Subscription selection failed');
              } finally {
                btnSelect.disabled = false;
                btnSelect.textContent = isFree ? 'Start Free' : (currentPlanCode ? `Switch to ${tier.tierName}` : `Choose ${tier.tierName}`);
                if (planStatusText) planStatusText.textContent = '';
              }
            });
          }

          grid.appendChild(card);
        });

        if (genesisDetail.style.display === 'block') {
          renderGenesisDetailCard(genesisDetail, currentInterval, currentPlanCode);
        }
      }

      // Toggle click handlers
      toggleWrap.querySelectorAll('.pos-billing-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const newInterval = btn.dataset.interval;
          if (!newInterval || newInterval === currentInterval) return;
          currentInterval = newInterval;
          toggleWrap.querySelectorAll('.pos-billing-btn').forEach((b) => {
            b.classList.toggle('active', b.dataset.interval === currentInterval);
          });
          renderCards();
        });
      });

      renderCards();
    }

    // -------------------------------------------------------------
    // Step 3: Learner Setup & Quota-Aware Form Step
    // -------------------------------------------------------------
    async function renderChildStep() {
      setStep(3);
      if (childListContainer) {
        childListContainer.innerHTML = `<div class="pos-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> ${t('loadingLearners')}</div>`;
      }

      try {
        await window.ParentOnboardingShell.fetchChildren();
        const vm = window.ParentOnboardingShell.getSubscriptionViewModel();

        if (!childListContainer) return;
        childListContainer.innerHTML = '';

        // Compact Subscription Header
        const summaryBar = document.createElement('div');
        summaryBar.className = 'pos-compact-plan-bar';
        summaryBar.innerHTML = `
          <div>
            <span class="pos-pill-sm ${vm.statusBadgeClass}">${vm.statusLabel}</span>
            <strong>${vm.planName}</strong>
          </div>
          <span style="font-size: 11px; color: var(--muted);">${vm.displayPrice}</span>
        `;
        childListContainer.appendChild(summaryBar);

        if (vm.children.length > 0) {
          const listTitle = document.createElement('h4');
          listTitle.className = 'pos-subtitle';
          listTitle.textContent = t('learnerProfileHeading');
          childListContainer.appendChild(listTitle);

          vm.children.forEach((c) => {
            const item = document.createElement('div');
            item.className = 'pos-child-card';
            item.innerHTML = `
              <div class="pos-child-info">
                <i class="fa-solid fa-child-reaching text-cyan"></i>
                <div>
                  <strong>${escapeHtml(c.preferredName)}</strong>
                  <span>${escapeHtml(c.gradeBand)}</span>
                </div>
              </div>
              <div style="display:flex; gap: 6px;">
                <button class="pos-secondary-btn pos-btn-edit-pers" style="min-height: 32px; padding: 0 10px; font-size: 11px;" type="button" title="Edit Personalisation">
                  <i class="fa-solid fa-sliders"></i>
                </button>
                <button class="pos-child-select-btn" type="button">${t('btnSelectLearner')} <i class="fa-solid fa-arrow-right"></i></button>
              </div>
            `;

            const btnSelect = item.querySelector('.pos-child-select-btn');
            btnSelect.addEventListener('click', () => {
              window.ParentOnboardingShell.state.selectedChild = c;
              renderPersonalisationStep(c);
            });

            const btnEdit = item.querySelector('.pos-btn-edit-pers');
            if (btnEdit) {
              btnEdit.addEventListener('click', () => {
                window.ParentOnboardingShell.state.selectedChild = c;
                renderPersonalisationStep(c);
              });
            }

            childListContainer.appendChild(item);
          });
        }

        // Learner Quota Limit UX
        if (!vm.canAddLearner) {
          // Quota reached: hide child form and show informative profile active prompt
          if (childNewFormWrap) childNewFormWrap.style.display = 'none';

          const quotaNotice = document.createElement('div');
          quotaNotice.className = 'pos-quota-box';
          quotaNotice.innerHTML = `
            <i class="fa-solid fa-circle-check text-cyan"></i>
            <div>
              <strong>${t('quotaActiveTitle')}</strong>
              <p>${t('quotaActiveDesc')}</p>
              <button id="pos-btn-view-upgrade-from-quota" class="pos-link-btn" type="button">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> ${t('btnManagePlans')}
              </button>
            </div>
          `;
          childListContainer.appendChild(quotaNotice);

          const btnUp = quotaNotice.querySelector('#pos-btn-view-upgrade-from-quota');
          if (btnUp) {
            btnUp.addEventListener('click', () => renderPlansStep());
          }
        } else {
          // Quota allows adding more learners
          if (childNewFormWrap) childNewFormWrap.style.display = 'block';
        }

      } catch (err) {
        showAlert(err.message || t('childLoadErrorDefault'));
      }
    }

    if (childNewForm) {
      childNewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert();

        const preferredName = childNameInput.value.trim();
        const gradeBand = childGradeSelect.value;

        if (!preferredName || !gradeBand) {
          showAlert(t('childAlertEnterNameClass'));
          return;
        }

        try {
          const child = await window.ParentOnboardingShell.createChild({ preferredName, gradeBand });
          childNameInput.value = '';
          renderPersonalisationStep(child);
        } catch (err) {
          showAlert(err.message || t('childAddErrorDefault'));
        }
      });
    }

    function normalizeClientPhone(raw) {
      if (raw === undefined || raw === null) return null;
      const cleaned = String(raw).trim().replace(/[\s\-()]/g, '');
      if (!cleaned) return null;
      if (/^[6-9]\d{9}$/.test(cleaned)) {
        return `+91${cleaned}`;
      }
      if (/^91[6-9]\d{9}$/.test(cleaned)) {
        return `+${cleaned}`;
      }
      if (cleaned.startsWith('+')) {
        if (/^\+[1-9]\d{6,14}$/.test(cleaned)) {
          return cleaned;
        }
        return false;
      }
      if (/^\d{7,15}$/.test(cleaned)) {
        const withPlus = `+${cleaned}`;
        if (/^\+[1-9]\d{6,14}$/.test(withPlus)) {
          return withPlus;
        }
      }
      return false;
    }

    // -------------------------------------------------------------
    // Step 4: Personalisation Questionnaire Step
    // -------------------------------------------------------------
    async function renderPersonalisationStep(child) {
      setStep(4);
      const title = document.getElementById('pos-pers-child-name');
      if (title) title.textContent = child.preferredName;

      if (posParentPhone) posParentPhone.value = '';
      if (posWhatsappConsent) posWhatsappConsent.checked = false;

      try {
        const [pers, notif] = await Promise.all([
          window.ParentOnboardingShell.fetchPersonalisation(child.id).catch(() => null),
          (typeof window.ParentOnboardingShell.fetchNotificationPreferences === 'function'
            ? window.ParentOnboardingShell.fetchNotificationPreferences().catch(() => null)
            : null)
        ]);

        if (pers) {
          if (persLang) persLang.value = pers.preferredLanguage || 'en';
          if (persStyle) persStyle.value = pers.learningStyle || 'interactive';
          if (persFont) persFont.value = pers.fontPreference || 'rounded';
          if (persResponse) persResponse.value = pers.responseStyle || 'playful';
          if (persTheme) persTheme.value = pers.themePreference || 'auto';
          if (persInterests) persInterests.value = (pers.interests || []).join(', ');
          if (persSubjects) persSubjects.value = (pers.favoriteSubjects || []).join(', ');
          if (persGoals) persGoals.value = (pers.goals || []).join(', ');
        }

        if (notif) {
          if (posParentPhone && notif.parentPhone) posParentPhone.value = notif.parentPhone;
          if (posWhatsappConsent) posWhatsappConsent.checked = Boolean(notif.whatsappConsent);
        }
      } catch {
        // Safe default fallback
      }
    }

    if (persForm) {
      persForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert();

        const child = window.ParentOnboardingShell.state.selectedChild;
        if (!child) {
          showAlert(t('alertNoChildSelected'));
          return;
        }

        // Validate optional parent phone and WhatsApp consent
        const rawPhone = posParentPhone?.value?.trim() || '';
        const consentChecked = Boolean(posWhatsappConsent?.checked);

        let parentPhone = null;
        let whatsappConsent = false;

        if (rawPhone) {
          const normalized = normalizeClientPhone(rawPhone);
          if (normalized === false) {
            showAlert(t('phoneInvalidAlert') || 'Please enter a valid phone number (e.g., 9876543210 or +919876543210).');
            return;
          }
          parentPhone = normalized;
          whatsappConsent = consentChecked;
        } else {
          if (consentChecked) {
            showAlert(t('phoneRequiredForConsentAlert') || 'Please enter your phone number to receive WhatsApp updates, or uncheck the box.');
            return;
          }
          parentPhone = null;
          whatsappConsent = false;
        }

        const parseList = (str) =>
          str
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0 && s.length < 50);

        const personalisationData = {
          preferredLanguage: persLang?.value || 'en',
          learningStyle: persStyle?.value || 'interactive',
          fontPreference: persFont?.value || 'rounded',
          responseStyle: persResponse?.value || 'playful',
          themePreference: persTheme?.value || 'auto',
          favoriteColor: '#1f6feb',
          interests: parseList(persInterests?.value || 'science, space'),
          favoriteSubjects: parseList(persSubjects?.value || 'Science, Mathematics'),
          goals: parseList(persGoals?.value || 'Learn conceptually and have fun'),
          parentPhone,
          whatsappConsent
        };

        try {
          await window.ParentOnboardingShell.savePersonalisation(child.id, personalisationData);
          setStep(5);
        } catch (err) {
          showAlert(err.message || t('persSaveErrorDefault'));
        }
      });
    }

    // -------------------------------------------------------------
    // Step 5: Launch Appu Session Handoff
    // -------------------------------------------------------------
    if (btnLaunchAppu) {
      btnLaunchAppu.addEventListener('click', () => {
        const child = window.ParentOnboardingShell.state.selectedChild;
        window.ParentOnboardingShell.launchAppuSession(child);
        closeModal();

        // Trigger welcome voice greeting in Appu (uses the learner's chosen personalisation
        // language from Step 4, which may differ from the parent's UI language above).
        if (typeof window.app !== 'undefined' && typeof window.app.handleUserInteraction === 'function') {
          const lang = persLang?.value || 'en';
          const LAUNCH_GREETINGS = {
            en: (name) => `Hi ${name}! I'm Appu, your personal AI learning companion. What would you like to explore today?`,
            kn: (name) => `ನಮಸ್ಕಾರ ${name}! ನಾನು ಅಪ್ಪು, ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ಕಲಿಕೆಯ ಸ್ನೇಹಿತ. ಇಂದು ನಾವು ಏನು ಕಲಿಯೋಣ?`,
            hi: (name) => `नमस्ते ${name}! मैं अप्पू हूं, आपका व्यक्तिगत एआई लर्निंग साथी। आज हम क्या सीखना चाहेंगे?`
          };
          const greet = LAUNCH_GREETINGS[lang] || LAUNCH_GREETINGS.en;
          window.app.handleUserInteraction(greet(child.preferredName));
        }
      });
    }

    // Apply the current language to the modal's static labels right away, so it's correct
    // the first time it's opened (independent of when app.js's setLanguage() runs).
    applyStaticPosLabels();

    activeOpenModal = openModal;
    activeCloseModal = closeModal;
    activeApplyTranslations = applyTranslations;
  }

  let activeOpenModal = null;
  let activeCloseModal = null;
  let activeApplyTranslations = null;

  return {
    init,
    openModal: (step) => { if (activeOpenModal) activeOpenModal(step); },
    closeModal: () => { if (activeCloseModal) activeCloseModal(); },
    applyTranslations: (lang) => { if (activeApplyTranslations) activeApplyTranslations(lang); }
  };
});
