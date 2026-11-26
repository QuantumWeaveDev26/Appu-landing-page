/**
 * The website's ☰ sidebar (DESIGN.md order): New chat, Recent chats, My Learning; My Progress;
 * ▸ Learning missions; Parent Zone; Child Progress Report; ▸ Settings; account at the bottom.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from './AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, tc } from '../theme';
import { useLanguage } from '../i18n/useLanguage';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { levelFor, useProgressStore } from '../stores/progressStore';
import { useSavedLessonsStore } from '../stores/savedLessonsStore';
import { switchTheme } from '../lib/themePref';

export const MISSIONS = [
  { icon: '💡', title: 'Explain My Topic', prompt: 'Explain a school topic to me in a simple, fun way. Ask me which topic I want to learn.' },
  { icon: '⚡', title: 'Play a Quick Quiz', prompt: 'Play a quick five-question quiz with me. Ask me which subject I want.' },
  { icon: '📖', title: 'Homework Helper', prompt: 'Help me with my homework without simply giving the answer. Ask me to share the question and guide me step by step.' },
  { icon: '🏅', title: 'Exam Practice', prompt: 'Help me practise for an exam. Ask me the subject, chapter and exam date.' },
];

export type DrawerAction =
  | 'newChat'
  | 'recent'
  | 'myLearning'
  | 'achievements'
  | 'explorePrompts'
  | 'parentZone'
  | 'reports'
  | 'studySchedule'
  | 'settings'
  | 'tour'
  | 'signIn'
  | 'signOut'
  | 'legal';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAction: (action: DrawerAction) => void;
  onMission: (prompt: string) => void;
}

const WIDTH = Math.min(320, Dimensions.get('window').width * 0.86);

export function SideDrawer({ visible, onClose, onAction, onMission }: Props) {
  const { currentLanguage, setLanguage, languages } = useLanguage();
  const { user, isGuest, activeChild } = useAuthStore();
  const { soundEffects, autoSpeak, setSoundEffects, setAutoSpeak } = useSettingsStore();
  const { xp, streak } = useProgressStore();
  const savedCount = useSavedLessonsStore((s) => s.items.length);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const slide = useRef(new Animated.Value(-WIDTH)).current;
  const level = levelFor(xp);
  const signedIn = Boolean(user) && !isGuest;

  useEffect(() => {
    Animated.timing(slide, { toValue: visible ? 0 : -WIDTH, duration: 220, useNativeDriver: true }).start();
  }, [visible]);

  const act = (a: DrawerAction) => {
    onClose();
    onAction(a);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close menu" />
      <Animated.View style={[styles.panel, { transform: [{ translateX: slide }] }]}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom', 'left']}>
          <View style={styles.top}>
            <Text style={styles.brand}>APPU</Text>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn} accessibilityLabel="Close menu">
              <Text style={styles.iconText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Item icon="✏️" label="New chat" onPress={() => act('newChat')} />
            <Item icon="🕒" label="Recent chats" onPress={() => act('recent')} />
            <Item icon="📚" label="My Learning" badge={savedCount ? String(savedCount) : undefined} onPress={() => act('myLearning')} />

            <Text style={styles.section}>My Progress</Text>
            <TouchableOpacity style={styles.progress} onPress={() => act('achievements')} activeOpacity={0.8}>
              <Pill text={`🔥 ${streak}`} />
              <Pill text={`⭐ ${xp}`} />
              <Pill text={`Lvl ${level.level}`} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.collapse} onPress={() => setMissionsOpen(!missionsOpen)}>
              <Text style={styles.section}>{missionsOpen ? '▾' : '▸'} Learning missions</Text>
            </TouchableOpacity>
            {missionsOpen && (
              <View style={styles.chips}>
                {MISSIONS.map((m) => (
                  <TouchableOpacity
                    key={m.title}
                    style={styles.chip}
                    onPress={() => {
                      onClose();
                      onMission(m.prompt);
                    }}
                  >
                    <Text style={styles.chipText}>
                      {m.icon} {m.title}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.chip} onPress={() => act('explorePrompts')}>
                  <Text style={styles.chipText}>🧭 Explore prompts</Text>
                </TouchableOpacity>
              </View>
            )}

            <Item icon="👨‍👩‍👧" label="Parent Zone" onPress={() => act('parentZone')} />
            <Item icon="📊" label="Child Progress Report" onPress={() => act('reports')} />
            <Item icon="⏰" label="Study reminders" onPress={() => act('studySchedule')} />

            <TouchableOpacity style={styles.collapse} onPress={() => setSettingsOpen(!settingsOpen)}>
              <Text style={styles.section}>{settingsOpen ? '▾' : '▸'} Settings</Text>
            </TouchableOpacity>
            {settingsOpen && (
              <View style={styles.settings}>
                <Text style={styles.label}>Language</Text>
                <View style={styles.langRow}>
                  {languages.map((l) => (
                    <TouchableOpacity
                      key={l.code}
                      style={[styles.lang, l.code === currentLanguage && styles.langActive]}
                      onPress={() => setLanguage(l.code)}
                    >
                      <Text style={[styles.langText, l.code === currentLanguage && styles.langTextActive]}>
                        {l.nativeLabel}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Toggle label="Sound effects" value={soundEffects} onChange={setSoundEffects} />
                <Toggle label="Read answers aloud" value={autoSpeak} onChange={setAutoSpeak} />
                <Toggle
                  label="Light mode"
                  value={theme.mode === 'light'}
                  onChange={(on) => {
                    void switchTheme(on ? 'light' : 'dark').then((restarted) => {
                      if (!restarted) Alert.alert('Appu', 'Close and reopen Appu to see the new theme.');
                    });
                  }}
                />
                <Item icon="🧭" label="Take the tour" onPress={() => act('tour')} />
                <Item icon="⚙️" label="All settings" onPress={() => act('settings')} />
                <Item icon="📄" label="Policies & contact" onPress={() => act('legal')} />
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {signedIn ? (
              <>
                <View style={{ flex: 1 }}>
                  <Text style={styles.account} numberOfLines={1}>
                    {activeChild?.preferredName || user?.email || 'Signed in'}
                  </Text>
                  {user?.email ? (
                    <Text style={styles.accountSub} numberOfLines={1}>
                      {user.email}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity style={styles.outBtn} onPress={() => act('signOut')}>
                  <Text style={styles.outText}>Sign out</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.signIn} onPress={() => act('signIn')}>
                <Text style={styles.signInText}>Sign in</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

function Item({ icon, label, badge, onPress }: { icon: string; label: string; badge?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.75}>
      <Text style={styles.itemIcon}>{icon}</Text>
      <Text style={styles.itemLabel}>{label}</Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function Pill({ text }: { text: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{text}</Text>
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.itemLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        thumbColor={value ? theme.colors.cyan : tc('#64748b', 'b')}
        trackColor={{ false: tc('#1e293b', 'b'), true: tc('rgba(14,165,233,0.45)', 'b') }}
      />
    </View>
  );
}

const c = theme.colors;
const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: tc('rgba(2,6,15,0.6)', 'b') },
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, width: WIDTH, backgroundColor: c.bgElevated, borderRightWidth: 1, borderRightColor: c.line },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  brand: { color: c.text, fontSize: 20, fontFamily: theme.fonts.heading, letterSpacing: 1 },
  iconBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: c.textMuted, fontSize: 18 },
  scroll: { paddingHorizontal: 10, paddingBottom: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46, paddingHorizontal: 10, borderRadius: 12 },
  itemIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  itemLabel: { flex: 1, color: c.text, fontSize: 15, fontFamily: theme.fonts.body },
  badge: { backgroundColor: c.cyan, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: tc('#04121f', 't'), fontSize: 12, fontFamily: theme.fonts.bodyBold },
  section: { color: c.textMuted, fontSize: 13, fontFamily: theme.fonts.bodyBold, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 10, marginTop: 14, marginBottom: 6 },
  collapse: { minHeight: 44, justifyContent: 'center' },
  progress: { flexDirection: 'row', gap: 8, paddingHorizontal: 10, minHeight: 44, alignItems: 'center' },
  pill: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { color: c.text, fontSize: 14, fontFamily: theme.fonts.bodyBold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 10 },
  chip: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: c.line, borderRadius: 999, paddingHorizontal: 14, backgroundColor: c.surface },
  chipText: { color: c.text, fontSize: 14, fontFamily: theme.fonts.body },
  settings: { gap: 4 },
  label: { color: c.textMuted, fontSize: 13, fontFamily: theme.fonts.body, paddingHorizontal: 10 },
  langRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 10, marginBottom: 6 },
  lang: { minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: c.line, justifyContent: 'center' },
  langActive: { backgroundColor: c.cyan, borderColor: c.cyan },
  langText: { color: c.text, fontSize: 14, fontFamily: theme.fonts.body },
  langTextActive: { color: tc('#04121f', 't'), fontFamily: theme.fonts.bodyBold },
  toggle: { flexDirection: 'row', alignItems: 'center', minHeight: 46, paddingHorizontal: 10 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: c.line, padding: 14 },
  account: { color: c.text, fontSize: 15, fontFamily: theme.fonts.bodyBold },
  accountSub: { color: c.textMuted, fontSize: 12, fontFamily: theme.fonts.body },
  outBtn: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.line },
  outText: { color: c.textMuted, fontSize: 14, fontFamily: theme.fonts.bodyBold },
  signIn: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: c.cyan, alignItems: 'center', justifyContent: 'center' },
  signInText: { color: tc('#04121f', 't'), fontSize: 16, fontFamily: theme.fonts.bodyBold },
});
