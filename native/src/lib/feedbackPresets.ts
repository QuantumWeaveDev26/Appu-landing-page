export interface FeedbackPresetOption {
  id: string;
  en: string;
  hi: string;
  kn: string;
}

export const WHATS_WORKING_PRESETS: FeedbackPresetOption[] = [
  {
    id: 'clear_explanations',
    en: 'Explanations are clear and easy to understand',
    hi: 'स्पष्टीकरण स्पष्ट और समझने में आसान हैं',
    kn: 'ವಿವರಣೆಗಳು ಸ್ಪಷ್ಟವಾಗಿವೆ ಮತ್ತು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಸುಲಭವಾಗಿವೆ',
  },
  {
    id: 'enjoys_learning',
    en: 'My child enjoys learning with Appu',
    hi: 'मेरा बच्चा अप्पू के साथ सीखने का आनंद लेता है',
    kn: 'ನನ್ನ ಮಗು ಅಪ್ಪು ಜೊತೆ ಕಲಿಯುವುದನ್ನು ಆನಂದಿಸುತ್ತದೆ',
  },
  {
    id: 'personalized_approach',
    en: 'The personalised, by-name approach really helps',
    hi: 'व्यक्तिगत, नाम से संबोधित करने का तरीका बहुत मददगार है',
    kn: 'ಹೆಸರಿನಿಂದ ವೈಯಕ್ತೀಕರಿಸಿದ ವಿಧಾನವು ನಿಜವಾಗಿಯೂ ಸಹಾಯ ಮಾಡುತ್ತದೆ',
  },
  {
    id: 'engaged_curious',
    en: 'It keeps my child engaged and curious',
    hi: 'यह मेरे बच्चे को व्यस्त और जिज्ञासु रखता है',
    kn: 'ಇದು ನನ್ನ ಮಗುವನ್ನು ಆಸಕ್ತಿ ಮತ್ತು ಕುತೂಹಲದಿಂದ ಇಡುತ್ತದೆ',
  },
  {
    id: 'voice_interactive',
    en: 'The voice and interactive features are great',
    hi: 'आवाज़ और इंटरैक्टिव सुविधाएं बहुत बढ़िया हैं',
    kn: 'ಧ್ವನಿ ಮತ್ತು ಸಂವಾದಾತ್ಮಕ ವೈಶಿಷ್ಟ್ಯಗಳು ಅದ್ಭುತವಾಗಿವೆ',
  },
  {
    id: 'homework_exam_help',
    en: 'Homework and exam help are genuinely useful',
    hi: 'होमवर्क और परीक्षा में सहायता वास्तव में उपयोगी है',
    kn: 'ಹೋಮ್‌ವರ್ಕ್ ಮತ್ತು ಪರೀಕ್ಷೆಯ ಸಹಾಯವು ನಿಜವಾಗಿಯೂ ಉಪಯುಕ್ತವಾಗಿದೆ',
  },
];

export const WHATS_TO_IMPROVE_PRESETS: FeedbackPresetOption[] = [
  {
    id: 'more_quizzes',
    en: 'More practice quizzes and questions',
    hi: 'अधिक अभ्यास क्विज़ और प्रश्न',
    kn: 'ಹೆಚ್ಚಿನ ಅಭ್ಯಾಸ ರಸಪ್ರಶ್ನೆಗಳು ಮತ್ತು ಪ್ರಶ್ನೆಗಳು',
  },
  {
    id: 'more_subjects',
    en: 'More subjects and chapters',
    hi: 'अधिक विषय और अध्याय',
    kn: 'ಹೆಚ್ಚಿನ ವಿಷಯಗಳು ಮತ್ತು ಅಧ್ಯಾಯಗಳು',
  },
  {
    id: 'real_world_examples',
    en: 'More real-world examples and stories',
    hi: 'अधिक वास्तविक जीवन के उदाहरण और कहानियां',
    kn: 'ಹೆಚ್ಚಿನ ನೈಜ ಪ್ರಪಂಚದ ಉದಾಹರಣೆಗಳು ಮತ್ತು ಕಥೆಗಳು',
  },
  {
    id: 'preferred_language',
    en: 'More activities in my preferred language',
    hi: 'मेरी पसंदीदा भाषा में अधिक गतिविधियां',
    kn: 'ನನ್ನ ಆದ್ಯತೆಯ ಭಾಷೆಯಲ್ಲಿ ಹೆಚ್ಚಿನ ಚಟುವಟಿಕೆಗಳು',
  },
  {
    id: 'great_as_is',
    en: "Honestly, it's great as it is!",
    hi: 'ईमानदारी से, यह जैसा है वैसा ही बहुत बढ़िया है!',
    kn: 'ನಿಜ ಹೇಳಬೇಕೆಂದರೆ, ಇದು ಈಗಿರುವುದೇ ಅದ್ಭುತವಾಗಿದೆ!',
  },
];

/**
 * Resolves the localized label for a preset option based on active language code.
 */
export function getFeedbackOptionLabel(
  option: FeedbackPresetOption,
  language: string = 'en'
): string {
  const lang = language.toLowerCase();
  if (lang.startsWith('hi')) return option.hi;
  if (lang.startsWith('kn')) return option.kn;
  return option.en;
}

/**
 * Finds a preset option by value matching any of id, en, hi, or kn text.
 */
export function findFeedbackOptionByValue(
  options: FeedbackPresetOption[],
  value?: string | null
): FeedbackPresetOption | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toLowerCase();
  return options.find(
    (opt) =>
      opt.id.toLowerCase() === trimmed ||
      opt.en.toLowerCase() === trimmed ||
      opt.hi.toLowerCase() === trimmed ||
      opt.kn.toLowerCase() === trimmed
  );
}
