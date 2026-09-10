import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from './src/theme';

/**
 * APPU native app — Phase 0 shell.
 * Pure React Native primitives (no extra deps yet) so it runs as soon as the
 * project is installed. Navigation, auth, avatar, chat, voice, etc. arrive in
 * later phases per docs/native-app/2026-09-10-react-native-plan.md.
 */
export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.eyebrow}>IGR ACADEMY</Text>
      <Text style={styles.brand}>APPU</Text>
      <Text style={styles.title}>
        What will we <Text style={styles.titleAccent}>discover today?</Text>
      </Text>
      <View style={styles.badge}>
        <View style={styles.dot} />
        <Text style={styles.badgeText}>Native app · Phase 0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  eyebrow: {
    color: theme.colors.cyanSoft,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 10,
  },
  brand: {
    color: theme.colors.text,
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 32,
  },
  titleAccent: { color: theme.colors.cyan },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.cyan,
  },
  badgeText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' },
});
