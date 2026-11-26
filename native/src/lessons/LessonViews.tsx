import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { theme, tc } from '../theme';
import { useProgressStore } from '../stores/progressStore';
import { fetchPodcast, type PodcastEpisode, type StudyLesson } from './lessonApi';
import { DoodleMindMap, DoodleStory, storyFor } from './DoodleVisual';
import { reportLearning, type LearningEvent } from '../lib/learning';

export type Mode = 'lesson' | 'quiz' | 'cards' | 'diagram' | 'guide' | 'podcast';

const MODES: { key: Mode; label: string }[] = [
  { key: 'lesson', label: '👀 See it' },
  { key: 'quiz', label: '⚡ Quiz' },
  { key: 'cards', label: '🗂️ Flashcards' },
  { key: 'diagram', label: '🔍 Diagram' },
  { key: 'guide', label: '📝 Notes' },
  { key: 'podcast', label: '🎧 Audio story' },
];

// How each tab is reported to the learner model (which ways of learning a child prefers).
const LEARNING_MODE: Record<Mode, NonNullable<LearningEvent['mode']>> = {
  lesson: 'see', quiz: 'quiz', cards: 'cards', diagram: 'diagram', guide: 'notes', podcast: 'audio',
};

/** The study-mode tabs for one lesson (used inline under an answer and on the full lesson screen). */
export function StudyModes({ lesson, initialMode = 'lesson' }: { lesson: StudyLesson; initialMode?: Mode }) {
  const [mode, setModeState] = useState<Mode>(initialMode);
  const setMode = (m: Mode) => {
    setModeState(m);
    reportLearning({ source: 'mode_open', topic: lesson.topic, mode: LEARNING_MODE[m] });
  };
  const available = MODES.filter((m) => {
    if (m.key === 'quiz') return lesson.quiz.length > 0;
    if (m.key === 'cards') return lesson.flashcards.length > 0;
    if (m.key === 'diagram') return Boolean(lesson.diagram);
    return true;
  });
  return (
    <View style={styles.modes}>
      {lesson.citation ? <Text style={styles.citation}>📚 {lesson.citation}</Text> : null}
      <View style={styles.tabs}>
        {available.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[styles.tab, mode === m.key && styles.tabActive]}
            onPress={() => setMode(m.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, mode === m.key && styles.tabTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.body}>
        {mode === 'lesson' && <LessonView lesson={lesson} onOpen={setMode} />}
        {mode === 'quiz' && <QuizView lesson={lesson} />}
        {mode === 'cards' && <FlashcardsView lesson={lesson} />}
        {mode === 'diagram' && <DiagramView lesson={lesson} />}
        {mode === 'guide' && <GuideView lesson={lesson} />}
        {mode === 'podcast' && <PodcastView lesson={lesson} />}
      </View>
    </View>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

/* ---------- Lesson: analogy, mind map, steps, quick check ---------- */
function LessonView({ lesson, onOpen }: { lesson: StudyLesson; onOpen: (m: Mode) => void }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const check = lesson.quiz[0];
  return (
    <>
      <DoodleStory lesson={lesson} />
      <DoodleMindMap lesson={lesson} />

      {lesson.steps.length > 0 && (storyFor(lesson).fromDiagram || lesson.steps.length < 2) && (
        <Card title="👣 Step by step">
          {lesson.steps.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={[styles.bodyText, { flex: 1 }]}>{s}</Text>
            </View>
          ))}
        </Card>
      )}

      {lesson.analogy || lesson.keyPoints[0] ? (
        <Card title={lesson.analogy ? '💡 Think of it like this' : '💡 Big idea'}>
          <Text style={styles.bodyText}>{lesson.analogy || lesson.keyPoints[0]}</Text>
        </Card>
      ) : null}

      {check && (
        <Card title="✅ Quick check">
          <Text style={styles.bodyText}>{check.question}</Text>
          {showAnswer ? (
            <Text style={[styles.bodyText, styles.good]}>{check.options[check.correctIndex]}</Text>
          ) : (
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowAnswer(true)}>
              <Text style={styles.secondaryBtnText}>Show answer</Text>
            </TouchableOpacity>
          )}
        </Card>
      )}

      <View style={styles.row}>
        {lesson.quiz.length > 0 && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => onOpen('quiz')}>
            <Text style={styles.primaryBtnText}>Take the quiz ⚡</Text>
          </TouchableOpacity>
        )}
        {lesson.flashcards.length > 0 && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => onOpen('cards')}>
            <Text style={styles.primaryBtnText}>Flashcards 🗂️</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

/* ---------- Quiz ---------- */
function QuizView({ lesson }: { lesson: StudyLesson }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const done = index >= lesson.quiz.length;

  if (done) {
    return (
      <Card title="🎉 Quiz complete">
        <Text style={styles.bigScore}>
          {score} / {lesson.quiz.length}
        </Text>
        <Text style={styles.bodyText}>
          {score === lesson.quiz.length ? 'Perfect score! Brilliant work.' : 'Nice try! Have another go to beat your score.'}
        </Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => {
            setIndex(0);
            setPicked(null);
            setScore(0);
          }}
        >
          <Text style={styles.primaryBtnText}>Try again</Text>
        </TouchableOpacity>
      </Card>
    );
  }

  const q = lesson.quiz[index];
  const answered = picked !== null;
  return (
    <Card title={`Question ${index + 1} of ${lesson.quiz.length}`}>
      <Text style={styles.question}>{q.question}</Text>
      {q.options.map((opt, i) => {
        const isCorrect = i === q.correctIndex;
        const style = [
          styles.option,
          answered && isCorrect && styles.optionCorrect,
          answered && picked === i && !isCorrect && styles.optionWrong,
        ];
        return (
          <TouchableOpacity
            key={i}
            style={style}
            disabled={answered}
            activeOpacity={0.8}
            onPress={() => {
              setPicked(i);
              reportLearning({ source: 'lesson_quiz', topic: lesson.topic, isCorrect, question: q.question });
              if (isCorrect) {
                setScore((s) => s + 1);
                useProgressStore.getState().record('quizCorrect', 20, 'Quiz answer correct!');
              }
            }}
          >
            <Text style={styles.optionText}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
      {answered && (
        <>
          <Text style={[styles.bodyText, picked === q.correctIndex ? styles.good : styles.bad]}>
            {picked === q.correctIndex ? '⭐ Correct!' : `Not quite — the answer is "${q.options[q.correctIndex]}".`}
          </Text>
          {q.explanation ? <Text style={styles.muted}>{q.explanation}</Text> : null}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              setIndex((n) => n + 1);
              setPicked(null);
            }}
          >
            <Text style={styles.primaryBtnText}>
              {index + 1 < lesson.quiz.length ? 'Next question' : 'See my score'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </Card>
  );
}

/* ---------- Flashcards ---------- */
function FlashcardsView({ lesson }: { lesson: StudyLesson }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const flip = useRef(new Animated.Value(0)).current;
  const card = lesson.flashcards[index];

  const toggle = () => {
    Animated.timing(flip, { toValue: flipped ? 0 : 1, duration: 260, useNativeDriver: true }).start();
    setFlipped(!flipped);
  };
  const go = (next: number) => {
    flip.setValue(0);
    setFlipped(false);
    setIndex((next + lesson.flashcards.length) % lesson.flashcards.length);
  };
  const scale = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.92, 1] });

  return (
    <>
      <Text style={styles.muted}>
        Card {index + 1} of {lesson.flashcards.length} · {known.size} mastered
      </Text>
      <TouchableOpacity activeOpacity={0.9} onPress={toggle}>
        <Animated.View style={[styles.flashcard, flipped && styles.flashcardBack, { transform: [{ scale }] }]}>
          <Text style={styles.flashLabel}>{flipped ? 'Answer' : 'Question'}</Text>
          <Text style={styles.flashText}>{flipped ? card.back : card.front}</Text>
          <Text style={styles.flashHint}>Tap to flip</Text>
        </Animated.View>
      </TouchableOpacity>
      <View style={styles.row}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => go(index - 1)}>
          <Text style={styles.secondaryBtnText}>‹ Previous</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, known.has(index) && styles.primaryBtnDone]}
          onPress={() => {
            if (!known.has(index)) useProgressStore.getState().record('flashcards', 5, 'Flashcard mastered!');
            setKnown((s) => new Set(s).add(index));
            go(index + 1);
          }}
        >
          <Text style={styles.primaryBtnText}>{known.has(index) ? 'Mastered ✓' : 'I know this ✓'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => go(index + 1)}>
          <Text style={styles.secondaryBtnText}>Next ›</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

/* ---------- Diagram: explore each part, then name the part from its description ---------- */
function DiagramView({ lesson }: { lesson: StudyLesson }) {
  const diagram = lesson.diagram!;
  const [openId, setOpenId] = useState<string | null>(null);
  const [game, setGame] = useState(false);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [found, setFound] = useState(0);
  const order = useMemo(() => [...diagram.parts].sort(() => Math.random() - 0.5), [diagram, game]);

  if (game) {
    if (round >= order.length) {
      return (
        <Card title="🎯 Diagram mastered">
          <Text style={styles.bigScore}>
            {found} / {order.length}
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              setGame(false);
              setRound(0);
              setFound(0);
            }}
          >
            <Text style={styles.primaryBtnText}>Back to the diagram</Text>
          </TouchableOpacity>
        </Card>
      );
    }
    const target = order[round];
    return (
      <Card title={`Which part is this? (${round + 1}/${order.length})`}>
        <Text style={styles.question}>{target.explanation || target.label}</Text>
        {diagram.parts.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[
              styles.option,
              result && p.id === target.id && styles.optionCorrect,
              result === p.id && p.id !== target.id && styles.optionWrong,
            ]}
            disabled={Boolean(result)}
            onPress={() => {
              setResult(p.id);
              if (p.id === target.id) setFound((n) => n + 1);
              if (round + 1 === order.length && found + (p.id === target.id ? 1 : 0) >= Math.ceil(order.length / 2)) {
                useProgressStore.getState().record('diagrams', 20, 'Diagram mastered!');
              }
            }}
          >
            <Text style={styles.optionText}>{p.label}</Text>
          </TouchableOpacity>
        ))}
        {result && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              setResult(null);
              setRound((r) => r + 1);
            }}
          >
            <Text style={styles.primaryBtnText}>Next</Text>
          </TouchableOpacity>
        )}
      </Card>
    );
  }

  return (
    <Card title={`🔍 ${diagram.title}`}>
      <Text style={styles.muted}>Tap each part to learn what it does.</Text>
      {diagram.parts.map((p, i) => (
        <View key={p.id}>
          {i > 0 && <Text style={styles.flowArrow}>↓</Text>}
          <TouchableOpacity
            style={[styles.part, openId === p.id && styles.partOpen]}
            onPress={() => setOpenId(openId === p.id ? null : p.id)}
            activeOpacity={0.85}
          >
            <Text style={styles.partLabel}>
              {i + 1}. {p.label}
            </Text>
            {openId === p.id && p.explanation ? <Text style={styles.bodyText}>{p.explanation}</Text> : null}
          </TouchableOpacity>
        </View>
      ))}
      {diagram.parts.length >= 2 && (
        <TouchableOpacity style={styles.primaryBtn} onPress={() => setGame(true)}>
          <Text style={styles.primaryBtnText}>Test me on this diagram 🎯</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

/* ---------- Study guide ---------- */
function GuideView({ lesson }: { lesson: StudyLesson }) {
  return (
    <>
      {lesson.keyPoints.length > 0 && (
        <Card title="⭐ Key points">
          {lesson.keyPoints.map((k, i) => (
            <Text key={i} style={styles.bullet}>
              • {k}
            </Text>
          ))}
        </Card>
      )}
      {lesson.mindMap.branches.length > 0 && (
        <Card title="📘 Words to know">
          {lesson.mindMap.branches.map((b, i) => (
            <Text key={i} style={styles.bullet}>
              <Text style={styles.term}>{b.label}: </Text>
              {b.children.join(', ')}
            </Text>
          ))}
        </Card>
      )}
      {lesson.keyPoints.length > 0 && (
        <Card title="🧠 Must remember">
          {lesson.keyPoints.slice(0, 3).map((k, i) => (
            <Text key={i} style={styles.bullet}>
              {i + 1}. {k}
            </Text>
          ))}
        </Card>
      )}
    </>
  );
}

/* ---------- Podcast: APPU's ElevenLabs narration only ---------- */
function PodcastView({ lesson }: { lesson: StudyLesson }) {
  const [episode, setEpisode] = useState<PodcastEpisode | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPodcast(lesson).then((ep) => {
      if (!alive) return;
      setEpisode(ep);
      setState(ep ? 'ready' : 'failed');
    });
    return () => {
      alive = false;
      try {
        playerRef.current?.remove();
      } catch {}
      playerRef.current = null;
    };
  }, [lesson]);

  const togglePlay = () => {
    if (!episode?.audioUri) return;
    if (!playerRef.current) {
      const player = createAudioPlayer({ uri: episode.audioUri });
      player.addListener('playbackStatusUpdate', (s) => {
        if (s.didJustFinish) {
          setPlaying(false);
          player.seekTo(0);
        }
      });
      playerRef.current = player;
    }
    if (playing) playerRef.current.pause();
    else playerRef.current.play();
    setPlaying(!playing);
  };

  if (state === 'loading') {
    return (
      <Card title="🎧 Appu's audio lesson">
        <ActivityIndicator color={theme.colors.cyan} />
        <Text style={styles.muted}>Appu is recording your audio lesson… this takes about 30 seconds.</Text>
      </Card>
    );
  }
  if (!episode) {
    return (
      <Card title="🎧 Appu's audio lesson">
        <Text style={styles.muted}>Appu couldn't record this one right now. Please try again in a moment.</Text>
      </Card>
    );
  }
  return (
    <Card title={`🎧 ${episode.title}`}>
      {episode.audioUri ? (
        <TouchableOpacity style={styles.playBtn} onPress={togglePlay} activeOpacity={0.85}>
          <Text style={styles.playBtnText}>{playing ? '⏸  Pause' : '▶  Play Appu’s lesson'}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.muted}>Audio isn't available for this lesson — here's the script.</Text>
      )}
      {episode.segments.map((s, i) => (
        <View key={i} style={styles.segment}>
          {s.label ? <Text style={styles.term}>{s.label}</Text> : null}
          <Text style={styles.bodyText}>{s.text}</Text>
        </View>
      ))}
    </Card>
  );
}

const c = theme.colors;
const styles = StyleSheet.create({
  citation: { color: c.textMuted, fontSize: 12, fontFamily: theme.fonts.body },
  modes: { gap: 8 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  tab: { paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, justifyContent: 'center', borderRadius: 999, borderWidth: 1.5, borderColor: c.line, backgroundColor: c.surface },
  tabActive: { backgroundColor: c.cyan, borderColor: c.cyan },
  tabText: { color: c.text, fontSize: 15, fontFamily: theme.fonts.bodyBold },
  tabTextActive: { color: tc('#04121f', 't') },
  body: { gap: 12 },
  card: { backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, padding: 16, gap: 10 },
  cardTitle: { color: c.cyanSoft, fontSize: 15, fontFamily: theme.fonts.heading },
  bodyText: { color: c.text, fontFamily: theme.fonts.body, fontSize: 16, lineHeight: 23 },
  muted: { color: c.textMuted, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 20, paddingHorizontal: 4 },
  good: { color: tc('#4ade80', 't'), fontWeight: '700' },
  bad: { color: tc('#fca5a5', 't'), fontWeight: '700' },
  central: { alignSelf: 'center', backgroundColor: tc('rgba(34,211,238,0.15)', 'b'), borderColor: c.cyan, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8 },
  centralText: { color: c.text, fontSize: 17, fontFamily: theme.fonts.heading },
  branch: { borderLeftWidth: 3, borderLeftColor: c.amber, paddingLeft: 10, gap: 6 },
  branchLabel: { color: c.amber, fontSize: 15, fontFamily: theme.fonts.bodyBold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: tc('rgba(255,255,255,0.07)', 'b'), borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { color: c.text, fontFamily: theme.fonts.body, fontSize: 14 },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: c.cyan, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: tc('#04121f', 't'), fontWeight: '800' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  primaryBtn: { backgroundColor: c.cyan, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  primaryBtnDone: { backgroundColor: tc('#4ade80', 'b') },
  primaryBtnText: { color: tc('#04121f', 't'), fontSize: 15, fontFamily: theme.fonts.bodyBold },
  secondaryBtn: { borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  secondaryBtnText: { color: c.cyanSoft, fontSize: 15, fontFamily: theme.fonts.bodyBold },
  question: { color: c.text, fontSize: 18, fontFamily: theme.fonts.bodyBold, lineHeight: 25 },
  option: { borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 14, minHeight: 50, justifyContent: 'center', backgroundColor: tc('rgba(255,255,255,0.03)', 'b') },
  optionCorrect: { borderColor: tc('#4ade80', 'b'), backgroundColor: tc('rgba(74,222,128,0.15)', 'b') },
  optionWrong: { borderColor: tc('#f87171', 'b'), backgroundColor: tc('rgba(248,113,113,0.15)', 'b') },
  optionText: { color: c.text, fontFamily: theme.fonts.body, fontSize: 16 },
  bigScore: { color: c.cyan, fontSize: 44, fontFamily: theme.fonts.heading, textAlign: 'center' },
  flashcard: { minHeight: 240, borderRadius: 22, padding: 22, backgroundColor: tc('#12325a', 'b'), borderWidth: 1, borderColor: c.cyan, justifyContent: 'center', gap: 12 },
  flashcardBack: { backgroundColor: tc('#1d2f12', 'b'), borderColor: tc('#4ade80', 'b') },
  flashLabel: { color: c.textMuted, fontSize: 13, fontFamily: theme.fonts.bodyBold, textTransform: 'uppercase', letterSpacing: 1 },
  flashText: { color: c.text, fontSize: 21, fontFamily: theme.fonts.bodyBold, lineHeight: 29 },
  flashHint: { color: c.textMuted, fontFamily: theme.fonts.body, fontSize: 12 },
  flowArrow: { color: c.cyan, fontFamily: theme.fonts.body, fontSize: 18, textAlign: 'center' },
  part: { borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 14, gap: 6, backgroundColor: tc('rgba(255,255,255,0.03)', 'b') },
  partOpen: { borderColor: c.cyan, backgroundColor: tc('rgba(34,211,238,0.1)', 'b') },
  partLabel: { color: c.text, fontSize: 16, fontFamily: theme.fonts.bodyBold },
  bullet: { color: c.text, fontFamily: theme.fonts.body, fontSize: 16, lineHeight: 24 },
  term: { color: c.amber, fontFamily: theme.fonts.bodyBold, fontSize: 15 },
  playBtn: { backgroundColor: c.cyan, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  playBtnText: { color: tc('#04121f', 't'), fontSize: 16, fontFamily: theme.fonts.bodyBold },
  segment: { gap: 4, paddingTop: 6 },
});
