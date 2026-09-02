/**
 * Language Intent Detection Engine for APPU
 *
 * Resolves conversational response language across English, Kannada, and Hindi using a structured priority stack:
 * 1. Explicit user language instruction in message ("in english", "hindi mein batao", "kannadadalli heli")
 * 2. Strong message-language evidence:
 *    a) Kannada Unicode script ([\u0C80-\u0CFF])
 *    b) Devanagari / Hindi Unicode script ([\u0900-\u097F])
 *    c) Romanized Kannada / Kanglish keywords, phrases & morphological suffixes
 *    d) Romanized Hindi / Hinglish keywords, phrases & functional markers
 * 3. Explicit client requested language ONLY when 'kn' or 'hi' (client 'en' is a default transport fallback)
 * 4. Learner preferred language from MentorContext (for ambiguous greetings e.g. "hi", "hello", "namaste")
 * 5. Safe default English
 */

export interface LanguageIntentResult {
  language: 'kn' | 'en' | 'hi';
  source: 'explicit_instruction' | 'kannada_script' | 'devanagari_script' | 'kanglish_pattern' | 'hinglish_pattern' | 'requested_language' | 'preferred_language' | 'default';
  isKanglish: boolean;
  isHinglish?: boolean;
}

// 1. Explicit language overrides in message
const EXPLICIT_ENGLISH_REGEX = /\b(?:(?:reply|answer|explain|speak|talk|teach|respond|write)\s+in\s+english|in\s+english\s+please|in\s+english|english\s+nalli|english\s+alli|english\s+mein|english\s+me|only\s+english|english\s+please)\b/i;
const EXPLICIT_ENGLISH_KN_SCRIPT = /(?:ಇಂಗ್ಲಿಷ್|ಇಂಗ್ಲಿಷ್ನಲ್ಲಿ|ಇಂಗ್ಲಿಷ್\s*ನಲ್ಲಿ|ಇಂಗ್ಲಿಷ್\s*ಅಲ್ಲಿ)/;
const EXPLICIT_ENGLISH_HI_SCRIPT = /(?:अंग्रेजी\s*में|इंग्लिश\s*में|अंग्रेज़ी\s*में)/;

const EXPLICIT_KANNADA_REGEX = /\b(?:(?:reply|answer|explain|speak|talk|teach|respond|write)\s+in\s+kannada|in\s+kannada\s+please|in\s+kannada|kannada(?:da)?lli|kannada\s+nalli|kannada\s+alli|kannada\s+mein|kannada\s+me|kannada\s+please)\b/i;
const EXPLICIT_KANNADA_KN_SCRIPT = /(?:ಕನ್ನಡದಲ್ಲಿ|ಕನ್ನಡನಲ್ಲಿ|ಕನ್ನಡ\s*ನಲ್ಲಿ|ಕನ್ನಡ\s*ಅಲ್ಲಿ)/;
const EXPLICIT_KANNADA_HI_SCRIPT = /(?:कन्नड़\s*में|कन्नಡ\s*में)/;

const EXPLICIT_HINDI_REGEX = /\b(?:(?:reply|answer|explain|speak|talk|teach|respond|write)\s+in\s+hindi|in\s+hindi\s+please|in\s+hindi|hindi\s+mein|hindi\s+me|hindi\s+nalli|hindi\s+alli|hindi\s+please)\b/i;
const EXPLICIT_HINDI_HI_SCRIPT = /(?:हिंदी\s*में|हिन्दी\s*में)/;
const EXPLICIT_HINDI_KN_SCRIPT = /(?:ಹಿಂದಿಯಲ್ಲಿ|ಹಿಂದಿ\s*ನಲ್ಲಿ|ಹಿಂದಿ\s*ಅಲ್ಲಿ)/;

// 2. Unicode Script ranges
const KANNADA_SCRIPT_REGEX = /[\u0C80-\u0CFF]/;
const DEVANAGARI_SCRIPT_REGEX = /[\u0900-\u097F]/;

// 3. Romanized Kannada / Kanglish key markers & phrases
const KANGLISH_KEYWORDS_REGEX = /\b(?:enu|yenu|yake|yaake|hege|hyage|hegiddiya|hegidiya|hegidira|hegidiraa|yelli|elli|yaava|yaavaga|yavaga|yaaru|yaara|eshtu|yeshtu|gothilla|gothila|gotilla|gotila|gottilla|gottila|agilla|aagilla|agalla|aagalla|illa|beku|beda|bedve|madu|maadu|madodu|madabeku|madona|maadona|madi|maadi|heli|helo|helu|helona|kodi|kodu|banni|baa|nodi|nodu|gotta|gotha|aguthe|aaguthe|agutte|aagutte|bartilla|baralla|nanage|nange|nanna|neenu|neevu|nimma|ninna|namage|namma|idu|adu|ivaga|avaga|eega|aaga|ivattu|naale|swalpa|svalpa|tumba|thumba|andre|aandre|taraha|tara|kannadadalli|kannadalli|matte|mathe|houdu|haudu)\b/i;
const KANGLISH_PHRASES_REGEX = /\b(?:artha\s+(?:agilla|aagilla|agalla|aagalla|agutilla|aagutilla)|en\s+(?:madodu|madbeku|madabeku|aayithu|aytu|samachara|vishesha))\b/i;
const KANGLISH_SUFFIX_REGEX = /\b[a-zA-Z]+(?:dalli|alli|annu|inda|bagge|thara|tara|andre)\b/i;

// 4. Romanized Hindi / Hinglish key markers & phrases
const HINGLISH_KEYWORDS_REGEX = /\b(?:kya|kaise|kyun|kyu|kaha|kahan|kab|kaun|kiska|kiske|kiski|mujhe|mujhko|mera|meri|mere|tum|tumhara|tumhari|tumhare|tumhe|aap|aapka|aapki|aapke|hum|hamara|hamari|hamare|yeh|ye|woh|wo|isko|usko|hai|hain|hote|hota|hoti|samajh|samjhao|samjha|samjhi|batao|bataiye|bata|bolo|boliye|karo|kariye|karna|karta|karti|karte|aaya|aayi|aaye|gaya|gayi|gaye|nahi|nahin|mat|chahiye|raha|rahe|rahi|tha|the|thi|hoga|hogi|honge|sakte|sakta|sakti|padhao|sikhao|achha|accha|theek|thik|bhi|aur|lekin|par|kyunki|isliye)\b/i;
const HINGLISH_PHRASES_REGEX = /\b(?:kya\s+hai|kaise\s+hota|kaise\s+kare|kaise\s+karein|kyun\s+hota|kyu\s+hota|samajh\s+nahi|samajh\s+mein|mujhe\s+batao|batao\s+na|samjhao\s+na|kya\s+hoga|kya\s+karein|kya\s+kare|kaise\s+samjhe|yeh\s+kya|ye\s+kya|kuch\s+bhi|sahi\s+hai|galat\s+hai)\b/i;
const HINGLISH_SUFFIX_REGEX = /\b[a-zA-Z]+(?:mein|me|wala|wali|wale)\b/i;

/**
 * Detects language intent from user message, explicit requested language, and learner profile.
 *
 * NOTE ON CLIENT LANGUAGE CONTRACT:
 * The frontend client transmits `language: "en"` by default as a transport fallback.
 * Therefore, a client value of "en" is NOT treated as an explicit override over the
 * learner's `mentorContext.primaryLanguage`. Only explicit client "kn" / "hi" or explicit
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
    if (EXPLICIT_ENGLISH_REGEX.test(cleanMsg) || EXPLICIT_ENGLISH_KN_SCRIPT.test(cleanMsg) || EXPLICIT_ENGLISH_HI_SCRIPT.test(cleanMsg)) {
      return { language: 'en', source: 'explicit_instruction', isKanglish: false, isHinglish: false };
    }
    if (EXPLICIT_KANNADA_REGEX.test(cleanMsg) || EXPLICIT_KANNADA_KN_SCRIPT.test(cleanMsg) || EXPLICIT_KANNADA_HI_SCRIPT.test(cleanMsg)) {
      return { language: 'kn', source: 'explicit_instruction', isKanglish: false, isHinglish: false };
    }
    if (EXPLICIT_HINDI_REGEX.test(cleanMsg) || EXPLICIT_HINDI_HI_SCRIPT.test(cleanMsg) || EXPLICIT_HINDI_KN_SCRIPT.test(cleanMsg)) {
      return { language: 'hi', source: 'explicit_instruction', isKanglish: false, isHinglish: false };
    }

    // 2. Strong message evidence
    // 2a. Kannada Unicode script
    if (KANNADA_SCRIPT_REGEX.test(cleanMsg)) {
      return { language: 'kn', source: 'kannada_script', isKanglish: false, isHinglish: false };
    }

    // 2b. Devanagari / Hindi Unicode script
    if (DEVANAGARI_SCRIPT_REGEX.test(cleanMsg)) {
      return { language: 'hi', source: 'devanagari_script', isKanglish: false, isHinglish: false };
    }

    // 2c. Romanized Kannada / Kanglish markers & phrases
    if (KANGLISH_KEYWORDS_REGEX.test(cleanMsg) || KANGLISH_PHRASES_REGEX.test(cleanMsg) || KANGLISH_SUFFIX_REGEX.test(cleanMsg)) {
      return { language: 'kn', source: 'kanglish_pattern', isKanglish: true, isHinglish: false };
    }

    // 2d. Romanized Hindi / Hinglish markers & phrases
    if (HINGLISH_PHRASES_REGEX.test(cleanMsg) || HINGLISH_KEYWORDS_REGEX.test(cleanMsg) || HINGLISH_SUFFIX_REGEX.test(cleanMsg)) {
      return { language: 'hi', source: 'hinglish_pattern', isKanglish: false, isHinglish: true };
    }
  }

  // 3. Explicit client requested language ONLY when 'kn' or 'hi' (client 'en' is a default fallback)
  const cleanRequested = (requestedLanguage || '').trim().toLowerCase();
  if (cleanRequested === 'kn') {
    return { language: 'kn', source: 'requested_language', isKanglish: false, isHinglish: false };
  }
  if (cleanRequested === 'hi') {
    return { language: 'hi', source: 'requested_language', isKanglish: false, isHinglish: false };
  }

  // 4. Learner preferred language from MentorContext for ambiguous/greeting messages
  const targetPreferred = (preferredLanguage || '').trim().toLowerCase();
  if ((targetPreferred === 'kn' || targetPreferred === 'hi') && isAmbiguousOrEmptyMessage(cleanMsg)) {
    return { language: targetPreferred as 'kn' | 'hi', source: 'preferred_language', isKanglish: false, isHinglish: false };
  }

  // 5. Default to English
  return { language: 'en', source: 'default', isKanglish: false, isHinglish: false };
}

function isAmbiguousOrEmptyMessage(msg: string): boolean {
  if (!msg) return true;
  return /^(?:hi|hello|hey|namaste|namaskara|ok|okay|yes|no|thanks|thank\s+you|bye|gm|gn)\b[!.?]*$/i.test(msg);
}
