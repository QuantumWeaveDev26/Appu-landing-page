import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useLanguage } from '../i18n/useLanguage';
import { useAuthStore } from '../stores/authStore';
import {
  StudySessionItem,
  getStoredStudySessions,
  saveStudySession,
  deleteStudySession,
  buildGoogleCalendarUrl,
  buildWhatsAppShareUrl,
} from '../lib/studySchedule';

type Props = NativeStackScreenProps<RootStackParamList, 'StudySchedule'>;

const TOPIC_PRESETS = [
  'Math - Fractions & Decimals',
  'Science - The Solar System',
  'Kannada - Aksharamale & Rhymes',
  'English - Creative Storytelling',
  'History - Ancient Civilizations',
  'Physics - Laws of Motion',
];

const TIME_PRESETS = [
  { label: 'Today 5:00 PM', getOffset: () => {
    const d = new Date();
    d.setHours(17, 0, 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    return d;
  }},
  { label: 'Tomorrow 10:00 AM', getOffset: () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  }},
  { label: 'Tomorrow 4:00 PM', getOffset: () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(16, 0, 0, 0);
    return d;
  }},
  { label: 'Weekend Morning', getOffset: () => {
    const d = new Date();
    const daysUntilSaturday = (6 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilSaturday);
    d.setHours(10, 0, 0, 0);
    return d;
  }},
];

export function StudyScheduleScreen({ navigation, route }: Props) {
  const { t } = useLanguage();
  const { activeChild, activeChildId } = useAuthStore();

  const [topic, setTopic] = useState(route.params?.prefillTopic || '');
  const [selectedTimeIdx, setSelectedTimeIdx] = useState(0);
  const [notes, setNotes] = useState('');
  const [sessions, setSessions] = useState<StudySessionItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const items = await getStoredStudySessions();
    setSessions(items);
  };

  const handleCreateSchedule = async () => {
    if (!topic.trim()) {
      Alert.alert('Topic Required', 'Please enter or select a topic to study.');
      return;
    }

    setIsSaving(true);
    try {
      const selectedPreset = TIME_PRESETS[selectedTimeIdx] || TIME_PRESETS[0];
      const scheduledDate = selectedPreset.getOffset();

      const newSession = await saveStudySession({
        topic: topic.trim(),
        scheduledAt: scheduledDate.toISOString(),
        timeDisplay: selectedPreset.label,
        childId: activeChildId || undefined,
        childName: activeChild?.preferredName || undefined,
        notes: notes.trim() || undefined,
      });

      setTopic('');
      setNotes('');
      await loadSessions();

      // Open Google Calendar template URL
      if (newSession.calendarUrl) {
        Linking.openURL(newSession.calendarUrl).catch((err) => {
          console.warn('[StudySchedule] Failed to launch Google Calendar:', err);
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save study reminder.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteStudySession(id);
    await loadSessions();
  };

  const handleShareWhatsApp = (item: StudySessionItem) => {
    const text = `Scheduled study session on *${item.topic}* for ${item.timeDisplay}.\nJoin APPU to review study questions together!`;
    const url = buildWhatsAppShareUrl(undefined, text, item.childName);
    Linking.openURL(url).catch((err) =>
      console.warn('[StudySchedule] Failed to open WhatsApp:', err)
    );
  };

  const handleStudyWithAppu = (item: StudySessionItem) => {
    navigation.navigate('Chat', {
      initialPrompt: `Appu, please help me study "${item.topic}". I have a study session scheduled for ${item.timeDisplay}!`,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backBtnText}>‹ {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Study Reminders</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroIcon}>⏰</Text>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Smart Study Reminders</Text>
            <Text style={styles.heroDesc}>
              Set up learning sessions with 1-tap Google Calendar integration.
              APPU prepares study notes and questions in advance!
            </Text>
          </View>
        </View>

        {/* Schedule Form */}
        <View style={styles.formCard}>
          <Text style={styles.sectionHeader}>Schedule a New Session</Text>

          {/* Learner indicator if active */}
          {activeChild && (
            <View style={styles.learnerTag}>
              <Text style={styles.learnerTagText}>
                👦 Learner: <Text style={styles.learnerTagName}>{activeChild.preferredName}</Text>
              </Text>
            </View>
          )}

          {/* Topic Input */}
          <Text style={styles.inputLabel}>Study Topic or Question</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Science - Solar System, Math - Fractions"
            placeholderTextColor={theme.colors.textMuted}
            value={topic}
            onChangeText={setTopic}
          />

          {/* Preset Topics */}
          <Text style={styles.subLabel}>Quick Presets:</Text>
          <View style={styles.chipRow}>
            {TOPIC_PRESETS.map((p, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.topicChip, topic === p && styles.topicChipActive]}
                onPress={() => setTopic(p)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.topicChipText,
                    topic === p && styles.topicChipTextActive,
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Time Presets */}
          <Text style={styles.inputLabel}>When would you like to study?</Text>
          <View style={styles.timeGrid}>
            {TIME_PRESETS.map((tp, idx) => {
              const isSelected = selectedTimeIdx === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.timeCard, isSelected && styles.timeCardActive]}
                  onPress={() => setSelectedTimeIdx(idx)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.timeCardText,
                      isSelected && styles.timeCardTextActive,
                    ]}
                  >
                    📅 {tp.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Optional Notes */}
          <Text style={styles.inputLabel}>Notes / Specific Questions (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="e.g. Focus on word problems and practice questions"
            placeholderTextColor={theme.colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
          />

          {/* Save & Calendar Action Button */}
          <TouchableOpacity
            style={[styles.primaryBtn, isSaving && styles.btnDisabled]}
            onPress={handleCreateSchedule}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>
              {isSaving ? 'Scheduling…' : '📅 Add to Google Calendar'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Upcoming Schedules List */}
        <View style={styles.listSection}>
          <Text style={styles.sectionHeader}>Upcoming Study Sessions ({sessions.length})</Text>

          {sessions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📚</Text>
              <Text style={styles.emptyTitle}>No scheduled sessions yet</Text>
              <Text style={styles.emptyDesc}>
                Add a study reminder above to create calendar events and stay on track!
              </Text>
            </View>
          ) : (
            sessions.map((item) => (
              <View key={item.id} style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <View style={styles.sessionMain}>
                    <Text style={styles.sessionTopic}>{item.topic}</Text>
                    <Text style={styles.sessionTime}>⏰ {item.timeDisplay}</Text>
                    {item.childName && (
                      <Text style={styles.sessionChild}>👤 {item.childName}</Text>
                    )}
                    {item.notes && (
                      <Text style={styles.sessionNotes}>📝 {item.notes}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.delBtn}
                    onPress={() => handleDelete(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.delBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Session Action Buttons */}
                <View style={styles.sessionActions}>
                  <TouchableOpacity
                    style={styles.sessionActionBtn}
                    onPress={() => handleStudyWithAppu(item)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.sessionActionText}>🤖 Study with Appu</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.sessionActionBtn}
                    onPress={() => handleShareWhatsApp(item)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.sessionActionText}>💬 WhatsApp</Text>
                  </TouchableOpacity>

                  {item.calendarUrl && (
                    <TouchableOpacity
                      style={styles.sessionActionBtn}
                      onPress={() => Linking.openURL(item.calendarUrl)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.sessionActionText}>📅 Calendar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backBtnText: {
    color: theme.colors.cyan,
    fontSize: 16,
    fontWeight: '700',
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 48,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.25)',
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 16,
  },
  heroIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    color: theme.colors.cyan,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  heroDesc: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  learnerTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  learnerTagText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  learnerTagName: {
    color: theme.colors.cyan,
    fontWeight: '700',
  },
  inputLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
  },
  subLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 6,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 14,
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  topicChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  topicChipActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.15)',
    borderColor: theme.colors.cyan,
  },
  topicChipText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  topicChipTextActive: {
    color: theme.colors.cyan,
    fontWeight: '700',
  },
  timeGrid: {
    gap: 8,
    marginBottom: 10,
  },
  timeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  timeCardActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderColor: theme.colors.cyan,
  },
  timeCardText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  timeCardTextActive: {
    color: theme.colors.cyan,
    fontWeight: '700',
  },
  primaryBtn: {
    backgroundColor: theme.colors.cyan,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: theme.colors.bg,
    fontSize: 14,
    fontWeight: '700',
  },
  listSection: {
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyDesc: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  sessionCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sessionMain: {
    flex: 1,
    paddingRight: 10,
  },
  sessionTopic: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  sessionTime: {
    color: theme.colors.cyan,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  sessionChild: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginBottom: 2,
  },
  sessionNotes: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  delBtn: {
    padding: 6,
  },
  delBtnText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  sessionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  sessionActionBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sessionActionText: {
    color: theme.colors.cyan,
    fontSize: 11,
    fontWeight: '600',
  },
});
