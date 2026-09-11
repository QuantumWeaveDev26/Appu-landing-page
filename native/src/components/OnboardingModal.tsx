import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { theme } from '../theme';
import { useLanguage } from '../i18n/useLanguage';
import { useSettingsStore } from '../stores/settingsStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface Slide {
  emoji: string;
  badge: string;
  title: string;
  description: string;
  highlights: string[];
}

const SLIDES: Slide[] = [
  {
    emoji: '🐘',
    badge: 'Meet Your AI Companion',
    title: 'Welcome to APPU!',
    description:
      'APPU is a friendly, intelligent AI tutor designed especially for students in Classes 5 to 12. Learn concepts step-by-step with patient, encouraging explanations.',
    highlights: [
      '✨ Speaks in English, ಕನ್ನಡ, and हिन्दी',
      '🎯 Tailored to your school syllabus and pace',
      '🌟 100% ad-free and child-safe environment',
    ],
  },
  {
    emoji: '🎙️',
    badge: 'Conversational Voice',
    title: 'Talk Naturally, Learn Faster',
    description:
      'Have real voice conversations with Appu just like with a personal mentor. Ask questions out loud, listen to warm audio answers, and practice anytime.',
    highlights: [
      '🗣️ Hands-free auto-listen voice sessions',
      '⚡ Slower/faster voice speed adjustments',
      '💡 Explore curiosity prompts on science, math & stories',
    ],
  },
  {
    emoji: '👨‍👩‍👧',
    badge: 'Parent-Supervised',
    title: 'Parent Zone & Study Reminders',
    description:
      'Parents stay in control with dedicated profiles, learning style preferences, WhatsApp study note updates, and 1-tap Google Calendar study reminders.',
    highlights: [
      '📊 Track learning sessions and meters',
      '📅 Schedule study sessions with Google Calendar',
      '📲 Optional WhatsApp study notes for parents',
    ],
  },
];

export function OnboardingModal({ visible, onClose }: Props) {
  const { t } = useLanguage();
  const { setOnboardingCompleted } = useSettingsStore();
  const [currentStep, setCurrentStep] = useState(0);

  const slide = SLIDES[currentStep];
  const isLast = currentStep === SLIDES.length - 1;

  const handleNext = async () => {
    if (isLast) {
      await setOnboardingCompleted(true);
      setCurrentStep(0);
      onClose();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleSkip = async () => {
    await setOnboardingCompleted(true);
    setCurrentStep(0);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Top Bar: Skip button */}
          <View style={styles.topBar}>
            <View style={styles.badgeWrap}>
              <Text style={styles.badgeText}>{slide.badge}</Text>
            </View>
            <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>

          {/* Hero Graphic / Emoji */}
          <View style={styles.heroWrap}>
            <View style={styles.glowRing}>
              <Text style={styles.heroEmoji}>{slide.emoji}</Text>
            </View>
          </View>

          {/* Slide Title & Description */}
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.desc}>{slide.description}</Text>

          {/* Highlights */}
          <View style={styles.highlightsContainer}>
            {slide.highlights.map((h, i) => (
              <View key={i} style={styles.highlightRow}>
                <Text style={styles.highlightText}>{h}</Text>
              </View>
            ))}
          </View>

          {/* Step Indicator Dots */}
          <View style={styles.dotsRow}>
            {SLIDES.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  idx === currentStep && styles.dotActive,
                ]}
              />
            ))}
          </View>

          {/* Bottom Action Controls */}
          <View style={styles.bottomBar}>
            {currentStep > 0 ? (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setCurrentStep((prev) => prev - 1)}
                activeOpacity={0.75}
              >
                <Text style={styles.secondaryBtnText}>‹ Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.btnSpacer} />
            )}

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>
                {isLast ? 'Get Started 🚀' : 'Next ›'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 16, 31, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.25)',
    borderRadius: theme.radius.xl,
    padding: 22,
    shadowColor: theme.colors.cyan,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  badgeWrap: {
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
  },
  badgeText: {
    color: theme.colors.cyan,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  skipBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  skipText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  heroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  glowRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
    borderWidth: 2,
    borderColor: 'rgba(34, 211, 238, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: {
    fontSize: 44,
  },
  title: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  desc: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 16,
  },
  highlightsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: theme.radius.md,
    padding: 12,
    gap: 8,
    marginBottom: 18,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  highlightText: {
    color: theme.colors.text,
    fontSize: 12,
    lineHeight: 17,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  dotActive: {
    width: 24,
    backgroundColor: theme.colors.cyan,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  secondaryBtnText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  btnSpacer: {
    width: 60,
  },
  primaryBtn: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: theme.colors.cyan,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: theme.colors.bg,
    fontSize: 14,
    fontWeight: '700',
  },
});
