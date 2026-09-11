import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useLanguage } from '../i18n/useLanguage';
import { useAuthStore } from '../stores/authStore';
import { isGoogleAuthAvailable, promptGoogleSignIn } from '../lib/googleAuth';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;

export function AuthScreen({ navigation, route }: Props) {
  const { t } = useLanguage();
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    continueAsGuest,
    refreshChildren,
    hasCompletedPersonalisation,
    isLoading,
    error,
    clearError,
  } = useAuthStore();

  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [household, setHousehold] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const googleAvailable = isGoogleAuthAvailable();

  const handleTabChange = (newTab: 'login' | 'signup') => {
    setTab(newTab);
    setLocalError(null);
    setInfoMessage(null);
    clearError();
  };

  const handlePostAuthRouting = async () => {
    try {
      const children = await refreshChildren();
      const isPersonalized = hasCompletedPersonalisation();
      const initialPrompt = route.params?.initialPrompt;
      const returnTo = route.params?.returnTo;

      if (children.length === 0 || !isPersonalized) {
        navigation.replace('ParentZone', {
          tab: children.length === 0 ? 'learners' : 'personalization',
          initialPrompt,
          returnToChat: returnTo === 'Chat' || Boolean(initialPrompt),
          promptSetupRequired: true,
        });
      } else if (returnTo === 'Chat' || initialPrompt) {
        navigation.replace('Chat', { initialPrompt });
      } else {
        navigation.replace('Home');
      }
    } catch {
      navigation.replace('Home');
    }
  };

  const handleEmailAuth = async () => {
    setLocalError(null);
    setInfoMessage(null);
    clearError();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setLocalError('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }

    try {
      if (tab === 'signup') {
        const res = await signUpWithEmail(
          trimmedEmail,
          password,
          household.trim() || 'Family'
        );
        if (res.needsVerification) {
          setInfoMessage(
            `Verification link sent to ${trimmedEmail}. Please check your inbox.`
          );
        } else {
          await handlePostAuthRouting();
        }
      } else {
        await signInWithEmail(trimmedEmail, password);
        await handlePostAuthRouting();
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Authentication failed. Please try again.');
    }
  };

  const handleGoogleSignIn = async () => {
    if (!googleAvailable) {
      Alert.alert(
        'Google Sign-In Pending',
        'Google OAuth Client ID has not been configured for this build yet. Please sign in with email and password.',
        [{ text: 'OK' }]
      );
      return;
    }

    setLocalError(null);
    clearError();
    try {
      const idToken = await promptGoogleSignIn();
      await signInWithGoogle(idToken);
      await handlePostAuthRouting();
    } catch (err: any) {
      if (err?.code !== 'SIGN_IN_CANCELLED') {
        setLocalError(err?.message || 'Google sign-in was cancelled or failed.');
      }
    }
  };

  const handleGuestContinue = async () => {
    await continueAsGuest();
    navigation.replace('Home');
  };

  const displayError = localError || error;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
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

        {/* Brand Kicker Card */}
        <View style={styles.kickerCard}>
          <Text style={styles.kickerBadge}>PUBLIC BETA · COMPLIMENTARY</Text>
          <Text style={styles.kickerTitle}>Parent & Family Portal</Text>
          <Text style={styles.kickerSubtitle}>
            Save learning milestones, configure child profiles, and unlock WhatsApp homework companion.
          </Text>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'login' && styles.tabActive]}
            onPress={() => handleTabChange('login')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabText,
                tab === 'login' && styles.tabTextActive,
              ]}
            >
              {t('auth.signInTab')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'signup' && styles.tabActive]}
            onPress={() => handleTabChange('signup')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabText,
                tab === 'signup' && styles.tabTextActive,
              ]}
            >
              {t('auth.createAccountTab')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Error / Info Banners */}
        {displayError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{displayError}</Text>
          </View>
        ) : null}

        {infoMessage ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>{infoMessage}</Text>
          </View>
        ) : null}

        {/* Continue with Google */}
        <TouchableOpacity
          style={[
            styles.googleBtn,
            !googleAvailable && styles.googleBtnDisabled,
          ]}
          onPress={handleGoogleSignIn}
          activeOpacity={googleAvailable ? 0.85 : 0.6}
        >
          <Text style={styles.googleIcon}>G</Text>
          <Text style={styles.googleBtnText}>
            {t('auth.continueWithGoogle')}
          </Text>
          {!googleAvailable && (
            <Text style={styles.disabledTag}>Soon</Text>
          )}
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
            autoCorrect={false}
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
            style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
            onPress={handleEmailAuth}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#00121d" />
            ) : (
              <Text style={styles.submitBtnText}>
                {tab === 'login'
                  ? t('auth.signInButton')
                  : t('auth.signUpButton')}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Skip / Continue as Guest */}
        <TouchableOpacity
          style={styles.guestBtn}
          onPress={handleGuestContinue}
          activeOpacity={0.7}
        >
          <Text style={styles.guestBtnText}>
            Explore App as Guest (Preview Only) →
          </Text>
        </TouchableOpacity>

        <Text style={styles.noticeText}>
          Guests can browse topics and settings. Sign-in is required to chat with Appu and personalize lessons.
        </Text>
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
  kickerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    padding: 18,
    marginTop: 8,
    marginBottom: 16,
  },
  kickerBadge: {
    color: theme.colors.cyanSoft,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  kickerTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  kickerSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
    padding: 4,
    marginBottom: 16,
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
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    lineHeight: 18,
  },
  infoBox: {
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 14,
  },
  infoText: {
    color: theme.colors.cyanSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  googleBtn: {
    backgroundColor: '#ffffff',
    borderRadius: theme.radius.md,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  googleBtnDisabled: {
    opacity: 0.65,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4285f4',
  },
  googleBtnText: {
    color: '#1f1f1f',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#666666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
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
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#00121d',
    fontSize: 14,
    fontWeight: '800',
  },
  guestBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 12,
  },
  guestBtnText: {
    color: theme.colors.cyanSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  noticeText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
});
