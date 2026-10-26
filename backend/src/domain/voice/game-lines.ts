/**
 * Fixed lines Appu speaks during the Class 5-8 mini-game break. Only these exact texts can
 * be voiced through /api/appu/voice-line, so the endpoint cannot be used as a free TTS.
 * Kannada and Hindi wording needs native-speaker review.
 */
export type GameLineKey = 'offer' | 'startLearning' | 'startFun' | 'win' | 'lose' | 'later';
export type GameLineLang = 'en' | 'kn' | 'hi';

export const GAME_LINES: Record<GameLineKey, Record<GameLineLang, string>> = {
  offer: {
    en: "Wow, you've been learning so well! Time for a quick game. Want to play?",
    kn: 'ವಾಹ್, ನೀನು ತುಂಬಾ ಚೆನ್ನಾಗಿ ಕಲಿಯುತ್ತಿದ್ದೀಯ! ಒಂದು ಚಿಕ್ಕ ಆಟದ ಸಮಯ. ಆಡೋಣವಾ?',
    hi: 'वाह, तुम बहुत अच्छे से सीख रहे हो! अब एक छोटे से खेल का समय। खेलें?'
  },
  startLearning: {
    en: "Let's play Maths Match! Tap a question, then tap its answer.",
    kn: 'ಗಣಿತ ಜೋಡಿ ಆಟ ಆಡೋಣ! ಒಂದು ಪ್ರಶ್ನೆ ಒತ್ತು, ನಂತರ ಅದರ ಉತ್ತರ ಒತ್ತು.',
    hi: 'चलो गणित मिलान खेलते हैं! एक सवाल चुनो, फिर उसका जवाब चुनो।'
  },
  startFun: {
    en: "Let's play Memory Flip! Find all the matching pairs.",
    kn: 'ನೆನಪಿನ ಕಾರ್ಡ್ ಆಟ ಆಡೋಣ! ಒಂದೇ ರೀತಿಯ ಎಲ್ಲಾ ಜೋಡಿಗಳನ್ನು ಹುಡುಕು.',
    hi: 'चलो मेमोरी कार्ड खेलते हैं! सारे एक जैसे जोड़े ढूँढो।'
  },
  win: {
    en: 'Yay, you won! Amazing job! Now let\'s get back to learning.',
    kn: 'ಹುರ್ರೇ, ನೀನು ಗೆದ್ದೆ! ಅದ್ಭುತ! ಈಗ ಮತ್ತೆ ಕಲಿಯೋಣ.',
    hi: 'हुर्रे, तुम जीत गए! शानदार! अब फिर से सीखते हैं।'
  },
  lose: {
    en: "Oh no, you lost the game this time. Better luck next time! Let's continue learning, and we'll play again after some time.",
    kn: 'ಅಯ್ಯೋ, ಈ ಬಾರಿ ಆಟದಲ್ಲಿ ಸೋತೆ. ಮುಂದಿನ ಸಲ ಖಂಡಿತ ಗೆಲ್ಲುತ್ತೀಯ! ಕಲಿಕೆ ಮುಂದುವರಿಸೋಣ, ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಆಡೋಣ.',
    hi: 'अरे, इस बार तुम खेल हार गए। अगली बार ज़रूर जीतोगे! चलो पढ़ाई जारी रखते हैं, थोड़ी देर बाद फिर खेलेंगे।'
  },
  later: {
    en: "Okay! Let's keep learning. We'll play later.",
    kn: 'ಸರಿ! ಕಲಿಕೆ ಮುಂದುವರಿಸೋಣ. ನಂತರ ಆಡೋಣ.',
    hi: 'ठीक है! चलो सीखते रहते हैं। बाद में खेलेंगे।'
  }
};

export function resolveGameLine(key: string, lang: string): string | null {
  const entry = (GAME_LINES as Record<string, Record<string, string>>)[key];
  if (!entry) return null;
  return entry[lang] ?? entry.en;
}
