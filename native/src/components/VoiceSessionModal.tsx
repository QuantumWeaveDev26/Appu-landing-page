import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { theme } from '../theme';
import { useLanguage } from '../i18n/useLanguage';
import { useAuthStore } from '../stores/authStore';
import { sendAppuMessage } from '../lib/api';
import { voiceService } from '../lib/voiceService';

interface VoiceSessionModalProps {
  visible: boolean;
  onClose: () => void;
  conversationId?: string;
  onExchangeCompleted?: (exchange: {
    userText: string;
    assistantText: string;
    conversationId?: string | null;
  }) => void;
  onSignInPress?: () => void;
}

export function VoiceSessionModal({
  visible,
  onClose,
  conversationId,
  onExchangeCompleted,
  onSignInPress,
}: VoiceSessionModalProps) {
  const { t, currentLanguage, setLanguage, languages } = useLanguage();
  const {
    session,
    isGuest,
    guestToken,
    guestRemainingQuota,
    updateGuestQuota,
    activeChildId,
  } = useAuthStore();

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [responseText, setResponseText] = useState('');
  const [autoListen, setAutoListen] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const autoListenRef = useRef(autoListen);
  autoListenRef.current = autoListen;

  const isQuotaExhausted = isGuest && guestRemainingQuota <= 0;

  // Pulse animations for listening / speaking
  const pulseAnim = useSharedValue(0);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulseAnim]);

  const auraStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulseAnim.value, [0, 1], [1, 1.18]);
    const opacity = interpolate(pulseAnim.value, [0, 1], [0.3, 0.7]);
    return {
      transform: [{ scale }],
      opacity: isListening || isSpeaking ? opacity : 0.25,
    };
  });

  const micRingStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulseAnim.value, [0, 1], [1, 1.35]);
    const opacity = interpolate(pulseAnim.value, [0, 1], [0.6, 0]);
    return {
      transform: [{ scale }],
      opacity: isListening ? opacity : 0,
    };
  });

  // Start listening on open if not quota exhausted
  useEffect(() => {
    if (visible) {
      setErrorNotice(null);
      setTranscript('');
      setResponseText('');
      if (!isQuotaExhausted) {
        startListeningSession();
      }
    } else {
      stopAll();
    }
    return () => {
      stopAll();
    };
  }, [visible]);

  const stopAll = () => {
    voiceService.stopPlayback();
    voiceService.cancelListening();
    setIsListening(false);
    setIsSpeaking(false);
    setIsLoading(false);
  };

  const handleClose = () => {
    stopAll();
    onClose();
  };

  const startListeningSession = async () => {
    if (isQuotaExhausted) return;

    stopAll();
    setErrorNotice(null);
    setTranscript('');
    setIsListening(true);

    try {
      await voiceService.startListening(currentLanguage, {
        onStart: () => {
          setIsListening(true);
        },
        onPartial: (partialText) => {
          setTranscript(partialText);
        },
        onResults: (finalText) => {
          setTranscript(finalText);
          setIsListening(false);
          if (finalText && finalText.trim()) {
            dispatchVoiceMessage(finalText.trim());
          }
        },
        onError: (err) => {
          console.warn('[VoiceModal] STT Error:', err);
          setIsListening(false);
          // Only show fatal error if no text was captured
          if (!transcript.trim()) {
            setErrorNotice(t('voice.tapToSpeak'));
          }
        },
      });
    } catch (err: any) {
      setIsListening(false);
      setErrorNotice(t('voice.permissionDenied'));
    }
  };

  const dispatchVoiceMessage = async (text: string) => {
    setIsLoading(true);
    setErrorNotice(null);

    try {
      const response = await sendAppuMessage({
        message: text,
        language: (currentLanguage as 'en' | 'kn' | 'hi') || 'en',
        includeAudio: true,
        accessToken: session?.access_token,
        childId: !isGuest ? (activeChildId || undefined) : undefined,
        guestToken: isGuest ? guestToken || undefined : undefined,
        conversationId,
      });

      if (response.guest) {
        updateGuestQuota(response.guest.remaining, response.guest.token);
      } else if (response.guestSession) {
        updateGuestQuota(response.guestSession.remaining, response.guestSession.token);
      }

      const answer = response.text || '';
      setResponseText(answer);

      onExchangeCompleted?.({
        userText: text,
        assistantText: answer,
        conversationId: response.conversationId,
      });

      setIsLoading(false);

      if (response.loginRequired || response.code === 'GUEST_LIMIT_REACHED') {
        setIsSpeaking(false);
        return;
      }

      // Play Appu voice
      await voiceService.playAppuVoice({
        audioStreamUrl: response.audioStreamUrl,
        audioSource: response.audioSource,
        text: answer,
        language: currentLanguage as 'en' | 'kn' | 'hi',
        accessToken: session?.access_token,
        guestToken: isGuest ? guestToken : undefined,
        onStart: () => {
          setIsSpeaking(true);
        },
        onFinish: () => {
          setIsSpeaking(false);
          if (autoListenRef.current && !isQuotaExhausted) {
            setTimeout(() => {
              startListeningSession();
            }, 450);
          }
        },
        onError: (err) => {
          console.warn('[VoiceModal] Audio play error:', err);
          setIsSpeaking(false);
        },
      });
    } catch (err: any) {
      console.warn('[VoiceModal] Send voice message error:', err);
      setIsLoading(false);
      setErrorNotice(err?.message || t('chat.errorGeneric'));
    }
  };

  const handleMicPress = () => {
    if (isListening) {
      voiceService.stopListening();
      setIsListening(false);
      if (transcript.trim()) {
        dispatchVoiceMessage(transcript.trim());
      }
    } else if (isSpeaking) {
      voiceService.stopPlayback();
      setIsSpeaking(false);
    } else {
      startListeningSession();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <Text style={styles.closeBtnText}>✕ {t('voice.close')}</Text>
          </TouchableOpacity>

          <View style={styles.langPills}>
            {languages.map((l) => {
              const active = l.code === currentLanguage;
              return (
                <TouchableOpacity
                  key={l.code}
                  style={[styles.langPill, active && styles.langPillActive]}
                  onPress={() => setLanguage(l.code)}
                >
                  <Text
                    style={[
                      styles.langPillText,
                      active && styles.langPillTextActive,
                    ]}
                  >
                    {l.code.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {isGuest && (
            <View style={styles.quotaBadge}>
              <Text style={styles.quotaText}>⚡ {guestRemainingQuota}</Text>
            </View>
          )}
        </View>

        {/* Central Visualizer & Avatar */}
        <View style={styles.stageArea}>
          <Animated.View style={[styles.auraRing, auraStyle]} />
          <View style={styles.avatarPodium}>
            <Image
              source={require('../../assets/appu_cutout.png')}
              style={styles.avatarImage}
              resizeMode="contain"
            />
          </View>

          {/* Status badge */}
          <View style={styles.statusPill}>
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.colors.cyan} />
            ) : (
              <Text style={styles.statusDot}>
                {isListening ? '🎙️' : isSpeaking ? '🔊' : '🟢'}
              </Text>
            )}
            <Text style={styles.statusLabel}>
              {isLoading
                ? t('chat.thinking')
                : isListening
                ? t('voice.listening')
                : isSpeaking
                ? t('voice.appuSpeaking')
                : t('voice.tapToSpeak')}
            </Text>
          </View>
        </View>

        {/* Live Subtitle Card */}
        <View style={styles.subtitleCard}>
          {isQuotaExhausted ? (
            <View style={styles.quotaGateWrap}>
              <Text style={styles.quotaGateTitle}>
                {t('chat.guestLimitTitle')}
              </Text>
              <Text style={styles.quotaGateDesc}>
                {t('chat.guestLimitDesc')}
              </Text>
              <TouchableOpacity
                style={styles.signInBtn}
                onPress={() => {
                  handleClose();
                  onSignInPress?.();
                }}
              >
                <Text style={styles.signInBtnText}>
                  {t('chat.signInToContinue')} →
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {errorNotice ? (
                <Text style={styles.errorNoticeText}>{errorNotice}</Text>
              ) : isListening && transcript ? (
                <Text style={styles.userSubtitleText}>"{transcript}"</Text>
              ) : isListening ? (
                <Text style={styles.placeholderSubtitle}>
                  {t('voice.listening')}
                </Text>
              ) : responseText ? (
                <Text style={styles.appuSubtitleText}>{responseText}</Text>
              ) : (
                <Text style={styles.placeholderSubtitle}>
                  {t('chat.emptyState')}
                </Text>
              )}
            </>
          )}
        </View>

        {/* Controls dock */}
        <View style={styles.dock}>
          {/* Auto-listen toggle */}
          <TouchableOpacity
            style={[
              styles.autoListenChip,
              autoListen && styles.autoListenChipActive,
            ]}
            onPress={() => setAutoListen((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.autoListenText,
                autoListen && styles.autoListenTextActive,
              ]}
            >
              ✦ {autoListen ? t('voice.autoListenOn') : t('voice.autoListenOff')}
            </Text>
          </TouchableOpacity>

          {/* Big Mic Button */}
          <View style={styles.micButtonWrapper}>
            <Animated.View style={[styles.micPulseHalo, micRingStyle]} />
            <TouchableOpacity
              style={[
                styles.bigMicBtn,
                isListening && styles.bigMicBtnListening,
                isSpeaking && styles.bigMicBtnSpeaking,
              ]}
              onPress={handleMicPress}
              activeOpacity={0.8}
            >
              <Text style={styles.bigMicIcon}>
                {isListening ? '⏹' : isSpeaking ? '⏸' : '🎙️'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#040d1a',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
  },
  langPills: {
    flexDirection: 'row',
    backgroundColor: '#081c36',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  langPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  langPillActive: {
    backgroundColor: theme.colors.cyan,
  },
  langPillText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  langPillTextActive: {
    color: '#031124',
  },
  quotaBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  quotaText: {
    color: theme.colors.cyan,
    fontSize: 12,
    fontWeight: '700',
  },
  stageArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  auraRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  avatarPodium: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#071830',
    borderWidth: 2,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 145,
    height: 145,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    backgroundColor: 'rgba(10, 26, 48, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statusDot: {
    fontSize: 14,
  },
  statusLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  subtitleCard: {
    marginHorizontal: 16,
    minHeight: 120,
    maxHeight: 180,
    backgroundColor: 'rgba(10, 26, 50, 0.7)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    padding: 16,
    justifyContent: 'center',
  },
  userSubtitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.cyan,
    lineHeight: 24,
    textAlign: 'center',
  },
  appuSubtitleText: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 23,
    textAlign: 'center',
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  errorNoticeText: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  quotaGateWrap: {
    alignItems: 'center',
    gap: 8,
  },
  quotaGateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fef3c7',
  },
  quotaGateDesc: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  signInBtn: {
    backgroundColor: theme.colors.cyan,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 9,
    marginTop: 4,
  },
  signInBtnText: {
    color: '#031124',
    fontSize: 13,
    fontWeight: '800',
  },
  dock: {
    alignItems: 'center',
    gap: 14,
    marginTop: 10,
  },
  autoListenChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  autoListenChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  autoListenText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  autoListenTextActive: {
    color: theme.colors.cyan,
  },
  micButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  micPulseHalo: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(56, 189, 248, 0.4)',
  },
  bigMicBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: theme.colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: theme.colors.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  bigMicBtnListening: {
    backgroundColor: '#ef4444',
  },
  bigMicBtnSpeaking: {
    backgroundColor: '#f59e0b',
  },
  bigMicIcon: {
    fontSize: 30,
  },
});
