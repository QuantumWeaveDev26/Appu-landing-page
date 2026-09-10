import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useLanguage } from '../i18n/useLanguage';
import { useAuthStore } from '../stores/authStore';
import { sendAppuMessage } from '../lib/api';
import { TypingIndicator } from '../components/TypingIndicator';

interface ChatMessage {
  id: string;
  sender: 'user' | 'appu';
  text: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'error';
  isGateCard?: boolean;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export function ChatScreen({ navigation, route }: Props) {
  const { t, currentLanguage } = useLanguage();
  const { user, session, isGuest, guestToken, guestRemainingQuota, updateGuestQuota } =
    useAuthStore();

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome_1',
      sender: 'appu',
      text: t('chat.emptyState'),
      timestamp: Date.now(),
      status: 'sent',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [isNewConversation, setIsNewConversation] = useState(true);

  const flatListRef = useRef<FlatList>(null);
  const hasHandledInitialPrompt = useRef(false);

  const isQuotaExhausted = isGuest && guestRemainingQuota <= 0;

  // Handle initial prompt from navigation (e.g. Mission cards or Explore Prompts)
  useEffect(() => {
    const prompt = route.params?.initialPrompt;
    if (prompt && !hasHandledInitialPrompt.current) {
      hasHandledInitialPrompt.current = true;
      handleSendMessage(prompt);
    }
  }, [route.params?.initialPrompt]);

  const handleNewChat = () => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        sender: 'appu',
        text: t('chat.emptyState'),
        timestamp: Date.now(),
        status: 'sent',
      },
    ]);
    setConversationId(undefined);
    setIsNewConversation(true);
    setInputText('');
  };

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend ?? inputText).trim();
    if (!messageContent || isLoading) return;

    if (isQuotaExhausted) {
      navigation.navigate('Auth');
      return;
    }

    setInputText('');

    const userMessageId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const userMsg: ChatMessage = {
      id: userMessageId,
      sender: 'user',
      text: messageContent,
      timestamp: Date.now(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await sendAppuMessage({
        message: messageContent,
        language: (currentLanguage as 'en' | 'kn' | 'hi') || 'en',
        includeAudio: false,
        accessToken: session?.access_token,
        guestToken: isGuest ? guestToken || undefined : undefined,
        conversationId,
        newConversation: isNewConversation,
      });

      // Mark user message as sent
      setMessages((prev) =>
        prev.map((m) => (m.id === userMessageId ? { ...m, status: 'sent' } : m))
      );

      // Track conversation continuity
      if (isNewConversation) {
        setIsNewConversation(false);
      }
      if (response.conversationId) {
        setConversationId(response.conversationId);
      }

      // Update quota in auth store if returned
      if (response.guest) {
        updateGuestQuota(response.guest.remaining, response.guest.token);
      } else if (response.guestSession) {
        updateGuestQuota(response.guestSession.remaining, response.guestSession.token);
      }

      // Check if guest limit was reached
      if (response.loginRequired || response.code === 'GUEST_LIMIT_REACHED') {
        const replyText =
          response.text ||
          t('chat.guestLimitDesc');

        setMessages((prev) => [
          ...prev,
          {
            id: `appu_limit_${Date.now()}`,
            sender: 'appu',
            text: replyText,
            timestamp: Date.now(),
            status: 'sent',
          },
          {
            id: `gate_${Date.now()}`,
            sender: 'appu',
            text: '',
            timestamp: Date.now() + 1,
            status: 'sent',
            isGateCard: true,
          },
        ]);
      } else {
        const replyText =
          response.text ||
          '';

        if (replyText) {
          setMessages((prev) => [
            ...prev,
            {
              id: response.requestId || `appu_${Date.now()}`,
              sender: 'appu',
              text: replyText,
              timestamp: Date.now(),
              status: 'sent',
            },
          ]);
        }
      }
    } catch (err: any) {
      console.warn('[Chat] Send failed:', err);
      // Mark user message as error
      setMessages((prev) =>
        prev.map((m) => (m.id === userMessageId ? { ...m, status: 'error' } : m))
      );
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleRetry = (msg: ChatMessage) => {
    // Remove the errored message and resend
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    handleSendMessage(msg.text);
  };

  const quickPrompts = [
    { label: '💡 Explain Photosynthesis', prompt: 'Can you explain photosynthesis in a fun and simple way?' },
    { label: '⚡ Quiz me on Solar System', prompt: 'Give me a fun 3-question quiz about the planets!' },
    { label: '📖 Help with Fractions', prompt: 'How do I add fractions with different denominators?' },
  ];

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    if (item.isGateCard) {
      return (
        <View style={styles.gateCardContainer}>
          <View style={styles.gateCard}>
            <View style={styles.gateHeader}>
              <Text style={styles.gateIcon}>✦</Text>
              <Text style={styles.gateTitle}>{t('chat.guestLimitTitle')}</Text>
            </View>
            <Text style={styles.gateBody}>{t('chat.guestLimitDesc')}</Text>
            <TouchableOpacity
              style={styles.gateButton}
              onPress={() => navigation.navigate('Auth')}
              activeOpacity={0.8}
            >
              <Text style={styles.gateButtonText}>
                {t('chat.signInToContinue')} →
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const isUser = item.sender === 'user';

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.messageRowUser : styles.messageRowAppu,
        ]}
      >
        {!isUser && (
          <View style={styles.appuAvatarBadge}>
            <Image
              source={require('../../assets/appu_cutout.png')}
              style={styles.appuAvatarSmall}
              resizeMode="contain"
            />
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAppu,
            item.status === 'error' && styles.bubbleError,
          ]}
        >
          {!isUser && (
            <Text style={styles.appuSenderLabel}>{t('chat.appuSays')}</Text>
          )}
          <Text style={[styles.messageText, isUser && styles.messageTextUser]}>
            {item.text}
          </Text>
          {item.status === 'error' && (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => handleRetry(item)}
            >
              <Text style={styles.retryText}>⚠️ {t('chat.retry')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
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
            <View style={styles.headerAvatarWrap}>
              <Image
                source={require('../../assets/appu_cutout.png')}
                style={styles.headerAvatar}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text style={styles.headerTitle}>{t('common.appTitle')}</Text>
              <Text style={styles.headerSubtitle}>🟢 {t('common.statusReady')}</Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            {isGuest && (
              <View
                style={[
                  styles.quotaBadge,
                  guestRemainingQuota <= 2 && styles.quotaBadgeLow,
                ]}
              >
                <Text style={styles.quotaText}>
                  ⚡ {guestRemainingQuota}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.newChatBtn}
              onPress={handleNewChat}
              activeOpacity={0.7}
            >
              <Text style={styles.newChatText}>+ {t('chat.newChat')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Message List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messageListContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <>
              {isLoading && <TypingIndicator label={t('chat.thinking')} />}
              {messages.length === 1 && !isLoading && (
                <View style={styles.quickPromptsSection}>
                  <Text style={styles.quickPromptsTitle}>
                    ✦ Try asking Appu:
                  </Text>
                  <View style={styles.quickPromptsRow}>
                    {quickPrompts.map((qp, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.quickPromptChip}
                        onPress={() => handleSendMessage(qp.prompt)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.quickPromptChipText}>{qp.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </>
          }
        />

        {/* Bottom Input or Quota Exhausted Banner */}
        {isQuotaExhausted ? (
          <View style={styles.exhaustedBar}>
            <Text style={styles.exhaustedText}>
              {t('chat.guestLimitTitle')}
            </Text>
            <TouchableOpacity
              style={styles.signInBarBtn}
              onPress={() => navigation.navigate('Auth')}
              activeOpacity={0.8}
            >
              <Text style={styles.signInBarBtnText}>
                {t('chat.signInToContinue')} →
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              placeholder={t('chat.placeholder')}
              placeholderTextColor={theme.colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!inputText.trim() || isLoading) && styles.sendBtnDisabled,
              ]}
              onPress={() => handleSendMessage()}
              disabled={!inputText.trim() || isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#031124" />
              ) : (
                <Text style={styles.sendBtnText}>➤</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
    backgroundColor: '#07152b',
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
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAvatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0a1e3b',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerAvatar: {
    width: 26,
    height: 26,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#34d399',
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quotaBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  quotaBadgeLow: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  quotaText: {
    color: theme.colors.cyan,
    fontSize: 11,
    fontWeight: '700',
  },
  newChatBtn: {
    backgroundColor: '#0b203e',
    borderColor: theme.colors.line,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  newChatText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  messageListContent: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 6,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAppu: {
    justifyContent: 'flex-start',
  },
  appuAvatarBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0a1e3b',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    overflow: 'hidden',
  },
  appuAvatarSmall: {
    width: 28,
    height: 28,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: '#11335d',
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: '#1d487f',
  },
  bubbleAppu: {
    backgroundColor: '#091a32',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  bubbleError: {
    borderColor: '#ef4444',
    backgroundColor: '#260e15',
  },
  appuSenderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.cyan,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageText: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 22,
  },
  messageTextUser: {
    color: '#f0f9ff',
  },
  retryBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  retryText: {
    fontSize: 12,
    color: '#f87171',
    fontWeight: '700',
  },
  gateCardContainer: {
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  gateCard: {
    backgroundColor: '#0d223f',
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 18,
  },
  gateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  gateIcon: {
    color: theme.colors.cyan,
    fontSize: 18,
  },
  gateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  gateBody: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
    marginBottom: 14,
  },
  gateButton: {
    backgroundColor: theme.colors.cyan,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  gateButtonText: {
    color: '#031124',
    fontSize: 14,
    fontWeight: '800',
  },
  quickPromptsSection: {
    marginTop: 18,
    paddingHorizontal: 4,
  },
  quickPromptsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginBottom: 10,
  },
  quickPromptsRow: {
    gap: 8,
  },
  quickPromptChip: {
    backgroundColor: '#0a1d37',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  quickPromptChipText: {
    color: '#e0f2fe',
    fontSize: 14,
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#07152b',
    borderTopWidth: 1,
    borderTopColor: theme.colors.line,
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0b1d36',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 110,
    minHeight: 42,
    fontSize: 15,
    color: theme.colors.text,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.cyan,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#1b324d',
    opacity: 0.6,
  },
  sendBtnText: {
    color: '#031124',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 2,
  },
  exhaustedBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0b203d',
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 158, 11, 0.3)',
    alignItems: 'center',
    gap: 10,
  },
  exhaustedText: {
    color: '#fef3c7',
    fontSize: 14,
    fontWeight: '700',
  },
  signInBarBtn: {
    backgroundColor: theme.colors.cyan,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  signInBarBtnText: {
    color: '#031124',
    fontSize: 14,
    fontWeight: '800',
  },
});
