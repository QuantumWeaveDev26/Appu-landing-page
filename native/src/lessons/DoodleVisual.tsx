/**
 * Picture-style lesson visuals, ported from the website's doodle-visual.js:
 * - "See it in steps": a comic strip of coloured panels with a big picture for each step;
 * - "Mind map": the topic in the middle with coloured branches drawn out of it.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../components/AppText';
import { theme, tc } from '../theme';
import type { StudyLesson } from './lessonApi';

const COLORS = [
  { stroke: tc('#0ea5e9', 'b'), fill: tc('#e0f2fe', 'b') },
  { stroke: tc('#f97316', 'b'), fill: tc('#ffedd5', 'b') },
  { stroke: tc('#10b981', 'b'), fill: tc('#d1fae5', 'b') },
  { stroke: tc('#a855f7', 'b'), fill: tc('#f3e8ff', 'b') },
  { stroke: tc('#ec4899', 'b'), fill: tc('#fce7f3', 'b') },
  { stroke: tc('#eab308', 'b'), fill: tc('#fef9c3', 'b') },
];
const INK = tc('#0f172a', 't');
const INK_SOFT = tc('#334155', 't');

// Keyword -> picture, so a step about roots gets a plant and a step about magnets a magnet.
const EMOJI_RULES: [RegExp, string][] = [
  [/fossil|bone|dinosaur|remains|dead|dies/i, '🦴'],
  [/sun|light|day|heat|energy|solar/i, '☀️'], [/water|rain|river|ocean|sea|liquid|drop/i, '💧'],
  [/plant|leaf|leaves|tree|seed|flower|root|grow/i, '🌱'], [/air|gas|wind|breath|oxygen|carbon/i, '💨'],
  [/food|eat|sugar|glucose|nutri|digest/i, '🍎'],
  [/rock|stone|mud|sand|soil|layer|earth/i, '🪨'], [/magnet|pole|attract|repel/i, '🧲'],
  [/electric|current|circuit|battery|charge/i, '⚡'], [/force|push|pull|motion|speed|move/i, '🏃'],
  [/time|year|age|long ago|history|ancient/i, '⏳'], [/number|add|sum|equation|solve|multiply|divide|fraction/i, '🔢'],
  [/shape|angle|triangle|circle|square|geometry/i, '📐'], [/cell|body|blood|heart|organ|health/i, '🫀'],
  [/animal|bird|fish|insect/i, '🐾'], [/space|planet|star|moon|orbit/i, '🪐'],
  [/read|word|story|write|book|language|poem/i, '📖'], [/map|country|state|city|india|place/i, '🗺️'],
  [/money|trade|price|market|buy/i, '💰'], [/think|idea|brain|remember|why/i, '💡'],
  [/check|test|result|answer|correct/i, '✅'], [/fire|burn|hot/i, '🔥'], [/cold|ice|freeze/i, '🧊'],
  [/mix|react|chemical|acid|salt/i, '🧪'],
];
const FALLBACK_EMOJI = ['💡', '🔍', '⭐', '🎯', '🚀', '🧩'];

export function pickEmoji(text: string, index: number): string {
  for (const [re, emoji] of EMOJI_RULES) if (re.test(text)) return emoji;
  return FALLBACK_EMOJI[index % FALLBACK_EMOJI.length];
}

export interface StoryStep {
  label: string;
  text: string;
}

/** The comic-strip steps: the diagram's parts when there is a diagram, otherwise the lesson steps. */
export function storyFor(lesson: StudyLesson): { title: string; steps: StoryStep[]; fromDiagram: boolean } {
  if (lesson.diagram && lesson.diagram.parts.length >= 2) {
    return {
      title: lesson.diagram.title,
      steps: lesson.diagram.parts.slice(0, 5).map((p) => ({ label: p.label, text: p.explanation })),
      fromDiagram: true,
    };
  }
  return { title: '', steps: lesson.steps.slice(0, 5).map((s) => ({ label: '', text: s })), fromDiagram: false };
}

/** Pops items in one after another; `replay()` plays it again. */
function useStagger(count: number) {
  const values = useRef<Animated.Value[]>([]).current;
  while (values.length < count) values.push(new Animated.Value(0));
  const play = () => {
    values.forEach((v) => v.setValue(0));
    Animated.stagger(
      260,
      values.slice(0, count).map((v) =>
        Animated.timing(v, { toValue: 1, duration: 380, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true })
      )
    ).start();
  };
  useEffect(play, [count]);
  const style = (i: number) => ({
    opacity: values[i],
    transform: [{ scale: values[i].interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
  });
  return { play, style };
}

export function DoodleStory({ lesson }: { lesson: StudyLesson }) {
  const { title, steps } = storyFor(lesson);
  const anim = useStagger(steps.length);
  if (steps.length < 2) return null;
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={styles.kicker}>🎬 See it in steps</Text>
        <TouchableOpacity onPress={anim.play} style={styles.replay} accessibilityLabel="Play the steps again">
          <Text style={styles.replayText}>↻ Play again</Text>
        </TouchableOpacity>
      </View>
      {title ? <Text noTranslate style={styles.title}>{title}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {steps.map((s, i) => {
          const color = COLORS[i % COLORS.length];
          return (
            <React.Fragment key={i}>
              {i > 0 && <Text style={[styles.arrow, { color: color.stroke }]}>➜</Text>}
              <Animated.View style={[styles.panel, { borderColor: color.stroke, backgroundColor: color.fill }, anim.style(i)]}>
                <View style={[styles.stepNo, { backgroundColor: color.stroke }]}>
                  <Text style={styles.stepNoText}>{i + 1}</Text>
                </View>
                <Text style={styles.panelEmoji}>{pickEmoji(`${s.label} ${s.text}`, i)}</Text>
                {s.label ? <Text noTranslate style={styles.panelTitle}>{s.label}</Text> : null}
                {s.text ? <Text noTranslate style={styles.panelText}>{s.text}</Text> : null}
              </Animated.View>
            </React.Fragment>
          );
        })}
      </ScrollView>
      <Text style={styles.swipe}>Swipe to see every step 👉</Text>
    </View>
  );
}

export function DoodleMindMap({ lesson }: { lesson: StudyLesson }) {
  const branches = lesson.mindMap.branches.slice(0, 6);
  const anim = useStagger(branches.length + 1);
  const [open, setOpen] = useState<number | null>(null);
  if (branches.length < 2) return null;
  const central = lesson.mindMap.central || lesson.topic;
  return (
    <View style={styles.section}>
      <Text style={styles.kicker}>🧠 Mind map</Text>
      <Animated.View style={[styles.center, anim.style(0)]}>
        <Text style={styles.centerEmoji}>{pickEmoji(central, 0)}</Text>
        <Text noTranslate style={styles.centerText}>{central}</Text>
      </Animated.View>
      <View style={styles.tree}>
        <View style={styles.trunk} />
        {branches.map((b, i) => {
          const color = COLORS[i % COLORS.length];
          const leaves = b.children.slice(0, 4);
          const isOpen = open === null || open === i;
          return (
            <Animated.View key={`${b.label}-${i}`} style={[styles.branchRow, anim.style(i + 1)]}>
              <View style={[styles.twig, { backgroundColor: color.stroke }]} />
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setOpen(open === i ? null : i)}
                style={[styles.branch, { borderColor: color.stroke, backgroundColor: color.fill }]}
                accessibilityLabel={b.label}
              >
                <Text noTranslate style={styles.branchLabel}>
                  {pickEmoji(`${b.label} ${leaves.join(' ')}`, i + 1)} {b.label}
                </Text>
                {isOpen && leaves.length > 0 && (
                  <View style={styles.leaves}>
                    {leaves.map((leaf, j) => (
                      <View key={j} style={[styles.leaf, { borderColor: color.stroke }]}>
                        <Text noTranslate style={styles.leafText}>{leaf}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const c = theme.colors;
const styles = StyleSheet.create({
  section: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { color: c.amber, fontSize: 16, fontFamily: theme.fonts.heading },
  title: { color: c.text, fontSize: 17, fontFamily: theme.fonts.bodyBold },
  replay: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: c.line, minHeight: 40, justifyContent: 'center' },
  replayText: { color: c.cyanSoft, fontSize: 14, fontFamily: theme.fonts.bodyBold },
  strip: { alignItems: 'center', paddingVertical: 8, paddingRight: 8 },
  arrow: { fontSize: 26, marginHorizontal: 6, fontFamily: theme.fonts.bodyBold },
  panel: { width: 176, minHeight: 200, borderRadius: 22, borderWidth: 3, padding: 14, paddingTop: 18, gap: 6, alignItems: 'center' },
  stepNo: { position: 'absolute', top: -2, left: -2, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepNoText: { color: tc('#ffffff', 'b'), fontSize: 16, fontFamily: theme.fonts.heading },
  panelEmoji: { fontSize: 48, lineHeight: 58 },
  panelTitle: { color: INK, fontSize: 16, fontFamily: theme.fonts.heading, textAlign: 'center' },
  panelText: { color: INK_SOFT, fontSize: 15, lineHeight: 21, fontFamily: theme.fonts.body, textAlign: 'center' },
  swipe: { color: c.textMuted, fontSize: 13, fontFamily: theme.fonts.body },
  center: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: tc('#fef3c7', 'b'), borderColor: tc('#f59e0b', 'b'), borderWidth: 3, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  centerEmoji: { fontSize: 28 },
  centerText: { color: INK, fontSize: 19, fontFamily: theme.fonts.heading, flexShrink: 1 },
  tree: { paddingLeft: 22, gap: 12 },
  trunk: { position: 'absolute', left: 22, top: -12, bottom: 24, width: 4, borderRadius: 2, backgroundColor: tc('#f59e0b', 'b') },
  branchRow: { flexDirection: 'row', alignItems: 'flex-start' },
  twig: { width: 22, height: 4, borderRadius: 2, marginTop: 22 },
  branch: { flex: 1, borderWidth: 3, borderRadius: 18, padding: 12, gap: 8 },
  branchLabel: { color: INK, fontSize: 16, fontFamily: theme.fonts.heading },
  leaves: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  leaf: { backgroundColor: tc('#ffffff', 'b'), borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  leafText: { color: INK, fontSize: 14, fontFamily: theme.fonts.body },
});
