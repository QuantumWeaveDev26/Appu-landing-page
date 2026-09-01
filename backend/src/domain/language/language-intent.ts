/**
 * Language Intent Detection Engine for APPU
 *
 * Resolves conversational response language using a structured priority stack:
 * 1. Explicit user language instruction in message ("in english", "explain this in english", "kannadadalli heli")
 * 2. Strong message-language evidence:
 *    a) Kannada Unicode script ([\u0C80-\u0CFF])
 *    b) Romanized Kannada / Kanglish keywords, phrases & morphological suffixes
 * 3. Explicit client requested language ONLY when 'kn' (client 'en' is a default transport fallback)
 * 4. Learner preferred language from MentorContext (for ambiguous greetings e.g. "hi", "hello", "ok")
 * 5. Safe default English
 */

export interface LanguageIntentResult {
  language: 'kn' | 'en';
  source: 'explicit_instruction' | 'kannada_script' | 'kanglish_pattern' | 'requested_language' | 'preferred_language' | 'default';
  isKanglish: boolean;
}

// 1. Explicit language overrides in message
const EXPLICIT_ENGLISH_REGEX = /\b(?:(?:reply|answer|explain|speak|talk|teach|respond|write)\s+in\s+english|in\s+english\s+please|in\s+english|english\s+nalli|english\s+alli|only\s+english|english\s+please)\b/i;
const EXPLICIT_ENGLISH_KN_SCRIPT = /(?:ಇಂಗ್ಲಿಷ್|ಇಂಗ್ಲಿಷ್ನಲ್ಲಿ|ಇಂಗ್ಲಿಷ್\s*ನಲ್ಲಿ|ಇಂಗ್ಲಿಷ್\s*ಅಲ್ಲಿ)/;

const EXPLICIT_KANNADA_REGEX = /\b(?:(?:reply|answer|explain|speak|talk|teach|respond|write)\s+in\s+kannada|in\s+kannada\s+please|in\s+kannada|kannada(?:da)?lli|kannada\s+nalli|kannada\s+alli|kannada\s+please)\b/i;
const EXPLICIT_KANNADA_KN_SCRIPT = /(?:ಕನ್ನಡದಲ್ಲಿ|ಕನ್ನಡನಲ್ಲಿ|ಕನ್ನಡ\s*ನಲ್ಲಿ|ಕನ್ನಡ\s*ಅಲ್ಲಿ)/;

// 2. Kannada Unicode Script range
const KANNADA_SCRIPT_REGEX = /[\u0C80-\u0CFF]/;

// 3. Romanized Kannada / Kanglish key markers & phrases
// High-specificity interrogatives, auxiliary verbs, pronouns, and functional particles
const KANGLISH_KEYWORDS_REGEX = /\b(?:enu|yenu|yake|yaake|hege|hyage|hegiddiya|hegidiya|hegidira|hegidiraa|yelli|elli|yaava|yaavaga|yavaga|yaaru|yaara|eshtu|yeshtu|gothilla|gothila|gotilla|gotila|gottilla|gottila|agilla|aagilla|agalla|aagalla|illa|beku|beda|bedve|madu|maadu|madodu|madabeku|madona|maadona|madi|maadi|heli|helo|helu|helona|kodi|kodu|banni|baa|nodi|nodu|gotta|gotha|aguthe|aaguthe|agutte|aagutte|bartilla|baralla|nanage|nange|nanna|neenu|neevu|nimma|ninna|namage|namma|idu|adu|ivaga|avaga|eega|aaga|ivattu|naale|swalpa|svalpa|tumba|thumba|andre|aandre|taraha|tara|kannadadalli|kannadalli|matte|mathe|houdu|haudu)\b/i;

// Multi-word Kanglish phrases with short/colloquial variants (e.g. "en madodu", "artha agilla", "artha aagilla")
const KANGLISH_PHRASES_REGEX = /\b(?:artha\s+(?:agilla|aagilla|agalla|aagalla|agutilla|aagutilla)|en\s+(?:madodu|madbeku|madabeku|aayithu|aytu|samachara|vishesha))\b/i;

// Distinctive Kannada morphological suffixes attached to words (e.g. gravity-dalli, light-ge, mirror-bagge, simple-agi)
const KANGLISH_SUFFIX_REGEX = /\b[a-zA-Z]+(?:dalli|alli|annu|inda|bagge|thara|tara|andre)\b/i;

/**
 * Detects language intent from user message, explicit requested language, and learner profile.
 *
 * NOTE ON CLIENT LANGUAGE CONTRACT:
 * The frontend client transmits `language: "en"` by default as a transport fallback.
 * Therefore, a client value of "en" is NOT treated as an explicit override over the
 * learner's `mentorContext.primaryLanguage`. Only explicit client "kn" or explicit
 * message instructions override profile preferences.
 */
export function detectLanguageIntent(
  message?: string,
  requestedLanguage?: string,
  preferredLanguage?: string
): LanguageIntentResult {
  const cleanMsg = (message || '').trim();

  // 1. Explicit language overrides in message (Highest priority)
  if (cleanMsg) {
    if (EXPLICIT_ENGLISH_REGEX.test(cleanMsg) || EXPLICIT_ENGLISH_KN_SCRIPT.test(cleanMsg)) {
      return { language: 'en', source: 'explicit_instruction', isKanglish: false };
    }
    if (EXPLICIT_KANNADA_REGEX.test(cleanMsg) || EXPLICIT_KANNADA_KN_SCRIPT.test(cleanMsg)) {
      return { language: 'kn', source: 'explicit_instruction', isKanglish: false };
    }

    // 2. Strong message evidence
    // 2a. Kannada Unicode script
    if (KANNADA_SCRIPT_REGEX.test(cleanMsg)) {
      return { language: 'kn', source: 'kannada_script', isKanglish: false };
    }

    // 2b. Romanized Kannada / Kanglish markers & phrases
    if (KANGLISH_KEYWORDS_REGEX.test(cleanMsg) || KANGLISH_PHRASES_REGEX.test(cleanMsg) || KANGLISH_SUFFIX_REGEX.test(cleanMsg)) {
      return { language: 'kn', source: 'kanglish_pattern', isKanglish: true };
    }
  }

  // 3. Explicit client requested language ONLY when 'kn' (client 'en' is a default fallback)
  const cleanRequested = (requestedLanguage || '').trim().toLowerCase();
  if (cleanRequested === 'kn') {
    return { language: 'kn', source: 'requested_language', isKanglish: false };
  }

  // 4. Learner preferred language from MentorContext for ambiguous/greeting messages
  const targetPreferred = (preferredLanguage || '').trim().toLowerCase();
  if (targetPreferred === 'kn' && isAmbiguousOrEmptyMessage(cleanMsg)) {
    return { language: 'kn', source: 'preferred_language', isKanglish: false };
  }

  // 5. Default to English
  return { language: 'en', source: 'default', isKanglish: false };
}

function isAmbiguousOrEmptyMessage(msg: string): boolean {
  if (!msg) return true;
  return /^(?:hi|hello|hey|namaste|namaskara|ok|okay|yes|no|thanks|thank\s+you|bye|gm|gn)\b[!.?]*$/i.test(msg);
}
