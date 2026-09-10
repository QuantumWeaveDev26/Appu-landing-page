import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { useLanguage } from '../i18n/useLanguage';

interface ExplorePromptsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPrompt: (prompt: string) => void;
}

interface PromptCategory {
  category: string;
  icon: string;
  prompts: { label: string; prompt: string }[];
}

const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    category: 'Science & Physics',
    icon: '🔬',
    prompts: [
      {
        label: 'Why is the sky blue?',
        prompt: 'Why is the sky blue? Explain Rayleigh scattering simply for a school student.',
      },
      {
        label: 'How does photosynthesis work?',
        prompt: 'Explain photosynthesis with a fun everyday story and simple steps.',
      },
      {
        label: 'What is gravity?',
        prompt: 'Explain what gravity is and why objects fall at the same rate in a vacuum.',
      },
    ],
  },
  {
    category: 'Maths & Logic',
    icon: '📐',
    prompts: [
      {
        label: 'Explain the Pythagorean theorem',
        prompt: 'Help me understand the Pythagorean theorem using a visual triangle example.',
      },
      {
        label: 'Fraction trick for adding unlike denominators',
        prompt: 'How do I add fractions with different denominators? Teach me step by step.',
      },
      {
        label: 'What is a prime number?',
        prompt: 'What makes a number prime, and why are they important in maths?',
      },
    ],
  },
  {
    category: 'History & India',
    icon: '🇮🇳',
    prompts: [
      {
        label: 'Tell me about the Indus Valley Civilization',
        prompt: 'What was special about the town planning of the Indus Valley Civilization?',
      },
      {
        label: 'How do rockets launch into space (ISRO)?',
        prompt: 'How does an Indian rocket reach orbit? Explain stage separation simply.',
      },
    ],
  },
  {
    category: 'Study Habits & Exam Tips',
    icon: '⚡',
    prompts: [
      {
        label: 'How to make a 1-week revision timetable',
        prompt: 'Help me plan a 1-week exam revision timetable for 3 subjects.',
      },
      {
        label: 'Teach me the Feynman technique',
        prompt: 'How do I use the Feynman technique to remember hard formulas?',
      },
    ],
  },
];

export function ExplorePromptsModal({
  visible,
  onClose,
  onSelectPrompt,
}: ExplorePromptsModalProps) {
  const { t } = useLanguage();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.sheetContainer}>
          {/* Sheet Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetKicker}>PROMPT LIBRARY</Text>
              <Text style={styles.sheetTitle}>{t('home.explorePrompts')}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Prompt Categories List */}
          <ScrollView
            contentContainerStyle={styles.scrollBody}
            showsVerticalScrollIndicator={false}
          >
            {PROMPT_CATEGORIES.map((cat, idx) => (
              <View key={idx} style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text style={styles.categoryName}>{cat.category}</Text>
                </View>

                <View style={styles.promptList}>
                  {cat.prompts.map((item, pIdx) => (
                    <TouchableOpacity
                      key={pIdx}
                      style={styles.promptChip}
                      onPress={() => onSelectPrompt(item.prompt)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.promptLabel}>{item.label}</Text>
                      <Text style={styles.promptArrow}>→</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 10, 22, 0.85)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: theme.colors.bgElevated,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
  },
  sheetKicker: {
    color: theme.colors.cyanSoft,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  sheetTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 20,
  },
  categorySection: {
    gap: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryName: {
    color: theme.colors.cyanSoft,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  promptList: {
    gap: 8,
  },
  promptChip: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  promptLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },
  promptArrow: {
    color: theme.colors.cyan,
    fontSize: 15,
    fontWeight: '900',
  },
});
