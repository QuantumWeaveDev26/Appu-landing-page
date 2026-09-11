import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useLanguage } from '../i18n/useLanguage';

type LegalTab = 'privacy' | 'terms' | 'cancellation' | 'shipping' | 'pricing' | 'contact';

type Props = NativeStackScreenProps<RootStackParamList, 'Legal'>;

interface LegalSectionData {
  id: LegalTab;
  titleKey: string;
  badge: string;
  url: string;
  lastUpdated: string;
  paragraphs: { heading: string; body: string }[];
}

const LEGAL_DATA: Record<LegalTab, LegalSectionData> = {
  privacy: {
    id: 'privacy',
    titleKey: 'legal.privacyTitle',
    badge: 'Data Protection & Minor Privacy',
    url: 'https://appuai.online/privacy-policy.html',
    lastUpdated: 'August 25, 2026',
    paragraphs: [
      {
        heading: 'Minor Learner Privacy Commitment',
        body: 'APPU is an educational learning companion tailored for students in Classes 5 through 12. Accounts, subscriptions, and student profiles must be supervised by a parent or guardian. We never sell student data, never serve third-party behavioral advertisements, and never profile children for commercial marketing.',
      },
      {
        heading: 'Information We Collect',
        body: 'We collect parent/guardian email and securely hashed authentication credentials via Supabase. Passwords are never stored in plaintext. Optional mobile numbers are used strictly for parent WhatsApp study notes with explicit consent. Learner profiles include grade band (Class 5-12), preferred learning language (English, Kannada, Hindi), and study subject interests.',
      },
      {
        heading: 'AI Learning Interactions',
        body: 'Questions asked to APPU and educational responses generated are processed securely to provide pedagogical explanations, homework assistance, and conceptual continuity.',
      },
      {
        heading: 'Billing & Payments',
        body: 'Payment transactions are processed securely through certified gateways (Razorpay). APPU does not store credit card numbers, CVVs, or bank credentials on native devices or servers.',
      },
      {
        heading: 'Your Data Rights & Deletion',
        body: 'Parents have full rights to review, export, update, or permanently delete their child’s profile, personalization settings, and chat history by contacting support@appuai.online or directly through Parent Zone.',
      },
    ],
  },
  terms: {
    id: 'terms',
    titleKey: 'legal.termsTitle',
    badge: 'Platform Terms & Guidelines',
    url: 'https://appuai.online/terms-and-conditions.html',
    lastUpdated: 'August 25, 2026',
    paragraphs: [
      {
        heading: 'Educational Purpose',
        body: 'APPU is an AI-powered tutor designed to support curriculum learning, foster curiosity, and assist with conceptual understanding. It complements school education and parent guidance.',
      },
      {
        heading: 'Parental Responsibility & Supervision',
        body: 'An adult parent or legal guardian must register and administer the account. Parents are responsible for reviewing their child’s learning activity and managing active subscriptions.',
      },
      {
        heading: 'Acceptable Use Policy',
        body: 'Users agree to engage respectfully with the AI tutor. Harassment, attempts to bypass safety filters, prompt injection, reverse engineering, and illegal activities are strictly prohibited.',
      },
      {
        heading: 'Service Availability',
        body: 'We continuously improve and maintain our AI models and infrastructure. Temporary downtime for scheduled maintenance or upgrades may occur.',
      },
    ],
  },
  cancellation: {
    id: 'cancellation',
    titleKey: 'legal.cancellationTitle',
    badge: 'Subscription & Refunds',
    url: 'https://appuai.online/cancellation-refund-policy.html',
    lastUpdated: 'August 25, 2026',
    paragraphs: [
      {
        heading: 'Subscription Cancellation',
        body: 'Parents can cancel their active recurring subscription anytime via Parent Zone or by emailing support@appuai.online. Upon cancellation, paid benefits continue until the end of the current billing cycle.',
      },
      {
        heading: 'Refund Policy',
        body: 'Because APPU provides instant digital compute access upon subscription activation, refund requests are evaluated within 7 days of initial purchase if technical issues prevented platform use.',
      },
      {
        heading: 'Beta Period Notice',
        body: 'During public beta, learning sessions and exploration features are provided complimentary without recurring subscription charges.',
      },
    ],
  },
  shipping: {
    id: 'shipping',
    titleKey: 'legal.shippingTitle',
    badge: 'Instant Digital Delivery',
    url: 'https://appuai.online/shipping-delivery-policy.html',
    lastUpdated: 'August 25, 2026',
    paragraphs: [
      {
        heading: 'Digital Service Delivery',
        body: 'APPU is an online digital application and AI tutoring service. No physical goods or boxed software are shipped. All features, interactive missions, and voice sessions are delivered immediately upon account login.',
      },
      {
        heading: 'Access Fulfillment',
        body: 'Upon subscription or plan activation, entitlements (AI sessions, voice minutes, multiple learner slots) are credited instantaneously to your account.',
      },
    ],
  },
  pricing: {
    id: 'pricing',
    titleKey: 'legal.pricingTitle',
    badge: 'Transparent Pricing & Beta',
    url: 'https://appuai.online/pricing.html',
    lastUpdated: 'August 25, 2026',
    paragraphs: [
      {
        heading: 'Public Beta Access',
        body: 'APPU is currently in open public beta. Parents and students enjoy complimentary access to conversational AI tutoring, interactive curiosity missions, and multilingual audio sessions.',
      },
      {
        heading: 'Future Tiered Plans',
        body: 'Upcoming tiers will include Starter (free quota), Evolve (extended sessions, audio streaming), and Evolve+ (multiple children, priority voice, advanced progress analytics).',
      },
    ],
  },
  contact: {
    id: 'contact',
    titleKey: 'legal.contactTitle',
    badge: 'Customer Support & Inquiries',
    url: 'https://appuai.online/contact-us.html',
    lastUpdated: 'August 25, 2026',
    paragraphs: [
      {
        heading: 'Operating Entity',
        body: 'IGR Academy — Educational Learning Technologies\nBengaluru, Karnataka, India.',
      },
      {
        heading: 'Email Support',
        body: 'support@appuai.online\nAvailable Monday to Saturday, 9:00 AM - 6:00 PM IST.',
      },
      {
        heading: 'WhatsApp Helpline',
        body: '+91 97405 95677\nReach our learning support companion directly on WhatsApp for assistance.',
      },
    ],
  },
};

export function LegalScreen({ navigation, route }: Props) {
  const { t } = useLanguage();
  const initial = route.params?.initialTab || 'privacy';
  const [activeTab, setActiveTab] = useState<LegalTab>(initial);

  const current = LEGAL_DATA[activeTab];

  const handleOpenBrowser = (url: string) => {
    Linking.openURL(url).catch((err) =>
      console.warn('[LegalScreen] Failed to open URL:', err)
    );
  };

  const tabs: { key: LegalTab; label: string }[] = [
    { key: 'privacy', label: 'Privacy' },
    { key: 'terms', label: 'Terms' },
    { key: 'cancellation', label: 'Refunds' },
    { key: 'shipping', label: 'Delivery' },
    { key: 'pricing', label: 'Pricing' },
    { key: 'contact', label: 'Contact' },
  ];

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
        <Text style={styles.headerTitle}>{t('legal.screenTitle') || 'Legal & Policies'}</Text>
        <TouchableOpacity
          style={styles.browserHeaderBtn}
          onPress={() => handleOpenBrowser(current.url)}
          activeOpacity={0.7}
        >
          <Text style={styles.browserHeaderBtnText}>🌐 Web</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Navigation Pill Bar */}
      <View style={styles.tabBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabPill, isActive && styles.tabPillActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.75}
              >
                <Text
                  style={[styles.tabPillText, isActive && styles.tabPillTextActive]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content Scroll */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.metaCard}>
          <View style={styles.badgeRow}>
            <Text style={styles.badgeText}>🛡️ {current.badge}</Text>
            <Text style={styles.dateText}>{current.lastUpdated}</Text>
          </View>
          <Text style={styles.sectionTitle}>
            {activeTab === 'privacy' && 'Privacy Policy'}
            {activeTab === 'terms' && 'Terms & Conditions'}
            {activeTab === 'cancellation' && 'Cancellation & Refunds'}
            {activeTab === 'shipping' && 'Shipping & Digital Delivery'}
            {activeTab === 'pricing' && 'Pricing Policy'}
            {activeTab === 'contact' && 'Contact Us'}
          </Text>
          <Text style={styles.subtext}>Official policy published by IGR Academy.</Text>
        </View>

        {current.paragraphs.map((p, idx) => (
          <View key={idx} style={styles.paragraphCard}>
            <Text style={styles.paragraphHeading}>{p.heading}</Text>
            <Text style={styles.paragraphBody}>{p.body}</Text>
          </View>
        ))}

        {/* Action Button: Open Official Web Page */}
        <TouchableOpacity
          style={styles.webBtn}
          onPress={() => handleOpenBrowser(current.url)}
          activeOpacity={0.8}
        >
          <Text style={styles.webBtnText}>Open Official Page in Browser ↗</Text>
        </TouchableOpacity>
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
  browserHeaderBtn: {
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
  },
  browserHeaderBtnText: {
    color: theme.colors.cyan,
    fontSize: 12,
    fontWeight: '700',
  },
  tabBarContainer: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tabPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabPillActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.15)',
    borderColor: theme.colors.cyan,
  },
  tabPillText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  tabPillTextActive: {
    color: theme.colors.cyan,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  metaCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeText: {
    color: theme.colors.cyan,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateText: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtext: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  paragraphCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 10,
  },
  paragraphHeading: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  paragraphBody: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  webBtn: {
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    borderWidth: 1,
    borderColor: theme.colors.cyan,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  webBtnText: {
    color: theme.colors.cyan,
    fontSize: 14,
    fontWeight: '700',
  },
});
