import React, { useState, useEffect, useCallback } from 'react';
import { getLearningProfile, setLearningConsent } from '../lib/learning';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { theme, tc } from '../theme';
import { useLanguage } from '../i18n/useLanguage';
import { useAuthStore } from '../stores/authStore';
import { config } from '../config';
import {
  ensureHousehold,
  fetchChildren,
  createChild,
  updateChild,
  fetchPersonalisation,
  savePersonalisation,
  fetchCurrentSubscription,
  fetchCurrentUsage,
  validateChildDob,
  validateChildNickname,
  normalizePhoneNumber,
  ChildProfile,
  ChildPersonalisation,
  LearningStyle,
  ResponseStyle,
  FontPreference,
  ThemePreference,
  CurrentSubscriptionResponse,
  UsageSummaryResponse,
  fetchFamilyFeedback,
  submitFamilyFeedback,
  fetchChildReportJson,
  downloadAndShareChildReport,
  FamilyFeedbackStatus,
  ChildPerformanceReport,
} from '../lib/api';
import { FeedbackDropdown } from '../components/FeedbackDropdown';
import { setCachedFeedbackUnlocked } from '../lib/feedbackGate';
import {
  WHATS_WORKING_PRESETS,
  WHATS_TO_IMPROVE_PRESETS,
} from '../lib/feedbackPresets';

type Props = NativeStackScreenProps<RootStackParamList, 'ParentZone'>;

type ParentTab = 'learners' | 'personalization' | 'subscription' | 'reports';

const GRADE_OPTIONS = [
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
];

export function ParentZoneScreen({ navigation, route }: Props) {
  const { t, currentLanguage, setLanguage } = useLanguage();
  const {
    user,
    session,
    isGuest,
    signOut,
    activeChildId,
    activeChild,
    setActiveChild,
    setActiveChildId,
    setActivePersonalisation,
  } = useAuthStore();

  const [activeTab, setActiveTab] = useState<ParentTab>(
    () => route.params?.tab || 'learners'
  );

  // Learners list state
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);

  // Child Add / Edit Modal state
  const [isChildModalVisible, setIsChildModalVisible] = useState(false);
  const [editingChild, setEditingChild] = useState<ChildProfile | null>(null);
  const [childFormName, setChildFormName] = useState('');
  const [childFormGrade, setChildFormGrade] = useState('Grade 6');
  const [childFormNickname, setChildFormNickname] = useState('');
  const [childFormDob, setChildFormDob] = useState('');
  const [savingChild, setSavingChild] = useState(false);
  const [childFormError, setChildFormError] = useState<string | null>(null);

  // Personalization state
  const [persChild, setPersChild] = useState<ChildProfile | null>(activeChild);
  const [loadingPers, setLoadingPers] = useState(false);
  const [savingPers, setSavingPers] = useState(false);
  const [persSuccess, setPersSuccess] = useState(false);

  const [persLang, setPersLang] = useState<'en' | 'kn' | 'hi'>('en');
  const [persLearningStyle, setPersLearningStyle] = useState<LearningStyle>('interactive');
  const [persResponseStyle, setPersResponseStyle] = useState<ResponseStyle>('playful');
  const [persFont, setPersFont] = useState<FontPreference>('friendly');
  const [persTheme, setPersTheme] = useState<ThemePreference>('auto');
  const [persSubjects, setPersSubjects] = useState('Science, Mathematics');
  const [persInterests, setPersInterests] = useState('Space, Robotics');
  const [persGoals, setPersGoals] = useState('Master science concepts and build creative curiosity');
  const [persNickname, setPersNickname] = useState('');
  const [persDob, setPersDob] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  // Parent consent for the learner model (quiz results, topics, preferred ways of learning).
  const [learningConsent, setLearningConsentState] = useState(true);
  useEffect(() => {
    if (!persChild?.id) return;
    // Ticked until the parent has made a choice; their saved "no" is kept.
    void getLearningProfile(persChild.id).then((p) => setLearningConsentState(!p || p.consent.granted || !p.consent.decided));
  }, [persChild?.id]);

  // Subscription & Usage state
  const [subData, setSubData] = useState<CurrentSubscriptionResponse | null>(null);
  const [usageData, setUsageData] = useState<UsageSummaryResponse | null>(null);
  const [loadingSub, setLoadingSub] = useState(false);

  // Parent Feedback & Performance Report state
  const [feedbackStatus, setFeedbackStatus] = useState<FamilyFeedbackStatus | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [isFeedbackModalVisible, setIsFeedbackModalVisible] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackWorking, setFeedbackWorking] = useState<string>('');
  const [feedbackImprove, setFeedbackImprove] = useState<string>('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Report generation state
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [loadingReportPreview, setLoadingReportPreview] = useState(false);
  const [reportData, setReportData] = useState<ChildPerformanceReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const accessToken = session?.access_token;

  // Load children on mount or session change
  const loadLearners = useCallback(async () => {
    if (!accessToken) return;
    setLoadingChildren(true);
    try {
      const list = await fetchChildren(accessToken);
      setChildren(list);

      // Keep active child resolved
      if (list.length > 0) {
        const found = list.find((c) => c.id === activeChildId) || list[0];
        if (!activeChildId || found.id !== activeChildId) {
          void setActiveChild(found);
        }
        if (!persChild || !list.some((c) => c.id === persChild.id)) {
          setPersChild(found);
        }
      } else {
        void setActiveChild(null);
        setPersChild(null);
      }
    } catch (err: any) {
      console.warn('[ParentZone] Failed to fetch children:', err);
    } finally {
      setLoadingChildren(false);
    }
  }, [accessToken, activeChildId, persChild, setActiveChild]);

  useEffect(() => {
    if (accessToken) {
      void loadLearners();
    }
  }, [accessToken, loadLearners]);

  useEffect(() => {
    if (route.params?.tab) {
      setActiveTab(route.params.tab);
    }
  }, [route.params?.tab]);

  // Load personalization when persChild changes
  useEffect(() => {
    if (!accessToken || !persChild?.id) return;
    let isMounted = true;
    setLoadingPers(true);
    setPersSuccess(false);

    // Seed from child profile
    setPersNickname(persChild.nickname || '');
    setPersDob(persChild.dob || '');

    fetchPersonalisation(accessToken, persChild.id)
      .then((p) => {
        if (!isMounted || !p) return;
        if (p.preferredLanguage === 'kn' || p.preferredLanguage === 'hi' || p.preferredLanguage === 'en') {
          setPersLang(p.preferredLanguage);
        }
        if (p.learningStyle) setPersLearningStyle(p.learningStyle);
        if (p.responseStyle) setPersResponseStyle(p.responseStyle);
        if (p.fontPreference) setPersFont(p.fontPreference);
        if (p.themePreference) setPersTheme(p.themePreference);
        if (Array.isArray(p.favoriteSubjects) && p.favoriteSubjects.length > 0) {
          setPersSubjects(p.favoriteSubjects.join(', '));
        }
        if (Array.isArray(p.interests) && p.interests.length > 0) {
          setPersInterests(p.interests.join(', '));
        }
        if (Array.isArray(p.goals) && p.goals.length > 0) {
          setPersGoals(p.goals.join(', '));
        }
        if (p.parentPhone) setParentPhone(p.parentPhone);
        if (typeof p.whatsappConsent === 'boolean') setWhatsappConsent(p.whatsappConsent);
        if (p.nickname) setPersNickname(p.nickname);
        if (p.dob) setPersDob(p.dob);
      })
      .catch((err) => {
        console.warn('[ParentZone] Failed to fetch personalization:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingPers(false);
      });

    return () => {
      isMounted = false;
    };
  }, [accessToken, persChild]);

  // Load subscription and usage data
  const loadSubscriptionAndUsage = useCallback(async () => {
    if (!accessToken) return;
    setLoadingSub(true);
    try {
      const [sub, usage] = await Promise.all([
        fetchCurrentSubscription(accessToken),
        fetchCurrentUsage(accessToken),
      ]);
      setSubData(sub);
      setUsageData(usage);
    } catch (err) {
      console.warn('[ParentZone] Failed to load subscription/usage:', err);
    } finally {
      setLoadingSub(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (activeTab === 'subscription' && accessToken) {
      void loadSubscriptionAndUsage();
    }
  }, [activeTab, accessToken, loadSubscriptionAndUsage]);

  // Load feedback status
  const loadFeedback = useCallback(async () => {
    if (!accessToken) return;
    setLoadingFeedback(true);
    try {
      const status = await fetchFamilyFeedback(accessToken);
      setFeedbackStatus(status);
      if (status.feedback?.rating) {
        setFeedbackRating(status.feedback.rating);
      }
      if (status.feedback?.whatsWorking) {
        setFeedbackWorking(status.feedback.whatsWorking);
      }
      if (status.feedback?.whatsToImprove) {
        setFeedbackImprove(status.feedback.whatsToImprove);
      }
    } catch (err) {
      console.warn('[ParentZone] Failed to load feedback status:', err);
    } finally {
      setLoadingFeedback(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (activeTab === 'reports' && accessToken) {
      void loadFeedback();
    }
  }, [activeTab, accessToken, loadFeedback]);

  // Submit Feedback Handler
  const handleSubmitFeedback = async () => {
    if (!accessToken) return;
    const workingTrimmed = feedbackWorking.trim();
    const improveTrimmed = feedbackImprove.trim();

    if (!workingTrimmed || !improveTrimmed) {
      Alert.alert(
        t('parent.feedbackRequiredAlert'),
        t('parent.bothFeedbackFieldsRequired')
      );
      return;
    }

    setSubmittingFeedback(true);
    try {
      const result = await submitFamilyFeedback(accessToken, {
        rating: feedbackRating,
        whatsWorking: workingTrimmed,
        whatsToImprove: improveTrimmed,
      });
      setFeedbackStatus({
        submitted: true,
        reportsUnlocked: true,
        feedback: result.feedback,
      });
      await setCachedFeedbackUnlocked(user?.id);
      setIsFeedbackModalVisible(false);
      Alert.alert(
        t('parent.feedbackModalTitle'),
        t('parent.reportsUnlockedBadge') + '! You can now download and view child performance reports.'
      );
    } catch (err: any) {
      Alert.alert(
        'Submission Failed',
        err.message || 'Could not submit feedback. Please try again.'
      );
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Download & Share PDF Handler
  const handleDownloadPdf = async (child: ChildProfile) => {
    if (!accessToken) return;
    setDownloadingPdf(true);
    try {
      await downloadAndShareChildReport(accessToken, child.id, child.preferredName);
    } catch (err: any) {
      if (err.details?.reason === 'feedback_required' || err.message?.includes('feedback_required') || err.message?.includes('403')) {
        setIsFeedbackModalVisible(true);
      } else {
        Alert.alert('Download Error', err.message || 'Unable to generate report PDF.');
      }
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Toggle On-Screen Preview Handler
  const handleTogglePreview = async (child: ChildProfile) => {
    if (reportData) {
      setReportData(null);
      return;
    }
    if (!accessToken) return;
    setLoadingReportPreview(true);
    setReportError(null);
    try {
      const data = await fetchChildReportJson(accessToken, child.id);
      setReportData(data);
    } catch (err: any) {
      if (err.details?.reason === 'feedback_required' || err.message?.includes('feedback_required') || err.message?.includes('403')) {
        setIsFeedbackModalVisible(true);
      } else {
        setReportError(err.message || 'Could not load report preview.');
      }
    } finally {
      setLoadingReportPreview(false);
    }
  };

  // Handle open Add child modal (Single learner per account rule)
  const openAddChildModal = () => {
    if (children.length >= 1) {
      Alert.alert(
        'Learner Limit Reached',
        'Each account is dedicated to 1 learner profile. You can edit your existing learner profile or update their personalization preferences.',
        [{ text: 'OK' }]
      );
      return;
    }
    setEditingChild(null);
    setChildFormName('');
    setChildFormGrade('Grade 6');
    setChildFormNickname('');
    setChildFormDob('');
    setChildFormError(null);
    setIsChildModalVisible(true);
  };

  // Handle open Edit child modal
  const openEditChildModal = (child: ChildProfile) => {
    setEditingChild(child);
    setChildFormName(child.preferredName);
    setChildFormGrade(child.gradeBand || 'Grade 6');
    setChildFormNickname(child.nickname || '');
    setChildFormDob(child.dob || '');
    setChildFormError(null);
    setIsChildModalVisible(true);
  };

  // Handle save Child Profile
  const handleSaveChildProfile = async () => {
    if (!accessToken) return;
    const preferredName = childFormName.trim();
    const gradeBand = childFormGrade.trim();
    const nickname = childFormNickname.trim() || undefined;
    const dob = childFormDob.trim() || undefined;

    if (!preferredName || !gradeBand) {
      setChildFormError(t('parent.errors.nameRequired'));
      return;
    }

    const nickCheck = validateChildNickname(nickname);
    if (!nickCheck.valid) {
      setChildFormError(
        nickCheck.errorKey === 'nicknameTooLongAlert'
          ? t('parent.errors.nicknameTooLong')
          : t('parent.errors.nicknameInvalid')
      );
      return;
    }

    const dobCheck = validateChildDob(dob);
    if (!dobCheck.valid) {
      setChildFormError(t('parent.errors.dobInvalid'));
      return;
    }

    setSavingChild(true);
    setChildFormError(null);

    try {
      if (editingChild) {
        const updated = await updateChild(accessToken, editingChild.id, {
          preferredName,
          gradeBand,
          nickname,
          dob,
        });
        setChildren([updated]);
        void setActiveChild(updated);
        setPersChild(updated);
      } else {
        // Ensure household exists before child creation
        await ensureHousehold(accessToken).catch((e) => {
          console.warn('[ParentZone] ensureHousehold pre-create warning:', e);
        });

        const created = await createChild(accessToken, {
          preferredName,
          gradeBand,
          nickname,
          dob,
        });
        setChildren([created]);
        void setActiveChild(created);
        setPersChild(created);
        setActiveTab('personalization');
      }
      setIsChildModalVisible(false);
    } catch (err: any) {
      setChildFormError(err.message || t('parent.errors.saveFailed'));
    } finally {
      setSavingChild(false);
    }
  };

  // Handle save Personalization
  const handleSavePersonalisation = async () => {
    if (!accessToken || !persChild) return;

    // Validate nickname and DOB if provided
    const nickCheck = validateChildNickname(persNickname);
    if (!nickCheck.valid) {
      Alert.alert(
        'Validation Error',
        nickCheck.errorKey === 'nicknameTooLongAlert'
          ? t('parent.errors.nicknameTooLong')
          : t('parent.errors.nicknameInvalid')
      );
      return;
    }

    const dobCheck = validateChildDob(persDob);
    if (!dobCheck.valid) {
      Alert.alert('Validation Error', t('parent.errors.dobInvalid'));
      return;
    }

    // Validate phone & whatsapp consent
    let validatedPhone: string | null = null;
    if (parentPhone.trim()) {
      const normalized = normalizePhoneNumber(parentPhone);
      if (normalized === false) {
        Alert.alert('Validation Error', t('parent.errors.phoneInvalid'));
        return;
      }
      validatedPhone = normalized;
    } else if (whatsappConsent) {
      Alert.alert('Validation Error', t('parent.errors.phoneRequired'));
      return;
    }

    const parseList = (val: string) =>
      val
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length <= 60);

    setSavingPers(true);
    setPersSuccess(false);

    try {
      const payload = {
        preferredLanguage: persLang,
        learningStyle: persLearningStyle,
        responseStyle: persResponseStyle,
        fontPreference: persFont,
        themePreference: persTheme,
        favoriteSubjects: parseList(persSubjects),
        interests: parseList(persInterests),
        goals: parseList(persGoals),
        parentPhone: validatedPhone,
        whatsappConsent,
        nickname: persNickname.trim() || null,
        dob: persDob.trim() || null,
      };

      const updated = await savePersonalisation(accessToken, persChild.id, payload);
      await setLearningConsent(persChild.id, learningConsent);
      void setActivePersonalisation(updated);

      // Update child profile locally
      if (persChild) {
        const updatedChild: ChildProfile = {
          ...persChild,
          nickname: payload.nickname,
          dob: payload.dob,
        };
        setChildren((prev) =>
          prev.map((c) => (c.id === updatedChild.id ? updatedChild : c))
        );
        if (activeChildId === updatedChild.id) {
          void setActiveChild(updatedChild);
        }
        setPersChild(updatedChild);
      }

      setPersSuccess(true);

      if (route.params?.returnToChat || route.params?.initialPrompt) {
        Alert.alert(
          'Personalization Complete! 🎉',
          `Appu is now personalized for ${persChild?.preferredName || 'your learner'}. Ready to start learning?`,
          [
            {
              text: 'Start Chatting',
              onPress: () => {
                navigation.navigate('Chat', {
                  initialPrompt: route.params?.initialPrompt,
                });
              },
            },
          ]
        );
      }
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || t('parent.errors.saveFailed'));
    } finally {
      setSavingPers(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(t('parent.signOut'), 'Are you sure you want to sign out?', [
      { text: t('parent.cancel'), style: 'cancel' },
      {
        text: t('parent.signOut'),
        style: 'destructive',
        onPress: async () => {
          await signOut();
          navigation.navigate('Home');
        },
      },
    ]);
  };

  // ==========================================
  // 1. GUEST / UNAUTHENTICATED STATE
  // ==========================================
  if (!accessToken) {
    return (
      <SafeAreaView style={styles.safeArea}>
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

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.guestHeroCard}>
            <View style={styles.guestIconBadge}>
              <Text style={styles.guestIconText}>👨‍👩‍👧</Text>
            </View>
            <Text style={styles.guestHeroTitle}>{t('parent.title')}</Text>
            <Text style={styles.guestHeroLead}>{t('parent.signInPrompt')}</Text>

            <View style={styles.guestFeatureList}>
              <View style={styles.guestFeatureRow}>
                <Text style={styles.guestFeatureBullet}>✦</Text>
                <Text style={styles.guestFeatureText}>
                  Multi-learner profiles with individual grades & preferences
                </Text>
              </View>
              <View style={styles.guestFeatureRow}>
                <Text style={styles.guestFeatureBullet}>✦</Text>
                <Text style={styles.guestFeatureText}>
                  Personalized AI response style, font, and learning DNA
                </Text>
              </View>
              <View style={styles.guestFeatureRow}>
                <Text style={styles.guestFeatureBullet}>✦</Text>
                <Text style={styles.guestFeatureText}>
                  Authoritative AI session quotas and progress metrics
                </Text>
              </View>
              <View style={styles.guestFeatureRow}>
                <Text style={styles.guestFeatureBullet}>✦</Text>
                <Text style={styles.guestFeatureText}>
                  WhatsApp study digests and milestones for parents
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={() => navigation.navigate('Auth')}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryActionBtnText}>
                {t('parent.signInButton')} →
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ==========================================
  // 2. AUTHENTICATED STATE
  // ==========================================
  const parentEmail = user?.email || 'Parent Account';
  const householdName =
    user?.user_metadata?.household_name ||
    user?.user_metadata?.full_name ||
    'Family Household';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backBtnText}>‹ {t('common.back')}</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('parent.title')}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {householdName}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.signOutHeaderBtn}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Text style={styles.signOutHeaderText}>{t('parent.signOut')}</Text>
        </TouchableOpacity>
      </View>

      {/* Required Setup Notice if redirected from Chat */}
      {route.params?.promptSetupRequired && (
        <View style={styles.requiredSetupBanner}>
          <Text style={styles.requiredSetupTitle}>
            ✨ Child Setup & Personalization Required
          </Text>
          <Text style={styles.requiredSetupText}>
            To unlock Appu's interactive chat, please add your child's profile and save their learning preferences below.
          </Text>
        </View>
      )}

      {/* Tab Selector */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'learners' && styles.tabBtnActive]}
          onPress={() => setActiveTab('learners')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'learners' && styles.tabBtnTextActive,
            ]}
          >
            🧒 {t('parent.tabs.learners')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'personalization' && styles.tabBtnActive,
          ]}
          onPress={() => setActiveTab('personalization')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'personalization' && styles.tabBtnTextActive,
            ]}
          >
            ⚙️ {t('parent.tabs.personalization')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'subscription' && styles.tabBtnActive,
          ]}
          onPress={() => setActiveTab('subscription')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'subscription' && styles.tabBtnTextActive,
            ]}
          >
            📊 {t('parent.tabs.subscription')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'reports' && styles.tabBtnActive,
          ]}
          onPress={() => setActiveTab('reports')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabBtnText,
              activeTab === 'reports' && styles.tabBtnTextActive,
            ]}
          >
            📈 {t('parent.tabs.reports')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ========================================== */}
        {/* TAB 1: LEARNERS                            */}
        {/* ========================================== */}
        {activeTab === 'learners' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.sectionTitle}>{t('parent.learnersTitle')}</Text>
                <Text style={styles.sectionSubtitle}>
                  {children.length === 0
                    ? 'Add your learner profile to begin personalized AI learning.'
                    : 'Your dedicated learner profile for Appu conversations.'}
                </Text>
              </View>
              {children.length === 0 && (
                <TouchableOpacity
                  style={styles.addLearnerBtn}
                  onPress={openAddChildModal}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addLearnerBtnText}>+ {t('parent.addNewLearner')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {loadingChildren ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator color={theme.colors.cyan} size="large" />
                <Text style={styles.loaderText}>{t('parent.loadingLearners')}</Text>
              </View>
            ) : children.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>🧒</Text>
                <Text style={styles.emptyText}>{t('parent.noLearners')}</Text>
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={openAddChildModal}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryActionBtnText}>
                    + {t('parent.addNewLearner')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              children.map((child) => {
                const isActive = child.id === activeChildId || children.length === 1;
                return (
                  <View
                    key={child.id}
                    style={[styles.childCard, styles.childCardActive]}
                  >
                    <View style={styles.childCardHeader}>
                      <View style={styles.childAvatarCircle}>
                        <Text style={styles.childAvatarLetter}>
                          {child.preferredName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.childMetaWrap}>
                        <View style={styles.childNameRow}>
                          <Text style={styles.childNameText}>
                            {child.preferredName}
                          </Text>
                          {child.nickname ? (
                            <Text style={styles.childNicknameBadge}>
                              "{child.nickname}"
                            </Text>
                          ) : null}
                        </View>
                        <View style={styles.childBadgesRow}>
                          <View style={styles.gradeBadge}>
                            <Text style={styles.gradeBadgeText}>
                              {child.gradeBand}
                            </Text>
                          </View>
                          {child.dob ? (
                            <Text style={styles.dobBadgeText}>🎂 {child.dob}</Text>
                          ) : null}
                          <View style={styles.activePill}>
                            <Text style={styles.activePillText}>
                              🟢 {t('parent.activeLearner')}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={styles.childCardActions}>
                      <TouchableOpacity
                        style={styles.childEditBtn}
                        onPress={() => openEditChildModal(child)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.childEditBtnText}>✏️ Edit Profile</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.childPersBtn}
                        onPress={() => {
                          setPersChild(child);
                          setActiveTab('personalization');
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.childPersBtnText}>
                          ⚙️ {t('parent.editPersonalization')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ========================================== */}
        {/* TAB 2: PERSONALIZATION                     */}
        {/* ========================================== */}
        {activeTab === 'personalization' && (
          <View>
            {children.length > 1 && (
              <View style={styles.childSwitchStrip}>
                <Text style={styles.childSwitchLabel}>Learner:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {children.map((c) => {
                    const isSelected = c.id === persChild?.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.childSwitchChip,
                          isSelected && styles.childSwitchChipSelected,
                        ]}
                        onPress={() => setPersChild(c)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.childSwitchChipText,
                            isSelected && styles.childSwitchChipTextSelected,
                          ]}
                        >
                          {c.nickname || c.preferredName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {!persChild ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>{t('parent.selectChildPrompt')}</Text>
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={() => setActiveTab('learners')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryActionBtnText}>
                    Go to {t('parent.tabs.learners')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : loadingPers ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator color={theme.colors.cyan} size="large" />
                <Text style={styles.loaderText}>Loading preferences...</Text>
              </View>
            ) : (
              <View style={styles.formCard}>
                <Text style={styles.formCardTitle}>
                  {t('parent.personalizationTitle')} {persChild.nickname || persChild.preferredName}
                </Text>

                {/* Nickname & DOB for active child */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>{t('parent.nickname')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={persNickname}
                    onChangeText={setPersNickname}
                    placeholder={t('parent.nicknamePlaceholder')}
                    placeholderTextColor={tc('#64748b', 't')}
                    maxLength={50}
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>{t('parent.dob')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={persDob}
                    onChangeText={setPersDob}
                    placeholder={t('parent.dobPlaceholder')}
                    placeholderTextColor={tc('#64748b', 't')}
                    maxLength={10}
                    autoCapitalize="none"
                  />
                </View>

                {/* Primary Language */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>{t('parent.primaryLanguage')}</Text>
                  <View style={styles.optionsRow}>
                    {(['en', 'kn', 'hi'] as const).map((lang) => (
                      <TouchableOpacity
                        key={lang}
                        style={[
                          styles.optionPill,
                          persLang === lang && styles.optionPillSelected,
                        ]}
                        onPress={() => setPersLang(lang)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.optionPillText,
                            persLang === lang && styles.optionPillTextSelected,
                          ]}
                        >
                          {lang === 'en'
                            ? 'English'
                            : lang === 'kn'
                            ? 'ಕನ್ನಡ'
                            : 'हिंदी'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Learning Style */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>{t('parent.learningStyle')}</Text>
                  <View style={styles.optionStack}>
                    {[
                      { key: 'interactive', label: t('parent.styleInteractive') },
                      { key: 'visual', label: t('parent.styleVisual') },
                      { key: 'auditory', label: t('parent.styleAuditory') },
                      { key: 'reading_writing', label: t('parent.styleReading') },
                      { key: 'kinesthetic', label: t('parent.styleKinesthetic') },
                    ].map((item) => {
                      const isSelected = persLearningStyle === item.key;
                      return (
                        <TouchableOpacity
                          key={item.key}
                          style={[
                            styles.optionCard,
                            isSelected && styles.optionCardSelected,
                          ]}
                          onPress={() => setPersLearningStyle(item.key as LearningStyle)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.optionCardText,
                              isSelected && styles.optionCardTextSelected,
                            ]}
                          >
                            {isSelected ? '◉ ' : '○ '}
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Response Style */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>{t('parent.responseStyle')}</Text>
                  <View style={styles.optionsRow}>
                    {[
                      { key: 'playful', label: t('parent.responsePlayful') },
                      { key: 'balanced', label: t('parent.responseBalanced') },
                      { key: 'focused', label: t('parent.responseFocused') },
                    ].map((item) => {
                      const isSelected = persResponseStyle === item.key;
                      return (
                        <TouchableOpacity
                          key={item.key}
                          style={[
                            styles.optionPill,
                            isSelected && styles.optionPillSelected,
                          ]}
                          onPress={() => setPersResponseStyle(item.key as ResponseStyle)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.optionPillText,
                              isSelected && styles.optionPillTextSelected,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Font Preference */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>{t('parent.fontPreference')}</Text>
                  <View style={styles.optionsRow}>
                    {[
                      { key: 'friendly', label: t('parent.fontFriendly') },
                      { key: 'rounded', label: t('parent.fontRounded') },
                      { key: 'clean', label: t('parent.fontClean') },
                    ].map((item) => {
                      const isSelected = persFont === item.key;
                      return (
                        <TouchableOpacity
                          key={item.key}
                          style={[
                            styles.optionPill,
                            isSelected && styles.optionPillSelected,
                          ]}
                          onPress={() => setPersFont(item.key as FontPreference)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.optionPillText,
                              isSelected && styles.optionPillTextSelected,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Theme Preference */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>{t('parent.themePreference')}</Text>
                  <View style={styles.optionsRow}>
                    {[
                      { key: 'auto', label: t('parent.themeAuto') },
                      { key: 'bright', label: t('parent.themeBright') },
                      { key: 'calm', label: t('parent.themeCalm') },
                    ].map((item) => {
                      const isSelected = persTheme === item.key;
                      return (
                        <TouchableOpacity
                          key={item.key}
                          style={[
                            styles.optionPill,
                            isSelected && styles.optionPillSelected,
                          ]}
                          onPress={() => setPersTheme(item.key as ThemePreference)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.optionPillText,
                              isSelected && styles.optionPillTextSelected,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Favorite Subjects */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>{t('parent.favoriteSubjects')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={persSubjects}
                    onChangeText={setPersSubjects}
                    placeholder={t('parent.favoriteSubjectsPlaceholder')}
                    placeholderTextColor={tc('#64748b', 't')}
                  />
                </View>

                {/* Interests & Hobbies */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>{t('parent.interests')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={persInterests}
                    onChangeText={setPersInterests}
                    placeholder={t('parent.interestsPlaceholder')}
                    placeholderTextColor={tc('#64748b', 't')}
                  />
                </View>

                {/* Goals */}
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>{t('parent.goals')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={persGoals}
                    onChangeText={setPersGoals}
                    placeholder={t('parent.goalsPlaceholder')}
                    placeholderTextColor={tc('#64748b', 't')}
                  />
                </View>

                {/* Parent WhatsApp Section */}
                <View style={styles.whatsappCard}>
                  <View style={styles.whatsappHeaderRow}>
                    <Text style={styles.whatsappTitle}>
                      📱 {t('parent.whatsappTitle')}
                    </Text>
                    <View style={styles.whatsappRecommendedBadge}>
                      <Text style={styles.whatsappRecommendedBadgeText}>
                        {t('parent.whatsappRecommendedBadge')}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.whatsappRationale}>
                    {t('parent.whatsappRationale')}
                  </Text>

                  <Text style={[styles.fieldLabel, { marginTop: 12, marginBottom: 4 }]}>
                    {t('parent.parentPhone')}
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={parentPhone}
                    onChangeText={setParentPhone}
                    placeholder={t('parent.parentPhonePlaceholder')}
                    placeholderTextColor={tc('#64748b', 't')}
                    keyboardType="phone-pad"
                  />

                  <View style={styles.switchRow}>
                    <Switch
                      value={whatsappConsent}
                      onValueChange={setWhatsappConsent}
                      thumbColor={whatsappConsent ? theme.colors.cyan : tc('#64748b', 'b')}
                      trackColor={{ false: tc('#1e293b', 'b'), true: tc('rgba(56, 189, 248, 0.4)', 'b') }}
                    />
                    <Text style={styles.switchText}>
                      {t('parent.whatsappConsent')}
                    </Text>
                  </View>

                  <View style={styles.switchRow}>
                    <Switch
                      value={learningConsent}
                      onValueChange={setLearningConsentState}
                      thumbColor={learningConsent ? theme.colors.cyan : tc('#64748b', 'b')}
                      trackColor={{ false: tc('#1e293b', 'b'), true: tc('rgba(56, 189, 248, 0.4)', 'b') }}
                      accessibilityLabel="Let Appu learn how my child learns"
                    />
                    <Text style={styles.switchText}>
                      Let Appu learn how my child learns: keep a record of their quiz answers and the topics they find easy or hard, so Appu can teach them in their own way and show me real progress. Only quiz results, topics and lesson styles are kept. Turn this off any time and everything recorded is deleted.
                    </Text>
                  </View>
                </View>

                {/* Status toast */}
                {persSuccess && (
                  <View style={styles.successToast}>
                    <Text style={styles.successToastText}>
                      ✓ {t('parent.preferencesSaved')}
                    </Text>
                  </View>
                )}

                {/* Action Buttons */}
                <TouchableOpacity
                  style={[styles.primaryActionBtn, savingPers && { opacity: 0.6 }]}
                  onPress={handleSavePersonalisation}
                  disabled={savingPers}
                  activeOpacity={0.8}
                >
                  {savingPers ? (
                    <ActivityIndicator color={tc('#0b1322', 't')} />
                  ) : (
                    <Text style={styles.primaryActionBtnText}>
                      {t('parent.savePreferences')}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryActionBtn}
                  onPress={() => navigation.navigate('Chat')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryActionBtnText}>
                    Launch Appu Chat →
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ========================================== */}
        {/* TAB 3: PLAN & USAGE                        */}
        {/* ========================================== */}
        {activeTab === 'subscription' && (
          <View>
            {loadingSub ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator color={theme.colors.cyan} size="large" />
                <Text style={styles.loaderText}>Loading plan & usage metrics...</Text>
              </View>
            ) : (
              <View>
                {/* Public Beta Banner (config.betaMode hides pricing per specification) */}
                {config.betaMode && (
                  <View style={styles.betaCard}>
                    <View style={styles.betaBadge}>
                      <Text style={styles.betaBadgeText}>PUBLIC BETA</Text>
                    </View>
                    <Text style={styles.betaTitle}>{t('parent.betaBannerTitle')}</Text>
                    <Text style={styles.betaDesc}>{t('parent.betaBannerDesc')}</Text>
                  </View>
                )}

                {/* Current Plan Overview */}
                <View style={styles.subOverviewCard}>
                  <View style={styles.subOverviewHeader}>
                    <View>
                      <Text style={styles.subKicker}>ACTIVE LEARNING PLAN</Text>
                      <Text style={styles.subPlanTitle}>
                        {subData?.subscription?.planCode === 'beta'
                          ? 'APPU Beta Access'
                          : subData?.subscription?.planCode?.toUpperCase() || 'Free Beta Plan'}
                      </Text>
                    </View>
                    <View style={styles.statusPillActive}>
                      <Text style={styles.statusPillActiveText}>
                        {subData?.subscription?.status || 'ACTIVE'}
                      </Text>
                    </View>
                  </View>

                  {/* Meter: AI Sessions */}
                  <View style={styles.metricBlock}>
                    <View style={styles.metricHeader}>
                      <Text style={styles.metricLabel}>
                        ⚡ {t('parent.aiSessions')}
                      </Text>
                      <Text style={styles.metricCounts}>
                        {usageData?.aiSessions?.used ?? 0} / {usageData?.aiSessions?.limit ?? 30}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(
                              100,
                              Math.round(
                                ((usageData?.aiSessions?.used ?? 0) /
                                  Math.max(1, usageData?.aiSessions?.limit ?? 30)) *
                                  100
                              )
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.metricFooter}>
                      <Text style={styles.metricFooterText}>
                        {usageData?.aiSessions?.remaining ?? 30} {t('parent.remaining')}
                      </Text>
                    </View>
                  </View>

                  {/* Meter: Voice Minutes */}
                  <View style={styles.metricBlock}>
                    <View style={styles.metricHeader}>
                      <Text style={styles.metricLabel}>
                        🎙️ {t('parent.voiceMinutes')}
                      </Text>
                      <Text style={styles.metricCounts}>
                        {usageData?.voiceMinutes?.used ?? 0} / {usageData?.voiceMinutes?.limit ?? 60} min
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(
                              100,
                              Math.round(
                                ((usageData?.voiceMinutes?.used ?? 0) /
                                  Math.max(1, usageData?.voiceMinutes?.limit ?? 60)) *
                                  100
                              )
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>

                {/* Account / Household Info */}
                <View style={styles.accountCard}>
                  <Text style={styles.accountCardTitle}>Parent Account</Text>
                  <View style={styles.accountRow}>
                    <Text style={styles.accountLabel}>Email</Text>
                    <Text style={styles.accountValue}>{parentEmail}</Text>
                  </View>
                  <View style={styles.accountRow}>
                    <Text style={styles.accountLabel}>Household</Text>
                    <Text style={styles.accountValue}>{householdName}</Text>
                  </View>
                  <View style={styles.accountRow}>
                    <Text style={styles.accountLabel}>Active Child</Text>
                    <Text style={styles.accountValue}>
                      {activeChild?.preferredName || 'None selected'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.signOutBtn}
                    onPress={handleSignOut}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.signOutBtnText}>{t('parent.signOut')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ========================================== */}
        {/* TAB 4: REPORTS                             */}
        {/* ========================================== */}
        {activeTab === 'reports' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.sectionTitle}>{t('parent.reportsTitle')}</Text>
                <Text style={styles.sectionSubtitle}>
                  {t('parent.reportsSubtitle')}
                </Text>
              </View>
            </View>

            {loadingFeedback ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator color={theme.colors.cyan} size="large" />
                <Text style={styles.loaderText}>{t('parent.loadingLearners')}</Text>
              </View>
            ) : (
              <View>
                {/* Gating Banner or Unlocked Badge */}
                {!feedbackStatus?.reportsUnlocked ? (
                  <View style={styles.reportLockedCard}>
                    <View style={styles.reportLockedHeader}>
                      <Text style={styles.reportLockedIcon}>🔒</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reportLockedTitle}>{t('parent.unlockReportsTitle')}</Text>
                        <Text style={styles.reportLockedDesc}>
                          {t('parent.unlockReportsDesc')}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.giveFeedbackBtn}
                      onPress={() => setIsFeedbackModalVisible(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.giveFeedbackBtnText}>⭐ {t('parent.giveFeedbackBtn')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.reportUnlockedCard}>
                    <View style={styles.reportUnlockedHeader}>
                      <Text style={styles.reportUnlockedBadge}>✓ {t('parent.reportsUnlockedBadge')}</Text>
                      <TouchableOpacity
                        onPress={() => setIsFeedbackModalVisible(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.updateFeedbackLink}>Edit Feedback</Text>
                      </TouchableOpacity>
                    </View>
                    {feedbackStatus.feedback ? (
                      <View style={styles.feedbackSummaryRow}>
                        <Text style={styles.feedbackStarsText}>
                          {'★'.repeat(feedbackStatus.feedback.rating)}{'☆'.repeat(5 - feedbackStatus.feedback.rating)}
                        </Text>
                        {feedbackStatus.feedback.whatsWorking ? (
                          <Text style={styles.feedbackQuoteText} numberOfLines={2}>
                            "{feedbackStatus.feedback.whatsWorking}"
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                )}

                {/* Learners Reports */}
                {children.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyText}>{t('parent.noLearners')}</Text>
                  </View>
                ) : (
                  children.map((child) => (
                    <View key={child.id} style={styles.childReportCard}>
                      <View style={styles.childCardHeader}>
                        <View style={styles.childAvatarCircle}>
                          <Text style={styles.childAvatarLetter}>
                            {child.preferredName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.childMetaWrap}>
                          <View style={styles.childNameRow}>
                            <Text style={styles.childNameText}>{child.preferredName}</Text>
                            {child.nickname ? (
                              <Text style={styles.childNicknameBadge}>({child.nickname})</Text>
                            ) : null}
                          </View>
                          <View style={styles.childBadgesRow}>
                            <View style={styles.gradeBadge}>
                              <Text style={styles.gradeBadgeText}>{child.gradeBand}</Text>
                            </View>
                            <Text style={styles.dobBadgeText}>Cumulative Progress</Text>
                          </View>
                        </View>
                      </View>

                      {/* Action buttons */}
                      <View style={styles.reportActionsRow}>
                        <TouchableOpacity
                          style={[
                            styles.downloadPdfBtn,
                            (!feedbackStatus?.reportsUnlocked || downloadingPdf) && styles.btnDisabled,
                          ]}
                          onPress={() => handleDownloadPdf(child)}
                          disabled={downloadingPdf}
                          activeOpacity={0.8}
                        >
                          {downloadingPdf ? (
                            <ActivityIndicator size="small" color={tc('#0b1322', 't')} />
                          ) : (
                            <Text style={styles.downloadPdfBtnText}>
                              📄 {t('parent.downloadPdfBtn')}
                            </Text>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.previewReportBtn,
                            !feedbackStatus?.reportsUnlocked && styles.btnDisabled,
                          ]}
                          onPress={() => handleTogglePreview(child)}
                          disabled={loadingReportPreview}
                          activeOpacity={0.8}
                        >
                          {loadingReportPreview ? (
                            <ActivityIndicator size="small" color={theme.colors.cyan} />
                          ) : (
                            <Text style={styles.previewReportBtnText}>
                              {reportData ? '✕ Hide Summary' : `👁️ ${t('parent.previewReportBtn')}`}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>

                      {/* Error banner if preview failed */}
                      {reportError ? (
                        <View style={styles.reportErrorBanner}>
                          <Text style={styles.reportErrorText}>{reportError}</Text>
                        </View>
                      ) : null}

                      {/* On-Screen Preview */}
                      {reportData && (
                        <View style={styles.reportPreviewContainer}>
                          {/* Score Header */}
                          <View style={styles.scoreDialHeader}>
                            <View style={styles.scoreCircle}>
                              <Text style={styles.scoreNumber}>{reportData.overallScore}</Text>
                              <Text style={styles.scoreSub}>/ 100</Text>
                            </View>
                            <View style={styles.scoreMeta}>
                              <View style={styles.statusPill}>
                                <Text style={styles.statusPillText}>{reportData.scoreLabel}</Text>
                              </View>
                              <Text style={styles.reportHeadline}>{reportData.childName} — Cumulative Progress</Text>
                            </View>
                          </View>

                          <Text style={styles.reportParagraph}>{reportData.summary}</Text>

                          {/* Engagement Tiles */}
                          <View style={styles.engagementGrid}>
                            <View style={styles.engagementTile}>
                              <Text style={styles.engagementValue}>{reportData.engagement.totalChats}</Text>
                              <Text style={styles.engagementLabel}>Total Chats</Text>
                            </View>
                            <View style={styles.engagementTile}>
                              <Text style={styles.engagementValue}>{reportData.engagement.activeDays}</Text>
                              <Text style={styles.engagementLabel}>Active Days</Text>
                            </View>
                            <View style={styles.engagementTile}>
                              <Text style={styles.engagementValue} numberOfLines={1}>{reportData.engagement.topSubject}</Text>
                              <Text style={styles.engagementLabel}>Top Subject</Text>
                            </View>
                          </View>

                          {/* Subject Mastery */}
                          {reportData.subjects?.length > 0 && (
                            <View style={styles.previewSection}>
                              <Text style={styles.previewSectionTitle}>Subject Mastery</Text>
                              {reportData.subjects.map((sb, idx) => (
                                <View key={idx} style={styles.subjectItem}>
                                  <View style={styles.subjectHeaderRow}>
                                    <Text style={styles.subjectName}>{sb.subject}</Text>
                                    <Text style={styles.subjectScore}>{sb.score}%</Text>
                                  </View>
                                  <View style={styles.progressTrack}>
                                    <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(5, sb.score))}%` }]} />
                                  </View>
                                  <Text style={styles.subjectNarrative}>{sb.note}</Text>
                                </View>
                              ))}
                            </View>
                          )}

                          {/* Strengths & Growth Areas */}
                          <View style={styles.twoColumnGrid}>
                            {reportData.strengths?.length > 0 && (
                              <View style={styles.columnBox}>
                                <Text style={styles.columnTitleGreen}>✨ Key Strengths</Text>
                                {reportData.strengths.map((st, idx) => (
                                  <Text key={idx} style={styles.bulletItem}>• {st}</Text>
                                ))}
                              </View>
                            )}
                            {reportData.improvements?.length > 0 && (
                              <View style={styles.columnBox}>
                                <Text style={styles.columnTitleAmber}>🎯 Growth Areas</Text>
                                {reportData.improvements.map((im, idx) => (
                                  <Text key={idx} style={styles.bulletItem}>• {im}</Text>
                                ))}
                              </View>
                            )}
                          </View>

                          {/* Topics Covered */}
                          {reportData.topicsCovered?.length > 0 && (
                            <View style={styles.previewSection}>
                              <Text style={styles.previewSectionTitle}>Topics Covered</Text>
                              <View style={styles.topicsCloud}>
                                {reportData.topicsCovered.map((top, idx) => (
                                  <View key={idx} style={styles.topicChip}>
                                    <Text style={styles.topicChipText}>{top}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          )}

                          {/* Recommendations */}
                          {reportData.recommendations?.length > 0 && (
                            <View style={styles.previewSection}>
                              <Text style={styles.previewSectionTitle}>Actionable Recommendations</Text>
                              {reportData.recommendations.map((rec, idx) => (
                                <View key={idx} style={styles.recItem}>
                                  <Text style={styles.bulletItem}>• {rec}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ========================================== */}
      {/* MODAL: ADD / EDIT CHILD PROFILE            */}
      {/* ========================================== */}
      <Modal
        visible={isChildModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsChildModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingChild ? t('parent.editLearner') : t('parent.addNewLearner')}
              </Text>
              <TouchableOpacity
                onPress={() => setIsChildModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {childFormError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{childFormError}</Text>
              </View>
            ) : null}

            {/* Preferred Name */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t('parent.preferredName')} *</Text>
              <TextInput
                style={styles.textInput}
                value={childFormName}
                onChangeText={setChildFormName}
                placeholder={t('parent.preferredNamePlaceholder')}
                placeholderTextColor={tc('#64748b', 't')}
                maxLength={100}
              />
            </View>

            {/* Class / Grade Band */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t('parent.gradeBand')} *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.gradeGrid}>
                  {GRADE_OPTIONS.map((grade) => {
                    const isSelected = childFormGrade === grade;
                    return (
                      <TouchableOpacity
                        key={grade}
                        style={[
                          styles.gradePill,
                          isSelected && styles.gradePillSelected,
                        ]}
                        onPress={() => setChildFormGrade(grade)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.gradePillText,
                            isSelected && styles.gradePillTextSelected,
                          ]}
                        >
                          {grade}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Nickname */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t('parent.nickname')}</Text>
              <TextInput
                style={styles.textInput}
                value={childFormNickname}
                onChangeText={setChildFormNickname}
                placeholder={t('parent.nicknamePlaceholder')}
                placeholderTextColor={tc('#64748b', 't')}
                maxLength={50}
              />
            </View>

            {/* Date of Birth (Age 3-25) */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t('parent.dob')}</Text>
              <TextInput
                style={styles.textInput}
                value={childFormDob}
                onChangeText={setChildFormDob}
                placeholder={t('parent.dobPlaceholder')}
                placeholderTextColor={tc('#64748b', 't')}
                maxLength={10}
                autoCapitalize="none"
              />
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsChildModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>{t('parent.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, savingChild && { opacity: 0.6 }]}
                onPress={handleSaveChildProfile}
                disabled={savingChild}
                activeOpacity={0.8}
              >
                {savingChild ? (
                  <ActivityIndicator color={tc('#0b1322', 't')} />
                ) : (
                  <Text style={styles.modalSubmitText}>
                    {editingChild
                      ? t('parent.updateLearner')
                      : t('parent.saveLearner')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* MODAL: PARENT FEEDBACK GATING              */}
      {/* ========================================== */}
      <Modal
        visible={isFeedbackModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFeedbackModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('parent.feedbackModalTitle')}</Text>
              <TouchableOpacity
                onPress={() => setIsFeedbackModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSubtitle}>
                {t('parent.unlockReportsDesc')}
              </Text>

              {/* Star Rating */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>{t('parent.feedbackRatingLabel')} *</Text>
                <View style={styles.starRatingRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setFeedbackRating(star)}
                      style={styles.starBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.starIcon, feedbackRating >= star && styles.starIconActive]}>
                        ★
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <Text style={styles.starRatingText}>{feedbackRating} / 5</Text>
                </View>
              </View>

              {/* What is working */}
              <FeedbackDropdown
                label={t('parent.whatsWorkingLabel')}
                placeholder={t('parent.whatsWorkingPlaceholder')}
                otherPlaceholder={t('chat.feedbackOtherWorkingPlaceholder')}
                options={WHATS_WORKING_PRESETS}
                selectedValue={feedbackWorking}
                onSelect={setFeedbackWorking}
                language={currentLanguage}
              />

              {/* What would make it even better */}
              <FeedbackDropdown
                label={t('parent.whatsToImproveLabel')}
                placeholder={t('parent.whatsToImprovePlaceholder')}
                otherPlaceholder={t('chat.feedbackOtherImprovePlaceholder')}
                options={WHATS_TO_IMPROVE_PRESETS}
                selectedValue={feedbackImprove}
                onSelect={setFeedbackImprove}
                language={currentLanguage}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setIsFeedbackModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelText}>{t('parent.cancel')}</Text>
                </TouchableOpacity>

                {(() => {
                  const isFeedbackValid =
                    feedbackRating >= 1 &&
                    feedbackRating <= 5 &&
                    feedbackWorking.trim().length > 0 &&
                    feedbackImprove.trim().length > 0;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.modalSubmitBtn,
                        (!isFeedbackValid || submittingFeedback) && { opacity: 0.5 },
                      ]}
                      onPress={handleSubmitFeedback}
                      disabled={!isFeedbackValid || submittingFeedback}
                      activeOpacity={0.8}
                    >
                      {submittingFeedback ? (
                        <ActivityIndicator color={tc('#0b1322', 't')} />
                      ) : (
                        <Text style={styles.modalSubmitText}>
                          {t('parent.submitFeedbackBtn')}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })()}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
    backgroundColor: tc('#0f1a2e', 'b'),
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backBtnText: {
    color: theme.colors.cyan,
    fontSize: 16,
    fontWeight: '700',
  },
  headerCenter: {
    alignItems: 'center',
    maxWidth: '50%',
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: tc('#64748b', 't'),
    fontSize: 11,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 48,
  },
  signOutHeaderBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: tc('rgba(239, 68, 68, 0.12)', 'b'),
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: tc('rgba(239, 68, 68, 0.3)', 'b'),
  },
  signOutHeaderText: {
    color: tc('#f87171', 't'),
    fontSize: 12,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: tc('#0f1a2e', 'b'),
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: tc('#12325a', 'b'),
    borderWidth: 1,
    borderColor: theme.colors.cyan,
  },
  tabBtnText: {
    color: tc('#64748b', 't'),
    fontSize: 12,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: theme.colors.cyan,
  },
  guestHeroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 24,
    marginTop: 24,
    borderWidth: 1,
    borderColor: theme.colors.line,
    alignItems: 'center',
  },
  guestIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tc('rgba(56, 189, 248, 0.1)', 'b'),
    borderWidth: 1,
    borderColor: tc('rgba(56, 189, 248, 0.3)', 'b'),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  guestIconText: {
    fontSize: 32,
  },
  guestHeroTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  guestHeroLead: {
    color: tc('#94a3b8', 't'),
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  guestFeatureList: {
    width: '100%',
    backgroundColor: tc('#0f1a2e', 'b'),
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  guestFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  guestFeatureBullet: {
    color: theme.colors.cyan,
    fontSize: 14,
    marginTop: 1,
  },
  guestFeatureText: {
    color: tc('#cbd5e1', 't'),
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: tc('#64748b', 't'),
    fontSize: 12,
    marginTop: 2,
  },
  addLearnerBtn: {
    backgroundColor: tc('rgba(56, 189, 248, 0.15)', 'b'),
    borderWidth: 1,
    borderColor: theme.colors.cyan,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.md,
  },
  addLearnerBtnText: {
    color: theme.colors.cyan,
    fontSize: 12,
    fontWeight: '700',
  },
  childCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  childCardActive: {
    borderColor: theme.colors.cyan,
    backgroundColor: tc('#0a1d37', 'b'),
  },
  childCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  childAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tc('#0c274c', 'b'),
    borderWidth: 1,
    borderColor: theme.colors.cyan,
    justifyContent: 'center',
    alignItems: 'center',
  },
  childAvatarLetter: {
    color: theme.colors.cyan,
    fontSize: 20,
    fontWeight: '800',
  },
  childMetaWrap: {
    flex: 1,
  },
  childNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  childNameText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  childNicknameBadge: {
    color: tc('#94a3b8', 't'),
    fontSize: 13,
    fontStyle: 'italic',
  },
  childBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  gradeBadge: {
    backgroundColor: tc('rgba(56, 189, 248, 0.12)', 'b'),
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  gradeBadgeText: {
    color: theme.colors.cyan,
    fontSize: 11,
    fontWeight: '700',
  },
  dobBadgeText: {
    color: tc('#64748b', 't'),
    fontSize: 11,
  },
  activePill: {
    backgroundColor: tc('rgba(34, 197, 94, 0.12)', 'b'),
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  activePillText: {
    color: tc('#4ade80', 't'),
    fontSize: 11,
    fontWeight: '700',
  },
  childCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: tc('rgba(255, 255, 255, 0.06)', 'b'),
  },
  childSelectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.cyan,
    borderRadius: theme.radius.sm,
  },
  childSelectBtnText: {
    color: tc('#0b1322', 't'),
    fontSize: 12,
    fontWeight: '700',
  },
  childEditBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: tc('#12325a', 'b'),
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  childEditBtnText: {
    color: tc('#94a3b8', 't'),
    fontSize: 12,
    fontWeight: '600',
  },
  childPersBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: tc('#12325a', 'b'),
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: tc('rgba(56, 189, 248, 0.3)', 'b'),
  },
  childPersBtnText: {
    color: theme.colors.cyan,
    fontSize: 12,
    fontWeight: '600',
  },
  childSwitchStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  childSwitchLabel: {
    color: tc('#64748b', 't'),
    fontSize: 12,
    fontWeight: '700',
  },
  childSwitchChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: tc('#12325a', 'b'),
    borderRadius: theme.radius.pill,
    marginRight: 6,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  childSwitchChipSelected: {
    borderColor: theme.colors.cyan,
    backgroundColor: tc('rgba(56, 189, 248, 0.15)', 'b'),
  },
  childSwitchChipText: {
    color: tc('#94a3b8', 't'),
    fontSize: 12,
    fontWeight: '600',
  },
  childSwitchChipTextSelected: {
    color: theme.colors.cyan,
    fontWeight: '800',
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 18,
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  formCardTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 16,
  },
  fieldBlock: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: tc('#94a3b8', 't'),
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: tc('#0f1a2e', 'b'),
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 14,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: tc('#0f1a2e', 'b'),
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.pill,
  },
  optionPillSelected: {
    borderColor: theme.colors.cyan,
    backgroundColor: tc('rgba(56, 189, 248, 0.12)', 'b'),
  },
  optionPillText: {
    color: tc('#94a3b8', 't'),
    fontSize: 13,
    fontWeight: '600',
  },
  optionPillTextSelected: {
    color: theme.colors.cyan,
    fontWeight: '800',
  },
  optionStack: {
    gap: 8,
  },
  optionCard: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: tc('#0f1a2e', 'b'),
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
  },
  optionCardSelected: {
    borderColor: theme.colors.cyan,
    backgroundColor: tc('rgba(56, 189, 248, 0.12)', 'b'),
  },
  optionCardText: {
    color: tc('#cbd5e1', 't'),
    fontSize: 13,
    fontWeight: '500',
  },
  optionCardTextSelected: {
    color: theme.colors.cyan,
    fontWeight: '700',
  },
  whatsappCard: {
    backgroundColor: tc('#071d34', 'b'),
    borderRadius: theme.radius.lg,
    padding: 16,
    borderWidth: 1.5,
    borderColor: tc('rgba(56, 189, 248, 0.5)', 'b'),
    marginBottom: 16,
  },
  whatsappHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  whatsappTitle: {
    color: tc('#38bdf8', 't'),
    fontSize: 15,
    fontWeight: '800',
  },
  whatsappRecommendedBadge: {
    backgroundColor: tc('rgba(56, 189, 248, 0.18)', 'b'),
    borderWidth: 1,
    borderColor: tc('rgba(56, 189, 248, 0.45)', 'b'),
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  whatsappRecommendedBadgeText: {
    color: tc('#38bdf8', 't'),
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  whatsappRationale: {
    color: tc('#94a3b8', 't'),
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  switchText: {
    color: tc('#cbd5e1', 't'),
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  successToast: {
    backgroundColor: tc('rgba(34, 197, 94, 0.15)', 'b'),
    borderWidth: 1,
    borderColor: tc('#4ade80', 'b'),
    padding: 10,
    borderRadius: theme.radius.md,
    marginBottom: 12,
    alignItems: 'center',
  },
  successToastText: {
    color: tc('#4ade80', 't'),
    fontSize: 13,
    fontWeight: '700',
  },
  primaryActionBtn: {
    backgroundColor: theme.colors.cyan,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryActionBtnText: {
    color: tc('#0b1322', 't'),
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  secondaryActionBtn: {
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: tc('#12325a', 'b'),
  },
  secondaryActionBtnText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  betaCard: {
    backgroundColor: tc('#0a223f', 'b'),
    borderRadius: theme.radius.lg,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.colors.cyan,
  },
  betaBadge: {
    backgroundColor: theme.colors.cyan,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    marginBottom: 8,
  },
  betaBadgeText: {
    color: tc('#0b1322', 't'),
    fontSize: 10,
    fontWeight: '900',
  },
  betaTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  betaDesc: {
    color: tc('#94a3b8', 't'),
    fontSize: 12,
    lineHeight: 18,
  },
  subOverviewCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 18,
    marginTop: 14,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  subOverviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  subKicker: {
    color: tc('#64748b', 't'),
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  subPlanTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  statusPillActive: {
    backgroundColor: tc('rgba(34, 197, 94, 0.15)', 'b'),
    borderWidth: 1,
    borderColor: tc('#4ade80', 'b'),
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  statusPillActiveText: {
    color: tc('#4ade80', 't'),
    fontSize: 11,
    fontWeight: '800',
  },
  metricBlock: {
    marginTop: 12,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricLabel: {
    color: tc('#cbd5e1', 't'),
    fontSize: 13,
    fontWeight: '600',
  },
  metricCounts: {
    color: theme.colors.cyan,
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    backgroundColor: tc('#0f1a2e', 'b'),
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.cyan,
    borderRadius: 4,
  },
  metricFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  metricFooterText: {
    color: tc('#64748b', 't'),
    fontSize: 11,
  },
  accountCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 18,
    marginTop: 14,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  accountCardTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: tc('rgba(255, 255, 255, 0.05)', 'b'),
  },
  accountLabel: {
    color: tc('#64748b', 't'),
    fontSize: 13,
  },
  accountValue: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  signOutBtn: {
    marginTop: 16,
    paddingVertical: 10,
    backgroundColor: tc('rgba(239, 68, 68, 0.1)', 'b'),
    borderRadius: theme.radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tc('rgba(239, 68, 68, 0.3)', 'b'),
  },
  signOutBtnText: {
    color: tc('#f87171', 't'),
    fontSize: 13,
    fontWeight: '700',
  },
  loaderWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    color: tc('#94a3b8', 't'),
    fontSize: 13,
  },
  emptyWrap: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyText: {
    color: tc('#94a3b8', 't'),
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: tc('rgba(0, 0, 0, 0.75)', 'b'),
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  modalCloseText: {
    color: tc('#94a3b8', 't'),
    fontSize: 18,
    fontWeight: '700',
    padding: 4,
  },
  errorBanner: {
    backgroundColor: tc('rgba(239, 68, 68, 0.15)', 'b'),
    borderWidth: 1,
    borderColor: tc('#ef4444', 'b'),
    padding: 10,
    borderRadius: theme.radius.md,
    marginBottom: 12,
  },
  errorBannerText: {
    color: tc('#fca5a5', 't'),
    fontSize: 12,
    fontWeight: '600',
  },
  gradeGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  gradePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: tc('#0f1a2e', 'b'),
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.sm,
  },
  gradePillSelected: {
    borderColor: theme.colors.cyan,
    backgroundColor: tc('rgba(56, 189, 248, 0.15)', 'b'),
  },
  gradePillText: {
    color: tc('#94a3b8', 't'),
    fontSize: 12,
    fontWeight: '600',
  },
  gradePillTextSelected: {
    color: theme.colors.cyan,
    fontWeight: '800',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalCancelText: {
    color: tc('#94a3b8', 't'),
    fontSize: 14,
    fontWeight: '600',
  },
  modalSubmitBtn: {
    backgroundColor: theme.colors.cyan,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    color: tc('#0b1322', 't'),
    fontSize: 14,
    fontWeight: '800',
  },
  requiredSetupBanner: {
    backgroundColor: tc('rgba(245, 158, 11, 0.12)', 'b'),
    borderWidth: 1,
    borderColor: tc('rgba(245, 158, 11, 0.35)', 'b'),
    borderRadius: theme.radius.md,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 12,
  },
  requiredSetupTitle: {
    color: tc('#fbbf24', 't'),
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  requiredSetupText: {
    color: tc('#fde68a', 't'),
    fontSize: 12,
    lineHeight: 17,
  },
  // Reports & Feedback Styles
  reportLockedCard: {
    backgroundColor: tc('#0c1a30', 'b'),
    borderWidth: 1,
    borderColor: tc('rgba(234, 179, 8, 0.3)', 'b'),
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 16,
  },
  reportLockedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  reportLockedIcon: {
    fontSize: 24,
  },
  reportLockedTitle: {
    color: tc('#facc15', 't'),
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  reportLockedDesc: {
    color: tc('#cbd5e1', 't'),
    fontSize: 12,
    lineHeight: 18,
  },
  giveFeedbackBtn: {
    backgroundColor: tc('#eab308', 'b'),
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giveFeedbackBtnText: {
    color: tc('#0b1322', 't'),
    fontSize: 13,
    fontWeight: '800',
  },
  reportUnlockedCard: {
    backgroundColor: tc('#081e2b', 'b'),
    borderWidth: 1,
    borderColor: tc('rgba(34, 197, 94, 0.3)', 'b'),
    borderRadius: theme.radius.lg,
    padding: 14,
    marginBottom: 16,
  },
  reportUnlockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportUnlockedBadge: {
    color: tc('#4ade80', 't'),
    fontSize: 13,
    fontWeight: '800',
  },
  updateFeedbackLink: {
    color: theme.colors.cyan,
    fontSize: 12,
    fontWeight: '700',
  },
  feedbackSummaryRow: {
    marginTop: 8,
    gap: 4,
  },
  feedbackStarsText: {
    color: tc('#facc15', 't'),
    fontSize: 16,
    letterSpacing: 2,
  },
  feedbackQuoteText: {
    color: tc('#94a3b8', 't'),
    fontSize: 12,
    fontStyle: 'italic',
  },
  childReportCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  reportActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  downloadPdfBtn: {
    flex: 1,
    backgroundColor: theme.colors.cyan,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadPdfBtnText: {
    color: tc('#0b1322', 't'),
    fontSize: 12,
    fontWeight: '800',
  },
  previewReportBtn: {
    flex: 1,
    backgroundColor: tc('#12325a', 'b'),
    borderWidth: 1,
    borderColor: theme.colors.line,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewReportBtnText: {
    color: theme.colors.cyan,
    fontSize: 12,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  reportErrorBanner: {
    backgroundColor: tc('rgba(239, 68, 68, 0.12)', 'b'),
    borderWidth: 1,
    borderColor: tc('rgba(239, 68, 68, 0.3)', 'b'),
    borderRadius: theme.radius.md,
    padding: 10,
    marginTop: 12,
  },
  reportErrorText: {
    color: tc('#f87171', 't'),
    fontSize: 12,
  },
  reportPreviewContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: tc('rgba(255, 255, 255, 0.08)', 'b'),
    gap: 14,
  },
  scoreDialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: tc('#071830', 'b'),
    borderWidth: 2,
    borderColor: theme.colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  scoreSub: {
    color: tc('#64748b', 't'),
    fontSize: 10,
    fontWeight: '700',
  },
  scoreMeta: {
    flex: 1,
    gap: 4,
  },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: tc('rgba(56, 189, 248, 0.15)', 'b'),
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  statusPillText: {
    color: theme.colors.cyan,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  reportHeadline: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  reportParagraph: {
    color: tc('#cbd5e1', 't'),
    fontSize: 12,
    lineHeight: 18,
  },
  engagementGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  engagementTile: {
    flex: 1,
    backgroundColor: tc('#0f1a2e', 'b'),
    borderRadius: theme.radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.line,
    alignItems: 'center',
  },
  engagementValue: {
    color: theme.colors.cyan,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  engagementLabel: {
    color: tc('#64748b', 't'),
    fontSize: 10,
    fontWeight: '600',
  },
  previewSection: {
    gap: 8,
  },
  previewSectionTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  subjectItem: {
    backgroundColor: tc('#0f1a2e', 'b'),
    padding: 10,
    borderRadius: theme.radius.md,
    gap: 6,
  },
  subjectHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectName: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  subjectScore: {
    color: theme.colors.cyan,
    fontSize: 12,
    fontWeight: '800',
  },
  subjectNarrative: {
    color: tc('#94a3b8', 't'),
    fontSize: 11,
    lineHeight: 15,
  },
  twoColumnGrid: {
    gap: 10,
  },
  columnBox: {
    backgroundColor: tc('#0f1a2e', 'b'),
    borderRadius: theme.radius.md,
    padding: 12,
    gap: 6,
  },
  columnTitleGreen: {
    color: tc('#4ade80', 't'),
    fontSize: 12,
    fontWeight: '800',
  },
  columnTitleAmber: {
    color: tc('#facc15', 't'),
    fontSize: 12,
    fontWeight: '800',
  },
  bulletItem: {
    color: tc('#cbd5e1', 't'),
    fontSize: 11,
    lineHeight: 16,
  },
  topicsCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  topicChip: {
    backgroundColor: tc('#12325a', 'b'),
    borderWidth: 1,
    borderColor: tc('rgba(56, 189, 248, 0.25)', 'b'),
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  topicChipText: {
    color: theme.colors.cyan,
    fontSize: 11,
    fontWeight: '600',
  },
  recItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: tc('#0f1a2e', 'b'),
    padding: 10,
    borderRadius: theme.radius.md,
  },
  recPriorityBadge: {
    backgroundColor: tc('rgba(56, 189, 248, 0.15)', 'b'),
    borderRadius: theme.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  recPriorityText: {
    color: theme.colors.cyan,
    fontSize: 9,
    fontWeight: '800',
  },
  recArea: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  recSuggestion: {
    color: tc('#94a3b8', 't'),
    fontSize: 11,
    lineHeight: 15,
  },
  modalSubtitle: {
    color: tc('#94a3b8', 't'),
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  starRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  starBtn: {
    padding: 4,
  },
  starIcon: {
    fontSize: 28,
    color: tc('#334155', 't'),
  },
  starIconActive: {
    color: tc('#facc15', 't'),
  },
  starRatingText: {
    color: tc('#facc15', 't'),
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
});
