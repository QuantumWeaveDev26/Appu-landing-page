/**
 * Guided tour on the real home screen: dims everything, cuts a glowing spotlight around one
 * button at a time and explains it in a friendly card. Steps whose button is not on screen
 * right now are skipped.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './AppText';
import { theme, tc } from '../theme';

export type TourTarget = 'missions' | 'input' | 'attach' | 'mic' | 'call' | 'progress' | 'newChat' | 'menu';

export interface TourStep {
  target?: TourTarget;
  emoji: string;
  title: string;
  text: string;
  /** Extra picture shown in the card (for things that are not on screen yet). */
  preview?: 'answer';
}

export const TOUR_STEPS: TourStep[] = [
  { emoji: '👋', title: 'Welcome to Appu!', text: "I'm your learning buddy. Let me show you where everything is. It takes one minute." },
  { target: 'missions', emoji: '🎯', title: 'Pick a mission', text: 'Not sure what to ask? Tap a coloured box: explain a topic, play a quiz, get homework help or practise for an exam.' },
  { target: 'input', emoji: '⌨️', title: 'Type your question', text: 'Write anything you want to learn here, like "What is gravity?", then tap the blue arrow to send.' },
  { target: 'attach', emoji: '📸', title: 'Add a photo or notes', text: 'Take a photo of your homework, or add your school notes (PDF or Word). Appu will explain them.' },
  { target: 'mic', emoji: '🎙️', title: 'Speak instead of typing', text: 'Tap the mic and just talk. Appu listens until you tap it again.' },
  { target: 'call', emoji: '📞', title: 'Call Appu', text: 'Have a real voice chat. Want Appu to stop talking? Just say "stop" and ask your next question.' },
  { preview: 'answer', emoji: '🎨', title: 'Every answer comes with pictures', text: 'Tap 🔊 Listen to hear Appu. Below each answer you get steps in pictures, a mind map, a quiz and flashcards. Tap ☆ Save to keep a lesson.' },
  { target: 'progress', emoji: '🔥', title: 'Your streak and stars', text: '🔥 shows how many days in a row you learned. ⭐ are stars you earn from quizzes and flashcards. Tap to see your badges.' },
  { target: 'newChat', emoji: '✏️', title: 'Start fresh', text: 'Tap the pencil to start a new chat about a new topic.' },
  { target: 'menu', emoji: '☰', title: 'The menu', text: 'Open it for old chats, My Learning (saved lessons), your progress, Parent Zone, settings, light mode and this tour again.' },
  { emoji: '🚀', title: "You're ready!", text: 'Ask Appu your first question now. Have fun learning!' },
];

export type TargetRefs = Partial<Record<TourTarget, React.RefObject<View | null>>>;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function measure(ref?: React.RefObject<View | null>): Promise<Rect | null> {
  return new Promise((resolve) => {
    const node = ref?.current;
    if (!node || typeof node.measureInWindow !== 'function') return resolve(null);
    node.measureInWindow((x, y, w, h) => resolve(w > 0 && h > 0 ? { x, y, w, h } : null));
  });
}

interface Props {
  visible: boolean;
  targets: TargetRefs;
  onClose: (finished: boolean) => void;
}

export function SpotlightTour({ visible, targets, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const dir = useRef(1);

  useEffect(() => {
    if (visible) {
      dir.current = 1;
      setIndex(0);
    }
  }, [visible]);

  // Measure the step's button; skip the step if it is not on screen.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const step = TOUR_STEPS[index];
    fade.setValue(0);
    void measure(step.target ? targets[step.target] : undefined).then((r) => {
      if (cancelled) return;
      if (step.target && !r) {
        const next = index + dir.current;
        if (next >= 0 && next < TOUR_STEPS.length) setIndex(next);
        else onClose(true);
        return;
      }
      setRect(r);
      Animated.timing(fade, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [visible, index]);

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [visible]);

  if (!visible) return null;
  const step = TOUR_STEPS[index];
  const isLast = index === TOUR_STEPS.length - 1;
  const { width: W, height: H } = Dimensions.get('window');
  const pad = 8;
  const hole = step.target && rect ? { x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2 } : null;
  // Card goes below the spotlight when the button is in the top half, otherwise above it.
  const below = hole ? hole.y + hole.h / 2 < H / 2 : false;
  const cardPos = !hole
    ? { top: H * 0.22 }
    : below
    ? { top: Math.min(hole.y + hole.h + 18, H - 300) }
    : { bottom: Math.max(H - hole.y + 18, 24) };

  const go = (d: 1 | -1) => {
    dir.current = d;
    if (d === 1 && isLast) return onClose(true);
    setIndex((i) => Math.max(0, i + d));
  };

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => onClose(false)}>
      <View style={StyleSheet.absoluteFill}>
        {hole ? (
          <>
            <View style={[styles.mask, { left: 0, top: 0, width: W, height: Math.max(0, hole.y) }]} />
            <View style={[styles.mask, { left: 0, top: hole.y + hole.h, width: W, bottom: 0 }]} />
            <View style={[styles.mask, { left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }]} />
            <View style={[styles.mask, { left: hole.x + hole.w, top: hole.y, right: 0, height: hole.h }]} />
            <View style={[styles.ring, { left: hole.x, top: hole.y, width: hole.w, height: hole.h }]} pointerEvents="none" />
            <Animated.View
              pointerEvents="none"
              style={[styles.ring, { left: hole.x, top: hole.y, width: hole.w, height: hole.h, opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
            />
            <Text style={[styles.pointer, below ? { top: hole.y + hole.h - 4 } : { top: hole.y - 34 }, { left: hole.x + hole.w / 2 - 14 }]}>
              {below ? '👆' : '👇'}
            </Text>
          </>
        ) : (
          <View style={[styles.mask, StyleSheet.absoluteFill]} />
        )}

        <Animated.View
          style={[
            styles.card,
            cardPos,
            { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [below ? -12 : 12, 0] }) }] },
          ]}
        >
          <View style={styles.cardTop}>
            <Text style={styles.count}>
              {index + 1} / {TOUR_STEPS.length}
            </Text>
            <TouchableOpacity onPress={() => onClose(false)} style={styles.skip} accessibilityLabel="Skip the tour">
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.emoji}>{step.emoji}</Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.text}>{step.text}</Text>
          {step.preview === 'answer' && <AnswerPreview />}
          <View style={styles.dots}>
            {TOUR_STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
            ))}
          </View>
          <View style={styles.buttons}>
            {index > 0 ? (
              <TouchableOpacity style={styles.back} onPress={() => go(-1)} accessibilityLabel="Back">
                <Text style={styles.backText}>← Back</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}
            <TouchableOpacity style={styles.next} onPress={() => go(1)} accessibilityLabel={isLast ? 'Start learning' : 'Next'}>
              <Text style={styles.nextText}>{isLast ? "Let's go! 🚀" : index === 0 ? 'Show me →' : 'Next →'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** A small drawing of an answer, so the learner knows what to look for. */
function AnswerPreview() {
  const panels = [
    { e: '☀️', bg: tc('#e0f2fe', 'b'), b: tc('#0ea5e9', 'b') },
    { e: '💧', bg: tc('#ffedd5', 'b'), b: tc('#f97316', 'b') },
    { e: '🌱', bg: tc('#d1fae5', 'b'), b: tc('#10b981', 'b') },
  ];
  return (
    <View style={styles.preview}>
      <View style={styles.pBubble}>
        <View style={[styles.pLine, { width: '90%' }]} />
        <View style={[styles.pLine, { width: '70%' }]} />
      </View>
      <View style={styles.pRow}>
        <View style={[styles.pPill, styles.pPillOn]}>
          <Text style={styles.pPillTextOn}>🔊 Listen</Text>
        </View>
        <View style={styles.pPill}>
          <Text style={styles.pPillText}>☆ Save</Text>
        </View>
        <View style={styles.pPill}>
          <Text style={styles.pPillText}>↗ Share</Text>
        </View>
      </View>
      <View style={styles.pRow}>
        {panels.map((p, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Text style={styles.pArrow}>➜</Text>}
            <View style={[styles.pPanel, { backgroundColor: p.bg, borderColor: p.b }]}>
              <Text style={styles.pPanelEmoji}>{p.e}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
      <View style={styles.pRow}>
        {['👀 See it', '⚡ Quiz', '🗂️ Cards'].map((l) => (
          <View key={l} style={styles.pPill}>
            <Text style={styles.pPillText}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const c = theme.colors;
const styles = StyleSheet.create({
  mask: { position: 'absolute', backgroundColor: tc('rgba(2,6,23,0.78)', 'b') },
  ring: { position: 'absolute', borderRadius: 20, borderWidth: 3, borderColor: tc('#facc15', 'b') },
  pointer: { position: 'absolute', fontSize: 28 },
  card: { position: 'absolute', left: 16, right: 16, backgroundColor: c.bgElevated, borderRadius: 24, borderWidth: 1, borderColor: c.line, padding: 18, gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { color: c.textMuted, fontSize: 13, fontFamily: theme.fonts.bodyBold },
  skip: { paddingHorizontal: 10, paddingVertical: 6, minHeight: 36, justifyContent: 'center' },
  skipText: { color: c.textMuted, fontSize: 14, fontFamily: theme.fonts.bodyBold },
  emoji: { fontSize: 40 },
  title: { color: c.text, fontSize: 21, fontFamily: theme.fonts.heading },
  text: { color: c.text, fontSize: 16, lineHeight: 23, fontFamily: theme.fonts.body },
  dots: { flexDirection: 'row', gap: 5, justifyContent: 'center', marginTop: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.line },
  dotOn: { width: 20, backgroundColor: c.cyan },
  buttons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  back: { minHeight: 48, paddingHorizontal: 14, justifyContent: 'center' },
  backText: { color: c.cyanSoft, fontSize: 16, fontFamily: theme.fonts.bodyBold },
  next: { minHeight: 50, paddingHorizontal: 22, borderRadius: 999, backgroundColor: c.cyan, justifyContent: 'center' },
  nextText: { color: tc('#04121f', 't'), fontSize: 17, fontFamily: theme.fonts.heading },
  preview: { gap: 8, padding: 12, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  pBubble: { gap: 6, padding: 10, borderRadius: 14, borderTopLeftRadius: 4, backgroundColor: c.bg },
  pLine: { height: 7, borderRadius: 4, backgroundColor: c.line },
  pRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pPill: { borderRadius: 999, borderWidth: 1, borderColor: c.line, paddingHorizontal: 10, paddingVertical: 4 },
  pPillOn: { backgroundColor: c.cyan, borderColor: c.cyan },
  pPillText: { color: c.text, fontSize: 12, fontFamily: theme.fonts.bodyBold },
  pPillTextOn: { color: tc('#04121f', 't'), fontSize: 12, fontFamily: theme.fonts.bodyBold },
  pPanel: { width: 52, height: 52, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pPanelEmoji: { fontSize: 24 },
  pArrow: { color: c.amber, fontSize: 16 },
});
