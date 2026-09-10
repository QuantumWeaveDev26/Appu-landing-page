import React, { useState } from 'react';
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
import { AvatarStage } from '../components/AvatarStage';
import { MissionCard } from '../components/MissionCard';
import { ExplorePromptsModal } from '../components/ExplorePromptsModal';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { t, currentLanguage, setLanguage, languages } = useLanguage();
  const { user, isGuest, guestRemainingQuota, signOut } = useAuthStore();
  const [exploreModalVisible, setExploreModalVisible] = useState(false);

  const handleSelectPrompt = (prompt: string) => {
    setExploreModalVisible(false);
    navigation.navigate('Chat', { initialPrompt: prompt });
  };

  const handleMissionPress = (prompt: string) => {
    navigation.navigate('Chat', { initialPrompt: prompt });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar with language switcher & settings */}
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
                  <Text
                    style={[
                      styles.langText,
                      isActive && styles.langTextActive,
                    ]}
                  >
                    {lang.nativeLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.topRightActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('Settings')}
              activeOpacity={0.7}
            >
              <Text style={styles.iconBtnText}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero title & subtitle */}
        <View style={styles.heroSection}>
          <Text style={styles.eyebrow}>{t('home.eyebrow')}</Text>
          <Text style={styles.title}>
            {t('home.title')}{' '}
            <Text style={styles.titleAccent}>{t('home.titleHighlight')}</Text>
          </Text>
          <Text style={styles.subtitle}>{t('home.subtitle')}</Text>

          {/* Explore Prompts Pill Button */}
          <TouchableOpacity
            style={styles.explorePill}
            onPress={() => setExploreModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.explorePillIcon}>🧭</Text>
            <Text style={styles.explorePillText}>{t('home.explorePrompts')}</Text>
            <Text style={styles.explorePillSparkle}>✦</Text>
          </TouchableOpacity>
        </View>

        {/* Reanimated Avatar Stage */}
        <AvatarStage
          onPressAvatar={() => navigation.navigate('Chat')}
        />

        {/* Account / Quota Status Badge */}
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.statusDot,
              !isGuest && { backgroundColor: '#10b981' },
            ]}
          />
          <Text style={styles.badgeText}>
            {!isGuest && user
              ? `${user.email?.split('@')[0] || 'Parent'} · Account Active`
              : `Public Beta · ${guestRemainingQuota} Complimentary Chats`}
          </Text>
        </View>

        {/* Mission Cards Deck */}
        <View style={styles.missionSection}>
          <Text style={styles.sectionHeader}>LEARNING MISSIONS</Text>

          <MissionCard
            title={t('home.chipExplainTitle')}
            description={t('home.chipExplainDesc')}
            prompt={t('home.chipExplainPrompt')}
            icon="💡"
            accentColor="#22d3ee"
            onPress={handleMissionPress}
          />

          <MissionCard
            title={t('home.chipQuizTitle')}
            description={t('home.chipQuizDesc')}
            prompt={t('home.chipQuizPrompt')}
            icon="⚡"
            accentColor="#a855f7"
            onPress={handleMissionPress}
          />

          <MissionCard
            title={t('home.chipHomeworkTitle')}
            description={t('home.chipHomeworkDesc')}
            prompt={t('home.chipHomeworkPrompt')}
            icon="📖"
            accentColor="#10b981"
            onPress={handleMissionPress}
          />

          <MissionCard
            title={t('home.chipExamTitle')}
            description={t('home.chipExamDesc')}
            prompt={t('home.chipExamPrompt')}
            icon="🏅"
            accentColor="#f5b301"
            onPress={handleMissionPress}
          />
        </View>

        {/* Quick Nav Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.chatPrimaryBtn}
            onPress={() => navigation.navigate('Chat')}
            activeOpacity={0.82}
          >
            <Text style={styles.chatPrimaryText}>💬 {t('chat.title')}</Text>
          </TouchableOpacity>

          <View style={styles.navRow}>
            {isGuest ? (
              <TouchableOpacity
                style={styles.navSecondaryBtn}
                onPress={() => navigation.navigate('Auth')}
                activeOpacity={0.8}
              >
                <Text style={styles.navSecondaryText}>🔐 {t('auth.signInTab')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.navSecondaryBtn}
                onPress={() => signOut()}
                activeOpacity={0.8}
              >
                <Text style={styles.navSecondaryText}>🚪 Sign Out</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.navSecondaryBtn}
              onPress={() => navigation.navigate('ParentZone')}
              activeOpacity={0.8}
            >
              <Text style={styles.navSecondaryText}>👨‍👩‍👦 {t('parent.title')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Explore Prompts Modal */}
      <ExplorePromptsModal
        visible={exploreModalVisible}
        onClose={() => setExploreModalVisible(false)}
        onSelectPrompt={handleSelectPrompt}
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
    gap: 2,
  },
  langBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
  },
  langBtnActive: {
    backgroundColor: theme.colors.cyan,
  },
  langText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  langTextActive: {
    color: '#00121d',
    fontWeight: '800',
  },
  topRightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  iconBtnText: {
    fontSize: 16,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  eyebrow: {
    color: theme.colors.cyanSoft,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
    textAlign: 'center',
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 32,
  },
  titleAccent: {
    color: theme.colors.cyan,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: '90%',
  },
  explorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(8, 30, 54, 0.9)',
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  explorePillIcon: {
    fontSize: 14,
  },
  explorePillText: {
    color: theme.colors.cyanSoft,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  explorePillSparkle: {
    color: theme.colors.amber,
    fontSize: 13,
    fontWeight: '900',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 4,
    marginBottom: 16,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.cyan,
  },
  badgeText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  missionSection: {
    marginTop: 8,
    marginBottom: 18,
  },
  sectionHeader: {
    color: theme.colors.cyanSoft,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
    marginLeft: 2,
  },
  navBar: {
    gap: 10,
    marginTop: 6,
  },
  chatPrimaryBtn: {
    backgroundColor: theme.colors.cyan,
    borderRadius: theme.radius.md,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  chatPrimaryText: {
    color: '#00121d',
    fontSize: 15,
    fontWeight: '800',
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
  },
  navSecondaryBtn: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navSecondaryText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
