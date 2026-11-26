/** Full-screen voice call with Appu (website voice-call.js, character.ai style). */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from './AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, tc } from '../theme';

export type CallState = 'listening' | 'thinking' | 'speaking';

const LABELS: Record<CallState, string> = {
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Appu is speaking',
};

interface Props {
  visible: boolean;
  state: CallState;
  heard: string;
  startedAt: number;
  onInterrupt: () => void;
  onEnd: () => void;
}

export function CallScreen({ visible, state, heard, startedAt, onInterrupt, onEnd }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: state === 'speaking' ? 900 : 1600, easing: Easing.out(Easing.quad), useNativeDriver: true })
    );
    pulse.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [visible, state]);

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setSeconds(Math.max(0, Math.round((Date.now() - startedAt) / 1000))), 1000);
    return () => clearInterval(t);
  }, [visible, startedAt]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  const color = state === 'speaking' ? theme.colors.cyanSoft : state === 'thinking' ? theme.colors.amber : tc('#4ade80', 'b');
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onEnd}>
      <SafeAreaView style={styles.safe}>
        <Text style={styles.title}>Voice call with Appu</Text>
        <Text style={styles.timer}>
          {mm}:{ss}
        </Text>
        <View style={styles.center}>
          <TouchableOpacity
            onPress={onInterrupt}
            activeOpacity={0.85}
            accessibilityLabel="Tap to interrupt Appu"
            style={styles.orbWrap}
          >
            <Animated.View style={[styles.ring, { borderColor: color, opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
            <View style={[styles.orb, { borderColor: color }]}>
              <Text style={styles.orbIcon}>{state === 'speaking' ? '🔊' : state === 'thinking' ? '💭' : '🎙️'}</Text>
            </View>
          </TouchableOpacity>
          <Text style={[styles.state, { color }]} accessibilityLiveRegion="polite">
            {LABELS[state]}
          </Text>
          <Text style={styles.heard} numberOfLines={3}>
            {heard ? `“${heard}”` : ' '}
          </Text>
          <Text style={styles.hint}>Tap Appu or just talk to interrupt</Text>
        </View>
        <TouchableOpacity style={styles.end} onPress={onEnd} accessibilityLabel="End call">
          <Text style={styles.endText}>📵  End call</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tc('#080e1c', 'b'), alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16 },
  title: { color: theme.colors.text, fontSize: 18, fontFamily: theme.fonts.heading, marginTop: 16 },
  timer: { color: theme.colors.textMuted, fontSize: 14, fontFamily: theme.fonts.body, marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, alignSelf: 'stretch' },
  orbWrap: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 170, height: 170, borderRadius: 85, borderWidth: 3 },
  orb: { width: 160, height: 160, borderRadius: 80, borderWidth: 3, backgroundColor: tc('#22467a', 'b'), alignItems: 'center', justifyContent: 'center' },
  orbIcon: { fontSize: 52 },
  state: { fontSize: 20, fontFamily: theme.fonts.heading },
  heard: { color: theme.colors.text, fontSize: 16, fontFamily: theme.fonts.body, textAlign: 'center', minHeight: 48 },
  hint: { color: theme.colors.textMuted, fontSize: 13, fontFamily: theme.fonts.body },
  end: { backgroundColor: tc('#dc2626', 'b'), borderRadius: 999, minHeight: 56, paddingHorizontal: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  endText: { color: tc('#fff', 't'), fontSize: 17, fontFamily: theme.fonts.bodyBold },
});
