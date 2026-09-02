import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectLanguageIntent } from '../src/domain/language/index.js';

describe('APPU Language Intent Detection & Kanglish Routing', () => {
  // =========================================================================
  // USER MANDATORY VERIFICATION CASES (1 through 6)
  // =========================================================================

  it('Case 1: primaryLanguage=kn, client language=en/default, message="hi" -> EXPECT kn', () => {
    // Default client 'en' must NOT override learner preferred language for ambiguous greeting
    const res = detectLanguageIntent('hi', 'en', 'kn');
    assert.equal(res.language, 'kn');
    assert.equal(res.source, 'preferred_language');
  });

  it('Case 2: primaryLanguage=kn, client language=en/default, message="explain this in English" -> EXPECT en', () => {
    const res = detectLanguageIntent('explain this in English', 'en', 'kn');
    assert.equal(res.language, 'en');
    assert.equal(res.source, 'explicit_instruction');
  });

  it('Case 3: primaryLanguage=en, client language=en/default, message="nanage gothilla" -> EXPECT kn', () => {
    const res = detectLanguageIntent('nanage gothilla', 'en', 'en');
    assert.equal(res.language, 'kn');
    assert.equal(res.isKanglish, true);
    assert.equal(res.source, 'kanglish_pattern');
  });

  it('Case 4: primaryLanguage=en, client language=en/default, message="hello" -> EXPECT en', () => {
    const res = detectLanguageIntent('hello', 'en', 'en');
    assert.equal(res.language, 'en');
  });

  it('Case 5: primaryLanguage=kn, client language=en/default, message="photosynthesis andre enu?" -> EXPECT kn', () => {
    const res = detectLanguageIntent('photosynthesis andre enu?', 'en', 'kn');
    assert.equal(res.language, 'kn');
    assert.equal(res.isKanglish, true);
    assert.equal(res.source, 'kanglish_pattern');
  });

  it('Case 6: primaryLanguage=kn, client language=en/default, message="how does gravity work?" -> EXPECT en (Language Mirroring)', () => {
    // Language Mirroring Pedagogy: Substantive English question without Kannada markers mirrors in English
    const res = detectLanguageIntent('how does gravity work?', 'en', 'kn');
    assert.equal(res.language, 'en');
  });

  // =========================================================================
  // KANGLISH SPELLING VARIANTS VERIFICATION
  // =========================================================================

  it('recognizes all specified Kanglish spelling variants', () => {
    // gothilla variants
    assert.equal(detectLanguageIntent('gothilla', 'en', 'en').language, 'kn');
    assert.equal(detectLanguageIntent('gotilla', 'en', 'en').language, 'kn');
    assert.equal(detectLanguageIntent('gottilla', 'en', 'en').language, 'kn');
    assert.equal(detectLanguageIntent('gotila', 'en', 'en').language, 'kn');
    assert.equal(detectLanguageIntent('gothila', 'en', 'en').language, 'kn');

    // artha agilla variants
    assert.equal(detectLanguageIntent('artha agilla', 'en', 'en').language, 'kn');
    assert.equal(detectLanguageIntent('artha aagilla', 'en', 'en').language, 'kn');
    assert.equal(detectLanguageIntent('nanage artha agilla', 'en', 'en').language, 'kn');
    assert.equal(detectLanguageIntent('nange artha aagilla', 'en', 'en').language, 'kn');

    // en / enu madodu variants
    assert.equal(detectLanguageIntent('en madodu', 'en', 'en').language, 'kn');
    assert.equal(detectLanguageIntent('enu madodu', 'en', 'en').language, 'kn');
    assert.equal(detectLanguageIntent('ivaga en madodu', 'en', 'en').language, 'kn');
    assert.equal(detectLanguageIntent('ivaga enu madodu', 'en', 'en').language, 'kn');

    // Additional common variants
    assert.equal(detectLanguageIntent('hegiddiya', 'en', 'en').language, 'kn');
    assert.equal(detectLanguageIntent('idu yake hage', 'en', 'en').language, 'kn');
    assert.equal(detectLanguageIntent('swalpa simple agi heli', 'en', 'en').language, 'kn');
    assert.equal(detectLanguageIntent('kannadadalli heli', 'en', 'en').language, 'kn');
  });

  // =========================================================================
  // EXPLICIT SCRIPT AND INSTRUCTION OVERRIDES
  // =========================================================================

  it('handles Kannada Unicode script input', () => {
    assert.equal(detectLanguageIntent('ನನಗೆ ಗೊತ್ತಿಲ್ಲ', 'en', 'en').language, 'kn');
    assert.equal(detectLanguageIntent('gravity ಬಗ್ಗೆ explain ಮಾಡು', 'en', 'en').language, 'kn');
  });

  it('handles explicit Kannada instruction in English and Kannada scripts', () => {
    assert.equal(detectLanguageIntent('Please reply in Kannada', 'en', 'en').language, 'kn');
    assert.equal(detectLanguageIntent('ಕನ್ನಡದಲ್ಲಿ ಹೇಳಿ', 'en', 'en').language, 'kn');
  });

  it('handles explicit English instruction in Kannada script', () => {
    assert.equal(detectLanguageIntent('ಇಂಗ್ಲಿಷ್ನಲ್ಲಿ ಹೇಳಿ', 'en', 'kn').language, 'en');
  });

  it('handles explicit client requested language kn', () => {
    assert.equal(detectLanguageIntent('What is gravity?', 'kn', 'en').language, 'kn');
  });

  // =========================================================================
  // HINDI & HINGLISH VERIFICATION SUITE
  // =========================================================================

  it('handles Devanagari Unicode script input', () => {
    assert.equal(detectLanguageIntent('मुझे समझ नहीं आया', 'en', 'en').language, 'hi');
    assert.equal(detectLanguageIntent('प्रकाश संश्लेषण क्या है?', 'en', 'en').language, 'hi');
    assert.equal(detectLanguageIntent('हिंदी में समझाओ', 'en', 'en').language, 'hi');
  });

  it('handles Romanized Hindi / Hinglish functional phrases and keywords', () => {
    assert.equal(detectLanguageIntent('photosynthesis kya hai?', 'en', 'en').language, 'hi');
    assert.equal(detectLanguageIntent('mujhe samajh nahi aaya', 'en', 'en').language, 'hi');
    assert.equal(detectLanguageIntent('ye kaise hota hai?', 'en', 'en').language, 'hi');
    assert.equal(detectLanguageIntent('hindi mein batao', 'en', 'en').language, 'hi');
    assert.equal(detectLanguageIntent('hindi me samjhao', 'en', 'en').language, 'hi');
    assert.equal(detectLanguageIntent('mujhe batao', 'en', 'en').language, 'hi');
    assert.equal(detectLanguageIntent('kyun hota hai?', 'en', 'en').language, 'hi');
    assert.equal(detectLanguageIntent('ye kya hai', 'en', 'en').language, 'hi');
  });

  it('handles explicit Hindi instructions across scripts', () => {
    assert.equal(detectLanguageIntent('explain in hindi', 'en', 'en').language, 'hi');
    assert.equal(detectLanguageIntent('reply in hindi please', 'en', 'en').language, 'hi');
    assert.equal(detectLanguageIntent('हिंदी में बताओ', 'en', 'en').language, 'hi');
    assert.equal(detectLanguageIntent('ಹಿಂದಿಯಲ್ಲಿ ಹೇಳಿ', 'en', 'en').language, 'hi');
  });

  it('handles explicit requestedLanguage hi', () => {
    assert.equal(detectLanguageIntent('hello', 'hi', 'en').language, 'hi');
    assert.equal(detectLanguageIntent('how does gravity work?', 'hi', 'en').language, 'hi');
  });

  it('handles learner preferred language hi for ambiguous greetings', () => {
    assert.equal(detectLanguageIntent('namaste', 'en', 'hi').language, 'hi');
    assert.equal(detectLanguageIntent('hello', 'en', 'hi').language, 'hi');
    assert.equal(detectLanguageIntent('hi', 'en', 'hi').language, 'hi');
  });

  // =========================================================================
  // TEST MATRIX: CASES A THROUGH J (CROSS-LANGUAGE OVERRIDES)
  // =========================================================================

  it('Case A: Toggle ENG + "how does gravity work?" -> en', () => {
    assert.equal(detectLanguageIntent('how does gravity work?', 'en', 'en').language, 'en');
  });

  it('Case B: Toggle ಕನ್ನಡ + "hello" -> kn', () => {
    assert.equal(detectLanguageIntent('hello', 'kn', 'en').language, 'kn');
  });

  it('Case C: Toggle हिंदी + "hello" -> hi', () => {
    assert.equal(detectLanguageIntent('hello', 'hi', 'en').language, 'hi');
  });

  it('Case D: Hindi toggle + "photosynthesis kya hai?" -> hi', () => {
    assert.equal(detectLanguageIntent('photosynthesis kya hai?', 'hi', 'en').language, 'hi');
  });

  it('Case E: Hindi toggle + "मुझे समझ नहीं आया" -> hi', () => {
    assert.equal(detectLanguageIntent('मुझे समझ नहीं आया', 'hi', 'en').language, 'hi');
  });

  it('Case F: English toggle + "hindi mein batao" -> hi (explicit instruction override)', () => {
    assert.equal(detectLanguageIntent('hindi mein batao', 'en', 'en').language, 'hi');
  });

  it('Case G: Hindi toggle + "explain this in English" -> en (explicit instruction override)', () => {
    assert.equal(detectLanguageIntent('explain this in English', 'hi', 'hi').language, 'en');
  });

  it('Case H: Hindi toggle + "kannadadalli heli" -> kn (explicit instruction override)', () => {
    assert.equal(detectLanguageIntent('kannadadalli heli', 'hi', 'hi').language, 'kn');
  });

  it('Case I: Kannada toggle + "photosynthesis andre enu?" -> kn', () => {
    assert.equal(detectLanguageIntent('photosynthesis andre enu?', 'kn', 'kn').language, 'kn');
  });
});
