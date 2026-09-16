import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { theme } from '../theme';
import { useLanguage } from '../i18n/useLanguage';
import { submitFamilyFeedback } from '../lib/api';
import { setCachedFeedbackUnlocked } from '../lib/feedbackGate';
import { FeedbackDropdown } from './FeedbackDropdown';
import {
  WHATS_WORKING_PRESETS,
  WHATS_TO_IMPROVE_PRESETS,
} from '../lib/feedbackPresets';

interface Props {
  visible: boolean;
  accessToken?: string;
  userId?: string;
  onFeedbackSubmitted: () => void;
  onDismiss?: () => void;
}

export function ParentFeedbackGateModal({
  visible,
  accessToken,
  userId,
  onFeedbackSubmitted,
  onDismiss,
}: Props) {
  const { t, currentLanguage } = useLanguage();
  const [rating, setRating] = useState(5);
  const [whatsWorking, setWhatsWorking] = useState('');
  const [whatsToImprove, setWhatsToImprove] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isFeedbackValid =
    rating >= 1 &&
    rating <= 5 &&
    whatsWorking.trim().length > 0 &&
    whatsToImprove.trim().length > 0;

  const handleSubmit = async () => {
    if (!accessToken) return;
    const workingTrimmed = whatsWorking.trim();
    const improveTrimmed = whatsToImprove.trim();

    if (!workingTrimmed || !improveTrimmed) {
      Alert.alert(
        t('parent.feedbackRequiredAlert'),
        t('parent.bothFeedbackFieldsRequired')
      );
      return;
    }

    setSubmitting(true);
    try {
      await submitFamilyFeedback(accessToken, {
        rating,
        whatsWorking: workingTrimmed,
        whatsToImprove: improveTrimmed,
      });

      await setCachedFeedbackUnlocked(userId);
      onFeedbackSubmitted();

      Alert.alert(
        t('parent.feedbackModalTitle'),
        t('parent.reportsUnlockedBadge') + '! Thank you for your feedback. You can now continue chatting.'
      );
    } catch (err: any) {
      Alert.alert(
        'Submission Failed',
        err.message || 'Could not submit feedback. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onDismiss || (() => {})}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <View style={styles.badgeRow}>
                <View style={styles.pillBadge}>
                  <Text style={styles.pillBadgeText}>{t('chat.feedbackGatePill')}</Text>
                </View>
              </View>
              <Text style={styles.modalTitle}>{t('chat.feedbackGateTitle')}</Text>
            </View>
            {onDismiss && (
              <TouchableOpacity
                onPress={onDismiss}
                activeOpacity={0.7}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalSubtitle}>
              {t('chat.feedbackGateNote')}
            </Text>

            {/* Star Rating */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t('parent.feedbackRatingLabel')} *</Text>
              <View style={styles.starRatingRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    style={styles.starBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.starIcon, rating >= star && styles.starIconActive]}>
                      ★
                    </Text>
                  </TouchableOpacity>
                ))}
                <Text style={styles.starRatingText}>{rating} / 5</Text>
              </View>
            </View>

            {/* What is working */}
            <FeedbackDropdown
              label={t('parent.whatsWorkingLabel')}
              placeholder={t('parent.whatsWorkingPlaceholder')}
              otherPlaceholder={t('chat.feedbackOtherWorkingPlaceholder')}
              options={WHATS_WORKING_PRESETS}
              selectedValue={whatsWorking}
              onSelect={setWhatsWorking}
              language={currentLanguage}
            />

            {/* What would make it even better */}
            <FeedbackDropdown
              label={t('parent.whatsToImproveLabel')}
              placeholder={t('parent.whatsToImprovePlaceholder')}
              otherPlaceholder={t('chat.feedbackOtherImprovePlaceholder')}
              options={WHATS_TO_IMPROVE_PRESETS}
              selectedValue={whatsToImprove}
              onSelect={setWhatsToImprove}
              language={currentLanguage}
            />

            {/* Actions: submit & maybe later */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  (!isFeedbackValid || submitting) && styles.btnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!isFeedbackValid || submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#030c1e" />
                ) : (
                  <Text style={styles.modalSubmitText}>
                    {t('parent.submitFeedbackBtn')}
                  </Text>
                )}
              </TouchableOpacity>

              {onDismiss && (
                <TouchableOpacity
                  style={styles.modalLaterBtn}
                  onPress={onDismiss}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalLaterText}>
                    {t('chat.feedbackGateMaybeLater')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 12, 30, 0.88)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#07152b',
    borderRadius: theme.radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  closeBtn: {
    padding: 6,
    borderRadius: theme.radius.sm,
  },
  modalCloseText: {
    color: '#94a3b8',
    fontSize: 18,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  pillBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  pillBadgeText: {
    color: '#facc15',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  starRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  starBtn: {
    padding: 4,
  },
  starIcon: {
    fontSize: 30,
    color: '#334155',
  },
  starIconActive: {
    color: '#facc15',
  },
  starRatingText: {
    color: '#facc15',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
  textInput: {
    backgroundColor: '#0c1e38',
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 13,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  modalActions: {
    marginTop: 18,
  },
  modalSubmitBtn: {
    backgroundColor: theme.colors.cyan,
    paddingVertical: 13,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.45,
  },
  modalSubmitText: {
    color: '#030c1e',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalLaterBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalLaterText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

