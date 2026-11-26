/**
 * Brain break for Class 5–8 (website brain-break.js): after 10 minutes of active learning Appu
 * offers a one-minute game in the chat — Maths Match (learning) or Memory Flip (fun), taking turns.
 * Appu's lines are its real ElevenLabs voice from /api/appu/voice-line/:key.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from './AppText';
import { theme, tc } from '../theme';
import { config } from '../config';
import { voiceService } from '../lib/voiceService';

export const BRAIN_BREAK_ACTIVE_MS = 10 * 60 * 1000;
export const BRAIN_BREAK_IDLE_MS = 60 * 1000;
const GAME_SECONDS = 45;
const MAX_MISTAKES = 2;
const NEXT_GAME_KEY = 'appu_brain_break_next';

type Lang = 'en' | 'kn' | 'hi';
const COPY: Record<Lang, Record<string, string>> = {
  en: {
    offer: "Wow, you've been learning so well! Time for a quick game. Want to play?",
    play: "Let's play!", later: 'Later',
    startLearning: "Let's play Maths Match! Tap a question, then tap its answer.",
    startFun: "Let's play Memory Flip! Find all the matching pairs.",
    win: "Yay, you won! Amazing job! Now let's get back to learning.",
    lose: "Oh no, you lost the game this time. Better luck next time! Let's continue learning, and we'll play again after some time.",
    laterSaid: "Okay! Let's keep learning. We'll play later.",
    learningTitle: 'Maths Match', funTitle: 'Memory Flip',
    timeLeft: 'seconds left', mistakes: 'Mistakes',
  },
  kn: {
    offer: 'ವಾಹ್, ನೀನು ತುಂಬಾ ಚೆನ್ನಾಗಿ ಕಲಿಯುತ್ತಿದ್ದೀಯ! ಒಂದು ಚಿಕ್ಕ ಆಟದ ಸಮಯ. ಆಡೋಣವಾ?',
    play: 'ಆಡೋಣ!', later: 'ನಂತರ',
    startLearning: 'ಗಣಿತ ಜೋಡಿ ಆಟ ಆಡೋಣ! ಒಂದು ಪ್ರಶ್ನೆ ಒತ್ತು, ನಂತರ ಅದರ ಉತ್ತರ ಒತ್ತು.',
    startFun: 'ನೆನಪಿನ ಕಾರ್ಡ್ ಆಟ ಆಡೋಣ! ಒಂದೇ ರೀತಿಯ ಎಲ್ಲಾ ಜೋಡಿಗಳನ್ನು ಹುಡುಕು.',
    win: 'ಹುರ್ರೇ, ನೀನು ಗೆದ್ದೆ! ಅದ್ಭುತ! ಈಗ ಮತ್ತೆ ಕಲಿಯೋಣ.',
    lose: 'ಅಯ್ಯೋ, ಈ ಬಾರಿ ಆಟದಲ್ಲಿ ಸೋತೆ. ಮುಂದಿನ ಸಲ ಖಂಡಿತ ಗೆಲ್ಲುತ್ತೀಯ! ಕಲಿಕೆ ಮುಂದುವರಿಸೋಣ, ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಆಡೋಣ.',
    laterSaid: 'ಸರಿ! ಕಲಿಕೆ ಮುಂದುವರಿಸೋಣ. ನಂತರ ಆಡೋಣ.',
    learningTitle: 'ಗಣಿತ ಜೋಡಿ', funTitle: 'ನೆನಪಿನ ಕಾರ್ಡ್',
    timeLeft: 'ಸೆಕೆಂಡುಗಳು ಉಳಿದಿವೆ', mistakes: 'ತಪ್ಪುಗಳು',
  },
  hi: {
    offer: 'वाह, तुम बहुत अच्छे से सीख रहे हो! अब एक छोटे से खेल का समय। खेलें?',
    play: 'चलो खेलें!', later: 'बाद में',
    startLearning: 'चलो गणित मिलान खेलते हैं! एक सवाल चुनो, फिर उसका जवाब चुनो।',
    startFun: 'चलो मेमोरी कार्ड खेलते हैं! सारे एक जैसे जोड़े ढूँढो।',
    win: 'हुर्रे, तुम जीत गए! शानदार! अब फिर से सीखते हैं।',
    lose: 'अरे, इस बार तुम खेल हार गए। अगली बार ज़रूर जीतोगे! चलो पढ़ाई जारी रखते हैं, थोड़ी देर बाद फिर खेलेंगे।',
    laterSaid: 'ठीक है! चलो सीखते रहते हैं। बाद में खेलेंगे।',
    learningTitle: 'गणित मिलान', funTitle: 'मेमोरी कार्ड',
    timeLeft: 'सेकंड बाकी', mistakes: 'गलतियाँ',
  },
};

const MATHS_PAIRS = {
  junior: [['7 × 8', '56'], ['9 × 6', '54'], ['45 ÷ 5', '9'], ['½ of 30', '15'], ['12 + 19', '31'], ['100 − 37', '63'], ['3²', '9'], ['0.5 + 0.25', '0.75'], ['8 × 12', '96'], ['¼ of 20', '5']],
  senior: [['√81', '9'], ['15% of 200', '30'], ['2³', '8'], ['−4 + 9', '5'], ['3x = 21, x =', '7'], ['¾', '0.75'], ['12²', '144'], ['(−3) × (−5)', '15'], ['⅖ of 50', '20'], ['√144', '12']],
};
const FLIP_EMOJIS = ['🐘', '🚀', '🌈', '🦋', '🍉', '⚽', '🌻', '🐢'];

const shuffle = <T,>(list: T[]) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const isBrainBreakGrade = (grade: number) => grade >= 5 && grade <= 8;

function say(key: string, lang: Lang) {
  voiceService.playAppuVoice({ audioSource: `${config.apiBaseUrl}/api/appu/voice-line/${key}?lang=${lang}`, text: '' });
}

export function BrainBreakCard({ language, grade }: { language: string; grade: number }) {
  const lang: Lang = language === 'kn' || language === 'hi' ? language : 'en';
  const t = COPY[lang];
  const [phase, setPhase] = useState<'offer' | 'later' | 'playing' | 'won' | 'lost'>('offer');
  const [type, setType] = useState<'learning' | 'fun'>('learning');
  const [secondsLeft, setSecondsLeft] = useState(GAME_SECONDS);

  useEffect(() => {
    say('offer', lang);
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === 'playing' && secondsLeft <= 0) end(false);
  }, [secondsLeft, phase]);

  const start = async () => {
    const next = (await AsyncStorage.getItem(NEXT_GAME_KEY).catch(() => null)) === 'fun' ? 'fun' : 'learning';
    AsyncStorage.setItem(NEXT_GAME_KEY, next === 'fun' ? 'learning' : 'fun').catch(() => {});
    setType(next);
    setSecondsLeft(GAME_SECONDS);
    setPhase('playing');
    say(next === 'fun' ? 'startFun' : 'startLearning', lang);
  };

  const end = (won: boolean) => {
    setPhase((p) => (p === 'playing' ? (won ? 'won' : 'lost') : p));
    say(won ? 'win' : 'lose', lang);
  };

  return (
    <View style={[styles.card, phase === 'won' && styles.won, phase === 'lost' && styles.lost]}>
      {phase === 'offer' || phase === 'later' ? (
        <>
          <Text style={styles.icon}>🎮</Text>
          <Text style={styles.msg}>{phase === 'later' ? t.laterSaid : t.offer}</Text>
          {phase === 'offer' && (
            <View style={styles.row}>
              <TouchableOpacity style={styles.primary} onPress={start}>
                <Text style={styles.primaryText}>{t.play}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondary}
                onPress={() => {
                  setPhase('later');
                  say('later', lang);
                }}
              >
                <Text style={styles.secondaryText}>{t.later}</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        <>
          <View style={styles.head}>
            <Text style={styles.title}>{type === 'fun' ? t.funTitle : t.learningTitle}</Text>
            {phase === 'playing' && (
              <Text style={[styles.clock, secondsLeft <= 10 && styles.low]}>
                {secondsLeft} {t.timeLeft}
              </Text>
            )}
          </View>
          <Text style={styles.msg}>
            {phase === 'won' ? t.win : phase === 'lost' ? t.lose : type === 'fun' ? t.startFun : t.startLearning}
          </Text>
          {type === 'fun' ? (
            <MemoryFlip disabled={phase !== 'playing'} onEnd={end} mistakesLabel={t.mistakes} />
          ) : (
            <MathsMatch disabled={phase !== 'playing'} onEnd={end} grade={grade} />
          )}
        </>
      )}
    </View>
  );
}

function MathsMatch({ disabled, onEnd, grade }: { disabled: boolean; onEnd: (won: boolean) => void; grade: number }) {
  const pairs = useMemo(() => shuffle(MATHS_PAIRS[grade >= 7 ? 'senior' : 'junior']).slice(0, 4), []);
  const answers = useMemo(() => shuffle(pairs.map((p, i) => ({ a: p[1], i }))), [pairs]);
  const [picked, setPicked] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<number | null>(null);

  const tapAnswer = (i: number) => {
    if (picked === null) return;
    if (i === picked) {
      const next = new Set(matched).add(i);
      setMatched(next);
      setPicked(null);
      if (next.size === pairs.length) onEnd(true);
    } else {
      setWrong(i);
      setTimeout(() => setWrong(null), 500);
    }
  };

  return (
    <View style={styles.columns}>
      <View style={styles.col}>
        {pairs.map(([q], i) => (
          <TouchableOpacity
            key={`q${i}`}
            disabled={disabled || matched.has(i)}
            style={[styles.tile, picked === i && styles.tileOn, matched.has(i) && styles.tileDone]}
            onPress={() => setPicked(i)}
          >
            <Text style={styles.tileText}>{q}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.col}>
        {answers.map(({ a, i }) => (
          <TouchableOpacity
            key={`a${i}`}
            disabled={disabled || matched.has(i)}
            style={[styles.tile, matched.has(i) && styles.tileDone, wrong === i && styles.tileWrong]}
            onPress={() => tapAnswer(i)}
          >
            <Text style={styles.tileText}>{a}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function MemoryFlip({ disabled, onEnd, mistakesLabel }: { disabled: boolean; onEnd: (won: boolean) => void; mistakesLabel: string }) {
  const cards = useMemo(() => shuffle([...shuffle(FLIP_EMOJIS).slice(0, 4)].flatMap((e) => [e, e])), []);
  const [open, setOpen] = useState<number[]>([]);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [mistakes, setMistakes] = useState(0);
  const lock = useRef(false);

  const flip = (i: number) => {
    if (lock.current || open.includes(i) || done.has(i)) return;
    const next = [...open, i];
    setOpen(next);
    if (next.length < 2) return;
    lock.current = true;
    const [a, b] = next;
    setTimeout(() => {
      if (cards[a] === cards[b]) {
        const d = new Set(done).add(a).add(b);
        setDone(d);
        if (d.size === cards.length) onEnd(true);
      } else {
        const m = mistakes + 1;
        setMistakes(m);
        if (m > MAX_MISTAKES) onEnd(false);
      }
      setOpen([]);
      lock.current = false;
    }, 650);
  };

  return (
    <>
      <View style={styles.grid}>
        {cards.map((e, i) => {
          const shown = open.includes(i) || done.has(i);
          return (
            <TouchableOpacity
              key={i}
              disabled={disabled}
              style={[styles.flipCard, shown && styles.flipShown, done.has(i) && styles.tileDone]}
              onPress={() => flip(i)}
              accessibilityLabel={shown ? e : 'Hidden card'}
            >
              <Text style={styles.flipText}>{shown ? e : '❔'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.status}>
        {mistakesLabel}: {mistakes} / {MAX_MISTAKES}
      </Text>
    </>
  );
}

const c = theme.colors;
const styles = StyleSheet.create({
  card: { backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.amber, padding: 16, gap: 10, marginVertical: 8 },
  won: { borderColor: c.success },
  lost: { borderColor: c.line },
  icon: { fontSize: 32 },
  msg: { color: c.text, fontSize: 16, lineHeight: 22 },
  row: { flexDirection: 'row', gap: 10 },
  primary: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: c.amber, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: tc('#1a1200', 't'), fontSize: 16, fontFamily: theme.fonts.bodyBold },
  secondary: { minHeight: 48, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: c.textMuted, fontSize: 15, fontFamily: theme.fonts.bodyBold },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: c.amber, fontSize: 18, fontFamily: theme.fonts.heading },
  clock: { color: c.textMuted, fontSize: 13 },
  low: { color: c.danger },
  columns: { flexDirection: 'row', gap: 10 },
  col: { flex: 1, gap: 8 },
  tile: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 6 },
  tileOn: { borderColor: c.cyan, backgroundColor: tc('rgba(14,165,233,0.15)', 'b') },
  tileDone: { borderColor: c.success, backgroundColor: tc('rgba(74,222,128,0.12)', 'b'), opacity: 0.7 },
  tileWrong: { borderColor: c.danger },
  tileText: { color: c.text, fontSize: 16, fontFamily: theme.fonts.bodyBold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  flipCard: { width: '22%', aspectRatio: 1, borderRadius: 12, backgroundColor: c.userBubble, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.line },
  flipShown: { backgroundColor: c.bg },
  flipText: { fontSize: 28 },
  status: { color: c.textMuted, fontSize: 13, textAlign: 'center' },
});
