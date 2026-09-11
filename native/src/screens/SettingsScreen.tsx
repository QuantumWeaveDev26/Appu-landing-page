import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Switch,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useLanguage } from '../i18n/useLanguage';
import { useSettingsStore } from '../stores/settingsStore';
import { voiceService } from '../lib/voiceService';
import { buildAppuAppShareUrl } from '../lib/studySchedule';
import { OnboardingModal } from '../components/OnboardingModal';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const RATE_PRESETS = [0.80, 0.95, 1.10, 1.25];
const PITCH_PRESETS = [
  { label: 'Calm', value: 0.92 },
  { label: 'Friendly', value: 1.05 },
  { label: 'Cheerful', value: 1.18 },
];

export function SettingsScreen({ navigation }: Props) {
  const { t, currentLanguage, setLanguage, languages } = useLanguage();
  const {
    voiceRate,
    voicePitch,
    autoSpeak,
    soundEffects,
    setVoiceRate,
    setVoicePitch,
    setAutoSpeak,
    setSoundEffects,
    initialize,
  } = useSettingsStore();

  const [isOnboardingVisible, setIsOnboardingVisible] = useState(false);

  useEffect(() => {
    initialize();
  }, []);

  const handleTestVoice = (rate?: number, pitch?: number) => {
    voiceService.testVoice(currentLanguage, rate ?? voiceRate, pitch ?? voicePitch);
  };

  const handleAdjustRate = (delta: number) => {
    const next = Math.max(0.75, Math.min(1.35, Math.round((voiceRate + delta) * 100) / 100));
    setVoiceRate(next);
  };

  const handleShareApp = () => {
    const url = buildAppuAppShareUrl();
    Linking.openURL(url).catch((err) =>
      console.warn('[SettingsScreen] Failed to open WhatsApp share:', err)
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.backBtnText}>‹ {t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('settings.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.leadText}>{t('settings.subtitle')}</Text>

        {/* 1. Language Selection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌐 {t('settings.language')}</Text>
          <View style={styles.langList}>
            {languages.map((lang) => {
              const isSelected = lang.code === currentLanguage;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langItem, isSelected && styles.langItemActive]}
                  onPress={() => setLanguage(lang.code)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.langItemText,
                      isSelected && styles.langItemTextActive,
                    ]}
                  >
                    {lang.label} ({lang.nativeLabel})
                  </Text>
                  {isSelected && <Text style={styles.checkmarkText}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 2. Voice & Audio Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎙️ Voice & Audio Settings</Text>

          {/* Play Answers Aloud (Auto-Speak) */}
          <View style={styles.switchRow}>
            <View style={styles.prefCopy}>
              <Text style={styles.prefTitle}>{t('settings.playAloud')}</Text>
              <Text style={styles.prefDesc}>{t('settings.playAloudDesc')}</Text>
            </View>
            <Switch
              value={autoSpeak}
              onValueChange={setAutoSpeak}
              thumbColor={autoSpeak ? theme.colors.cyan : '#666'}
              trackColor={{ false: '#333', true: 'rgba(34, 211, 238, 0.4)' }}
            />
          </View>

          {/* Sound Effects Toggle */}
          <View style={styles.switchRow}>
            <View style={styles.prefCopy}>
              <Text style={styles.prefTitle}>{t('settings.soundEffects')}</Text>
              <Text style={styles.prefDesc}>{t('settings.soundEffectsDesc')}</Text>
            </View>
            <Switch
              value={soundEffects}
              onValueChange={setSoundEffects}
              thumbColor={soundEffects ? theme.colors.cyan : '#666'}
              trackColor={{ false: '#333', true: 'rgba(34, 211, 238, 0.4)' }}
            />
          </View>

          {/* Speaking Speed (Voice Rate) */}
          <View style={styles.controlBlock}>
            <View style={styles.controlHeader}>
              <View>
                <Text style={styles.prefTitle}>{t('settings.speakingSpeed')}</Text>
                <Text style={styles.prefDesc}>{t('settings.speakingSpeedDesc')}</Text>
              </View>
              <Text style={styles.statusBadge}>{voiceRate.toFixed(2)}x</Text>
            </View>

            {/* Stepper + Presets */}
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => handleAdjustRate(-0.05)}
                activeOpacity={0.7}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>

              <View style={styles.presetPills}>
                {RATE_PRESETS.map((r) => {
                  const isActive = Math.abs(voiceRate - r) < 0.03;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.pillBtn, isActive && styles.pillBtnActive]}
                      onPress={() => setVoiceRate(r)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.pillBtnText,
                          isActive && styles.pillBtnTextActive,
                        ]}
                      >
                        {r.toFixed(2)}x
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => handleAdjustRate(0.05)}
                activeOpacity={0.7}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Voice Tone (Pitch) */}
          <View style={styles.controlBlock}>
            <View style={styles.controlHeader}>
              <View>
                <Text style={styles.prefTitle}>Voice Tone (Pitch)</Text>
                <Text style={styles.prefDesc}>Select Appu’s speaking personality style.</Text>
              </View>
              <Text style={styles.statusBadge}>{voicePitch.toFixed(2)}</Text>
            </View>

            <View style={styles.pitchPillsRow}>
              {PITCH_PRESETS.map((p) => {
                const isActive = Math.abs(voicePitch - p.value) < 0.05;
                return (
                  <TouchableOpacity
                    key={p.label}
                    style={[styles.pitchPill, isActive && styles.pitchPillActive]}
                    onPress={() => setVoicePitch(p.value)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.pitchPillText,
                        isActive && styles.pitchPillTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Live Preview Button */}
          <TouchableOpacity
            style={styles.testVoiceBtn}
            onPress={() => handleTestVoice()}
            activeOpacity={0.8}
          >
            <Text style={styles.testVoiceText}>🔊 Preview Voice Sample</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Study Reminders & Calendar Touchpoint */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.touchpointRow}
            onPress={() => navigation.navigate('StudySchedule')}
            activeOpacity={0.75}
          >
            <View style={styles.touchpointIconWrap}>
              <Text style={styles.touchpointEmoji}>⏰</Text>
            </View>
            <View style={styles.touchpointCopy}>
              <Text style={styles.prefTitle}>Study Reminders & Schedule</Text>
              <Text style={styles.prefDesc}>
                Add study reminders with 1-tap Google Calendar integration and WhatsApp notes.
              </Text>
            </View>
            <Text style={styles.chevronText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Parent Zone Touchpoint */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.touchpointRow}
            onPress={() => navigation.navigate('ParentZone')}
            activeOpacity={0.75}
          >
            <View style={styles.touchpointIconWrap}>
              <Text style={styles.touchpointEmoji}>👨‍👩‍👧</Text>
            </View>
            <View style={styles.touchpointCopy}>
              <Text style={styles.prefTitle}>{t('parent.title')}</Text>
              <Text style={styles.prefDesc}>{t('parent.subtitle')}</Text>
            </View>
            <Text style={styles.chevronText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 5. WhatsApp Share / Community CTA */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.whatsappCard}
            onPress={handleShareApp}
            activeOpacity={0.8}
          >
            <View style={styles.whatsappCardContent}>
              <Text style={styles.whatsappEmoji}>💬</Text>
              <View style={styles.whatsappCopy}>
                <Text style={styles.whatsappTitle}>Share APPU on WhatsApp</Text>
                <Text style={styles.whatsappDesc}>
                  Know other parents or students? Invite them to explore interactive AI learning!
                </Text>
              </View>
            </View>
            <View style={styles.whatsappActionBadge}>
              <Text style={styles.whatsappActionText}>Share ↗</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 6. Legal & Policies Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🛡️ Legal & Privacy</Text>

          <TouchableOpacity
            style={styles.legalItem}
            onPress={() => navigation.navigate('Legal', { initialTab: 'privacy' })}
            activeOpacity={0.75}
          >
            <Text style={styles.legalItemText}>Privacy Policy</Text>
            <Text style={styles.chevronSmall}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.legalItem}
            onPress={() => navigation.navigate('Legal', { initialTab: 'terms' })}
            activeOpacity={0.75}
          >
            <Text style={styles.legalItemText}>Terms & Conditions</Text>
            <Text style={styles.chevronSmall}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.legalItem}
            onPress={() => navigation.navigate('Legal', { initialTab: 'cancellation' })}
            activeOpacity={0.75}
          >
            <Text style={styles.legalItemText}>Cancellation & Refunds</Text>
            <Text style={styles.chevronSmall}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.legalItem}
            onPress={() => navigation.navigate('Legal', { initialTab: 'shipping' })}
            activeOpacity={0.75}
          >
            <Text style={styles.legalItemText}>Shipping & Delivery</Text>
            <Text style={styles.chevronSmall}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.legalItem}
            onPress={() => navigation.navigate('Legal', { initialTab: 'pricing' })}
            activeOpacity={0.75}
          >
            <Text style={styles.legalItemText}>Pricing Policy</Text>
            <Text style={styles.chevronSmall}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.legalItem, { borderBottomWidth: 0 }]}
            onPress={() => navigation.navigate('Legal', { initialTab: 'contact' })}
            activeOpacity={0.75}
          >
            <Text style={styles.legalItemText}>Contact Us (IGR Academy)</Text>
            <Text style={styles.chevronSmall}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 7. App Tour & Onboarding */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.tourBtn}
            onPress={() => setIsOnboardingVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.tourBtnText}>🚀 Take the Appu Feature Tour</Text>
          </TouchableOpacity>
        </View>

        {/* Footer info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>APPU Native v1.0.0 (Build 1) - Preview</Text>
          <Text style={styles.footerSubtext}>Dedicated to curious young learners across India</Text>
        </View>
      </ScrollView>

      {/* Onboarding Walkthrough Modal */}
      <OnboardingModal
        visible={isOnboardingVisible}
        onClose={() => setIsOnboardingVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
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
  leadText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginVertical: 10,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginTop: 14,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  langList: {
    gap: 8,
  },
  langItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  langItemActive: {
    borderColor: theme.colors.cyan,
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
  },
  langItemText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  langItemTextActive: {
    color: theme.colors.cyan,
    fontWeight: '700',
  },
  checkmarkText: {
    color: theme.colors.cyan,
    fontSize: 14,
    fontWeight: '800',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  prefCopy: {
    flex: 1,
    paddingRight: 16,
  },
  prefTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  prefDesc: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  controlBlock: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  controlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  statusBadge: {
    color: theme.colors.cyan,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: theme.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    color: theme.colors.cyan,
    fontSize: 18,
    fontWeight: '700',
  },
  presetPills: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  pillBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pillBtnActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderColor: theme.colors.cyan,
  },
  pillBtnText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  pillBtnTextActive: {
    color: theme.colors.cyan,
    fontWeight: '700',
  },
  pitchPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pitchPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
  },
  pitchPillActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderColor: theme.colors.cyan,
  },
  pitchPillText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  pitchPillTextActive: {
    color: theme.colors.cyan,
    fontWeight: '700',
  },
  testVoiceBtn: {
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.25)',
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  testVoiceText: {
    color: theme.colors.cyan,
    fontSize: 12,
    fontWeight: '700',
  },
  touchpointRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  touchpointIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  touchpointEmoji: {
    fontSize: 18,
  },
  touchpointCopy: {
    flex: 1,
    paddingRight: 12,
  },
  chevronText: {
    color: theme.colors.cyan,
    fontSize: 22,
    fontWeight: '700',
  },
  whatsappCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(37, 211, 102, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.25)',
    borderRadius: theme.radius.md,
    padding: 12,
  },
  whatsappCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  whatsappEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  whatsappCopy: {
    flex: 1,
  },
  whatsappTitle: {
    color: '#25D366',
    fontSize: 13,
    fontWeight: '700',
  },
  whatsappDesc: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  whatsappActionBadge: {
    backgroundColor: '#25D366',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
  },
  whatsappActionText: {
    color: '#06101f',
    fontSize: 11,
    fontWeight: '800',
  },
  legalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  legalItemText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  chevronSmall: {
    color: theme.colors.textMuted,
    fontSize: 16,
  },
  tourBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tourBtnText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
    paddingBottom: 16,
  },
  footerText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  footerSubtext: {
    color: 'rgba(255, 255, 255, 0.25)',
    fontSize: 10,
    marginTop: 3,
  },
});
