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

import { useAuthStore } from '../stores/authStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { t, currentLanguage, setLanguage, languages } = useLanguage();
  const { user, isGuest, guestRemainingQuota, signOut } = useAuthStore();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Top bar with language switcher */}
        <View style={styles.topBar}>
          <View style={styles.langSwitch}>
            {languages.map((lang) => {
              const isActive = lang.code === currentLanguage;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langBtn, isActive && styles.langBtnActive]}
                  onPress={() => setLanguage(lang.code)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.langText, isActive && styles.langTextActive]}>
                    {lang.nativeLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.settingsIconBtn}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
          >
            <Text style={styles.settingsIconText}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Hero branded shell */}
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{t('home.eyebrow')}</Text>
          <Text style={styles.brand}>{t('common.appTitle')}</Text>
          <Text style={styles.title}>
            {t('home.title')}{' '}
            <Text style={styles.titleAccent}>{t('home.titleHighlight')}</Text>
          </Text>
          <Text style={styles.subtitle}>{t('home.subtitle')}</Text>

          <View style={styles.badge}>
            <View style={[styles.dot, !isGuest && { backgroundColor: '#10b981' }]} />
            <Text style={styles.badgeText}>
              {!isGuest && user
                ? `${user.email?.split('@')[0] || 'Parent'} · Account Active`
                : `Public Beta · ${guestRemainingQuota} Free Chats`}
            </Text>
          </View>
        </View>

        {/* Navigation Quick Links */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('Chat')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>💬 {t('chat.title')}</Text>
          </TouchableOpacity>

          <View style={styles.btnRow}>
            {isGuest ? (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => navigation.navigate('Auth')}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryBtnText}>🔐 {t('auth.signInTab')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => signOut()}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryBtnText}>🚪 Sign Out</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('ParentZone')}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryBtnText}>👨‍👩‍👦 {t('parent.title')}</Text>
            </TouchableOpacity>
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
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  langSwitch: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.line,
    padding: 3,
    gap: 3,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
  },
  langBtnActive: {
    backgroundColor: theme.colors.cyan,
  },
  langText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  langTextActive: {
    color: '#00121d',
  },
  settingsIconBtn: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIconText: {
    fontSize: 16,
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingVertical: 20,
  },
  eyebrow: {
    color: theme.colors.cyanSoft,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
    textAlign: 'center',
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
    lineHeight: 34,
  },
  titleAccent: {
    color: theme.colors.cyan,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
    maxWidth: 320,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
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
  badgeText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  actionsContainer: {
    marginTop: 'auto',
    gap: 12,
    paddingTop: 32,
  },
  primaryBtn: {
    backgroundColor: theme.colors.cyan,
    borderRadius: theme.radius.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    shadowColor: theme.colors.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#00121d',
    fontSize: 15,
    fontWeight: '800',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryBtnText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
