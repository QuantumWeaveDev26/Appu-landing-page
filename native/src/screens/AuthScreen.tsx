import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useLanguage } from '../i18n/useLanguage';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;

export function AuthScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [household, setHousehold] = useState('');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Back header */}
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

        {/* Tab switch */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'login' && styles.tabActive]}
            onPress={() => setTab('login')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>
              {t('auth.signInTab')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'signup' && styles.tabActive]}
            onPress={() => setTab('signup')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, tab === 'signup' && styles.tabTextActive]}>
              {t('auth.createAccountTab')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Google sign-in button stub */}
        <TouchableOpacity
          style={styles.googleBtn}
          onPress={() => {}}
          activeOpacity={0.85}
        >
          <Text style={styles.googleBtnText}>G  {t('auth.continueWithGoogle')}</Text>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('common.or')}</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email / Password Form */}
        <View style={styles.form}>
          <Text style={styles.label}>{t('auth.emailLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor={theme.colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>{t('auth.passwordLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('auth.passwordPlaceholder')}
            placeholderTextColor={theme.colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {tab === 'signup' && (
            <>
              <Text style={styles.label}>{t('auth.householdLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.householdPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                value={household}
                onChangeText={setHousehold}
              />
            </>
          )}

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={() => {}}
            activeOpacity={0.8}
          >
            <Text style={styles.submitBtnText}>
              {tab === 'login' ? t('auth.signInButton') : t('auth.signUpButton')}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.noticeText}>{t('auth.guestNotice')}</Text>
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
    padding: 4,
    marginVertical: 16,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: theme.radius.sm,
  },
  tabActive: {
    backgroundColor: theme.colors.cyan,
  },
  tabText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#00121d',
  },
  googleBtn: {
    backgroundColor: '#ffffff',
    borderRadius: theme.radius.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  googleBtnText: {
    color: '#1f1f1f',
    fontSize: 14,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.line,
  },
  dividerText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  form: {
    gap: 8,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    fontSize: 14,
    paddingHorizontal: 14,
    minHeight: 46,
  },
  submitBtn: {
    backgroundColor: theme.colors.cyan,
    borderRadius: theme.radius.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  submitBtnText: {
    color: '#00121d',
    fontSize: 14,
    fontWeight: '800',
  },
  noticeText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
});
