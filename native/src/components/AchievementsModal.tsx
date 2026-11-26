/** Achievements sheet (website gamification modal) + the floating "+XP" toast. */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from './AppText';
import { theme, tc } from '../theme';
import { BADGE_RULES, LEVELS, levelFor, useProgressStore } from '../stores/progressStore';

export function AchievementsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { xp, streak, bestStreak, badges } = useProgressStore();
  const level = levelFor(xp);
  const next = LEVELS.find((l) => l.level === level.level + 1);
  const pct = next ? Math.min(1, (xp - level.minXp) / (next.minXp - level.minXp)) : 1;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
          <Text style={styles.title}>My achievements</Text>
          <Text style={styles.subtitle}>
            Level {level.level}: {level.title}
          </Text>
          <View style={styles.stats}>
            <Stat value={`${streak}`} label={streak === 1 ? 'Day streak' : 'Days streak'} icon="🔥" />
            <Stat value={`${xp}`} label="XP stars" icon="⭐" />
            <Stat value={`${badges.length}`} label={badges.length === 1 ? 'Badge' : 'Badges'} icon="🏅" />
          </View>
          <View>
            <View style={styles.barRow}>
              <Text style={styles.small}>{next ? `Next: Level ${next.level}` : 'Top level reached!'}</Text>
              <Text style={styles.small}>{next ? `${xp - level.minXp} / ${next.minXp - level.minXp} XP` : `${xp} XP`}</Text>
            </View>
            <View style={styles.bar}>
              <View style={[styles.fill, { width: `${Math.round(pct * 100)}%` }]} />
            </View>
          </View>
          <Text style={styles.small}>Best streak: {bestStreak} days</Text>
          <View style={styles.grid}>
            {BADGE_RULES.map((b) => {
              const on = badges.includes(b.id);
              return (
                <View key={b.id} style={[styles.badge, !on && styles.badgeLocked]}>
                  <Text style={[styles.badgeIcon, !on && { opacity: 0.35 }]}>{b.icon}</Text>
                  <Text style={styles.badgeName}>{b.name}</Text>
                  <Text style={styles.badgeRule}>{on ? 'Unlocked!' : b.rule}</Text>
                </View>
              );
            })}
          </View>
          <TouchableOpacity style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Keep learning</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Stat({ value, label, icon }: { value: string; label: string; icon: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>
        {icon} {value}
      </Text>
      <Text style={styles.small}>{label}</Text>
    </View>
  );
}

/** Shows "+20 XP · Quiz answer correct!" briefly whenever progress changes. */
export function XpToast() {
  const { toast, clearToast } = useProgressStore();
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    y.setValue(0);
    Animated.sequence([
      Animated.timing(y, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(y, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(() => clearToast());
  }, [toast?.id]);

  if (!toast) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        { opacity: y, transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] },
      ]}
    >
      <Text style={styles.toastText}>{toast.text}</Text>
    </Animated.View>
  );
}

const c = theme.colors;
const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: tc('rgba(2,6,15,0.6)', 'b') },
  sheet: { maxHeight: '85%', backgroundColor: c.bgElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, borderWidth: 1, borderColor: c.line },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: c.line, marginBottom: 12 },
  title: { color: c.text, fontSize: 22, fontFamily: theme.fonts.heading },
  subtitle: { color: c.cyanSoft, fontSize: 15, fontFamily: theme.fonts.bodyBold },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: c.surface, borderRadius: 14, padding: 12, gap: 2, borderWidth: 1, borderColor: c.line },
  statValue: { color: c.text, fontSize: 18, fontFamily: theme.fonts.heading },
  small: { color: c.textMuted, fontSize: 13, fontFamily: theme.fonts.body },
  barRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  bar: { height: 10, borderRadius: 5, backgroundColor: c.surface, overflow: 'hidden' },
  fill: { height: 10, backgroundColor: c.cyan },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: { width: '47%', backgroundColor: c.surface, borderRadius: 14, padding: 12, gap: 4, borderWidth: 1, borderColor: c.cyan },
  badgeLocked: { borderColor: c.line },
  badgeIcon: { fontSize: 26 },
  badgeName: { color: c.text, fontSize: 15, fontFamily: theme.fonts.bodyBold },
  badgeRule: { color: c.textMuted, fontSize: 12, fontFamily: theme.fonts.body },
  close: { backgroundColor: c.cyan, borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: tc('#04121f', 't'), fontSize: 16, fontFamily: theme.fonts.bodyBold },
  toast: { position: 'absolute', top: 70, alignSelf: 'center', backgroundColor: tc('#12325a', 'b'), borderColor: c.cyan, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, zIndex: 50 },
  toastText: { color: c.text, fontSize: 14, fontFamily: theme.fonts.bodyBold },
});
