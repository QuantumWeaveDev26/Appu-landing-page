import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useLanguage } from '../i18n/useLanguage';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { t, currentLanguage, setLanguage, languages } = useLanguage();

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

        {/* Language Selection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
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

        {/* Voice & Sound Preference Stubs */}
        <View style={styles.section}>
          <View style={styles.prefRow}>
            <View style={styles.prefCopy}>
              <Text style={styles.prefTitle}>{t('settings.playAloud')}</Text>
              <Text style={styles.prefDesc}>{t('settings.playAloudDesc')}</Text>
            </View>
            <Text style={styles.statusBadge}>ON</Text>
          </View>

          <View style={styles.prefRow}>
            <View style={styles.prefCopy}>
              <Text style={styles.prefTitle}>{t('settings.soundEffects')}</Text>
              <Text style={styles.prefDesc}>{t('settings.soundEffectsDesc')}</Text>
            </View>
            <Text style={styles.statusBadge}>ON</Text>
          </View>

          <View style={styles.prefRow}>
            <View style={styles.prefCopy}>
              <Text style={styles.prefTitle}>{t('settings.speakingSpeed')}</Text>
              <Text style={styles.prefDesc}>{t('settings.speakingSpeedDesc')}</Text>
            </View>
            <Text style={styles.statusBadge}>1.0x</Text>
          </View>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
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
    marginVertical: 12,
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
  prefRow: {
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
  statusBadge: {
    color: theme.colors.cyan,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
  },
});
