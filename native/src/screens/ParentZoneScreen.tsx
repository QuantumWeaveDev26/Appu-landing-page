import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useLanguage } from '../i18n/useLanguage';

type Props = NativeStackScreenProps<RootStackParamList, 'ParentZone'>;

export function ParentZoneScreen({ navigation }: Props) {
  const { t } = useLanguage();

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
          <Text style={styles.headerTitle}>{t('parent.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.leadText}>{t('parent.subtitle')}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>👨‍👩‍👦 {t('parent.addLearner')}</Text>
          <Text style={styles.cardDesc}>
            Configure your student companion, active learning plan, and personalized preferences.
          </Text>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('Auth')}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>{t('auth.signInButton')}</Text>
          </TouchableOpacity>
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
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.lg,
    padding: 20,
    marginTop: 12,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardDesc: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 18,
  },
  actionBtn: {
    backgroundColor: theme.colors.cyan,
    borderRadius: theme.radius.md,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#00121d',
    fontSize: 13,
    fontWeight: '800',
  },
});
