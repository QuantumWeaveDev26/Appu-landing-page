import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  Alert,
  Linking,
  Share,
} from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { theme, tc } from '../theme';
import { useLanguage } from '../i18n/useLanguage';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { sendAppuMessage, fetchConversationMessages, fetchConversations } from '../lib/api';
import { voiceService } from '../lib/voiceService';
import { fetchStudyLesson, getLesson, gradeFromBand } from '../lessons/lessonApi';
import { rememberLesson, restoreLessons } from '../lessons/lessonCache';
import { StudyModes } from '../lessons/LessonViews';
import { SideDrawer, MISSIONS, type DrawerAction } from '../components/SideDrawer';
import { AchievementsModal, XpToast } from '../components/AchievementsModal';
import { ExplorePromptsModal } from '../components/ExplorePromptsModal';
import { SpotlightTour, type TargetRefs } from '../components/SpotlightTour';
import { useProgressStore } from '../stores/progressStore';
import { useSavedLessonsStore } from '../stores/savedLessonsStore';
import { buildWhatsAppShareUrl } from '../lib/studySchedule';
import { TypingIndicator } from '../components/TypingIndicator';
import { CallScreen, type CallState } from '../components/CallScreen';
import { liveVoice } from '../lib/liveVoice';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { AttachSheet, type AttachChoice } from '../components/AttachSheet';
import { ParentalLock } from '../components/ParentalLock';
import { BrainBreakCard, BRAIN_BREAK_ACTIVE_MS, BRAIN_BREAK_IDLE_MS, isBrainBreakGrade } from '../components/BrainBreak';
import { askNotesTutor, pickNotesFile, pickPhoto, type NotesDocument, type PendingImage } from '../lessons/attachments';
import { RecentChatsModal } from '../components/RecentChatsModal';
import { ParentFeedbackGateModal } from '../components/ParentFeedbackGateModal';
import {
  FEEDBACK_CHAT_THRESHOLD,
  getAuthedChatCount,
  incrementAuthedChatCount,
  snoozeAuthedChatCount,
  isCachedFeedbackUnlocked,
  checkFeedbackStatus,
} from '../lib/feedbackGate';

interface ChatMessage {
  id: string;
  sender: 'user' | 'appu';
  text: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'error';
  isGateCard?: boolean;
  audioStreamUrl?: string | null;
  audioSource?: string | null;
  quickReplies?: string[];
  isSystem?: boolean; // call start / end markers
  imageUri?: string; // homework photo sent with the question
  isBrainBreak?: boolean; // mini-game card
  lessonState?: 'loading' | 'ready' | 'none' | 'missing'; // missing = reopened from history, pictures not on this phone
  lessonTopic?: string;
  lessonQuestion?: string; // the learner's question, to draw pictures for a reopened answer
}

type Props = NativeStackScreenProps<RootStackParamList, 'Chat' | 'Home'>;

// Bright, friendly colours for the four mission tiles on the home screen.
const TILE_COLORS = [tc('#bae6fd', 'b'), tc('#fde68a', 'b'), tc('#bbf7d0', 'b'), tc('#fbcfe8', 'b')];

export function ChatScreen({ navigation, route }: Props) {
  const { t, currentLanguage } = useLanguage();
  const {
    user,
    session,
    isGuest,
    guestToken,
    guestRemainingQuota,
    updateGuestQuota,
    activeChildId,
    activeChild,
    children,
    hasCompletedPersonalisation,
  } = useAuthStore();

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
  const [liveMode, setLiveMode] = useState<'mic' | 'call' | null>(null);
  const [heard, setHeard] = useState('');
  const [callStartedAt, setCallStartedAt] = useState(0);
  const liveModeRef = useRef<'mic' | 'call' | null>(null);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [activeDoc, setActiveDoc] = useState<NotesDocument | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const lastInputAt = useRef(0);
  const activeMs = useRef(0);
  liveModeRef.current = liveMode;
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  // Buttons the guided tour points at.
  const tourTargets: TargetRefs = {
    menu: useRef<View>(null),
    progress: useRef<View>(null),
    newChat: useRef<View>(null),
    missions: useRef<View>(null),
    input: useRef<View>(null),
    attach: useRef<View>(null),
    mic: useRef<View>(null),
    call: useRef<View>(null),
  };
  // Opens the tour once the screen (and any closing menu) has settled.
  const openTour = () => setTimeout(() => setIsTourOpen(true), 450);
  const { streak, xp, load: loadProgress } = useProgressStore();
  const savedLessons = useSavedLessonsStore();

  useEffect(() => {
    let lastTick = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.min(now - lastTick, 10000);
      lastTick = now;
      const grade = Number(gradeFromBand(activeChild?.gradeBand));
      if (isGuest || !activeChild || !isBrainBreakGrade(grade) || liveModeRef.current === 'call') return;
      if (now - lastInputAt.current <= BRAIN_BREAK_IDLE_MS) activeMs.current += elapsed;
      if (activeMs.current >= BRAIN_BREAK_ACTIVE_MS && !voiceService.isSpeaking) {
        activeMs.current = 0;
        setMessages((prev) => [
          ...prev,
          { id: `bb_${now}`, sender: 'appu', text: '', timestamp: now, status: 'sent', isBrainBreak: true },
        ]);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [isGuest, activeChild?.id, activeChild?.gradeBand]);

  useEffect(() => {
    void loadProgress();
    void savedLessons.load();
  }, []);

  // Feedback gate state (after 12 chats, signed-in parent must submit feedback)
  const [feedbackUnlocked, setFeedbackUnlocked] = useState(false);
  const [authedChatCount, setAuthedChatCount] = useState(0);
  const [isFeedbackGateModalVisible, setIsFeedbackGateModalVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const hasHandledInitialPrompt = useRef(false);

  const isGuestGated = isGuest && guestRemainingQuota <= 0;
  const isAuthRequired = (!isGuest && (!session || !user)) || isGuestGated;
  const isProfileRequired = !isGuest && (!activeChild || !hasCompletedPersonalisation());
  const isFeedbackGated =
    !isGuest &&
    Boolean(session && user) &&
    !feedbackUnlocked &&
    authedChatCount >= FEEDBACK_CHAT_THRESHOLD;

  // Check unlock status and authed chat count for signed-in parents
  useEffect(() => {
    let isMounted = true;
    const userId = session?.user?.id;
    if (!isGuest && session?.access_token && userId) {
      void isCachedFeedbackUnlocked(userId).then((cached) => {
        if (!isMounted) return;
        if (cached) {
          setFeedbackUnlocked(true);
        } else {
          void checkFeedbackStatus(session.access_token, userId).then((unlocked) => {
            if (!isMounted) return;
            setFeedbackUnlocked(unlocked);
          });
        }
      });

      void getAuthedChatCount(userId).then((count) => {
        if (!isMounted) return;
        setAuthedChatCount(count);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [isGuest, session?.access_token, session?.user?.id]);

  // Force open the feedback gate modal if user reaches the threshold
  useEffect(() => {
    if (isFeedbackGated) {
      setIsFeedbackGateModalVisible(true);
    }
  }, [isFeedbackGated]);

  // Handle initial prompt from navigation (e.g. Mission cards or Explore Prompts)
  useEffect(() => {
    if (route.params?.initialPrompt && !hasHandledInitialPrompt.current) {
      hasHandledInitialPrompt.current = true;
      if (isAuthRequired) {
        navigation.navigate('Auth', {
          initialPrompt: route.params.initialPrompt,
          returnTo: 'Chat',
        });
        return;
      }
      if (isProfileRequired) {
        navigation.navigate('ParentZone', {
          tab: activeChild ? 'personalization' : 'learners',
          initialPrompt: route.params.initialPrompt,
          returnToChat: true,
          promptSetupRequired: true,
        });
        return;
      }
      handleSendMessage(route.params.initialPrompt);
    }
  }, [route.params?.initialPrompt, isAuthRequired, isProfileRequired, activeChild]);

  // Older answers reopened from history: draw their pictures when the learner asks.
  const drawPictures = (msg: ChatMessage) => {
    const setState = (lessonState: ChatMessage['lessonState']) =>
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, lessonState } : m)));
    setState('loading');
    void fetchStudyLesson({
      id: msg.id,
      question: msg.lessonQuestion || '',
      answer: msg.text,
      grade: gradeFromBand(activeChild?.gradeBand),
      language: (currentLanguage as string) || 'en',
    }).then((lesson) => {
      if (lesson) void rememberLesson(msg.text, lesson);
      setState(lesson ? 'ready' : 'missing');
    });
  };

  // Like the website: reopen the learner's latest chat when the app starts, unless they've
  // already started typing or asked for something else meanwhile.
  const untouchedRef = useRef(true);
  untouchedRef.current = messages.length <= 1 && !conversationId && !route.params?.initialPrompt;
  const resumedFor = useRef<string | null>(null);
  useEffect(() => {
    const token = session?.access_token;
    const childId = activeChild?.id;
    if (!token || !childId || isGuest || resumedFor.current === childId) return;
    resumedFor.current = childId;
    void fetchConversations(token, childId).then((list) => {
      if (list.length > 0 && untouchedRef.current) void handleSelectConversation(list[0].id);
    });
  }, [session?.access_token, activeChild?.id, isGuest]);

  const handleNewChat = () => {
    voiceService.stopPlayback();
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

  const handleSelectConversation = async (selectedConvId: string) => {
    if (!session?.access_token || !activeChild?.id) return;
    voiceService.stopPlayback();
    setIsLoading(true);
    try {
      const pastMessages = await fetchConversationMessages(
        session.access_token,
        activeChild.id,
        selectedConvId
      );
      if (pastMessages && pastMessages.length > 0) {
        const formatted: ChatMessage[] = pastMessages.map((m) => ({
          id: m.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          sender: m.role === 'assistant' ? 'appu' : 'user',
          text: m.text,
          timestamp: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
          status: 'sent',
          audioSource: m.audio_source || undefined,
        }));
        const restored = await restoreLessons(formatted.filter((m) => m.sender === 'appu'));
        formatted.forEach((m, i) => {
          if (m.sender !== 'appu' || i === 0) return;
          const prev = formatted[i - 1];
          if (restored.has(m.id)) m.lessonState = 'ready';
          else if (prev.sender === 'user') {
            m.lessonState = 'missing';
            m.lessonQuestion = prev.text;
          }
        });
        setMessages(formatted);
      } else {
        setMessages([
          {
            id: `welcome_${Date.now()}`,
            sender: 'appu',
            text: t('chat.emptyState'),
            timestamp: Date.now(),
            status: 'sent',
          },
        ]);
      }
      setConversationId(selectedConvId);
      setIsNewConversation(false);
    } catch (err) {
      console.warn('[Chat] Failed to load conversation messages:', err);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleSendMessage = async (textToSend?: string, docOverride?: NotesDocument) => {
    const imageToSend = textToSend === undefined ? pendingImage : null;
    const docToUse = docOverride || activeDoc;
    const messageContent =
      (textToSend ?? inputText).trim() || (imageToSend ? 'Please help me with this photo.' : '');
    if (!messageContent || isLoading) return;
    lastInputAt.current = Date.now();

    if (isAuthRequired) {
      navigation.navigate('Auth', {
        initialPrompt: messageContent,
        returnTo: 'Chat',
      });
      return;
    }

    if (isProfileRequired) {
      navigation.navigate('ParentZone', {
        tab: activeChild ? 'personalization' : 'learners',
        initialPrompt: messageContent,
        returnToChat: true,
        promptSetupRequired: true,
      });
      return;
    }

    if (isFeedbackGated) {
      setIsFeedbackGateModalVisible(true);
      return;
    }

    setInputText('');

    // Count authed chat if not already unlocked
    const userId = session?.user?.id;
    if (!isGuest && session?.access_token && !feedbackUnlocked && userId) {
      void incrementAuthedChatCount(userId).then((nextCount) => {
        setAuthedChatCount(nextCount);
      });
    }

    const userMessageId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const userMsg: ChatMessage = {
      id: userMessageId,
      sender: 'user',
      text: messageContent,
      timestamp: Date.now(),
      status: 'sending',
      imageUri: imageToSend?.uri,
    };
    if (imageToSend) setPendingImage(null);

    setMessages((prev) => [...prev, userMsg]);
    useProgressStore.getState().record('questions');
    liveVoice.awaitingAnswer = true;
    setIsLoading(true);

    try {
      const resolvedChildId = !isGuest
        ? (activeChildId || activeChild?.id || (children && children.length > 0 ? children[0].id : undefined))
        : undefined;

      // With notes active, Appu teaches only from the learner's notes (n8n Notes Tutor).
      if (docToUse) {
        const msgId = `appu_notes_${Date.now()}`;
        const result = await askNotesTutor({
          id: msgId,
          question: messageContent,
          doc: docToUse,
          grade: gradeFromBand(activeChild?.gradeBand),
          language: (currentLanguage as string) || 'en',
        });
        setMessages((prev) => prev.map((m) => (m.id === userMessageId ? { ...m, status: 'sent' } : m)));
        if (result?.lesson && result.answer) void rememberLesson(result.answer, result.lesson);
        const answer =
          result?.answer ||
          "I couldn't read your notes just now. Please try asking again in a moment.";
        setMessages((prev) => [
          ...prev.map((m) => (m.quickReplies ? { ...m, quickReplies: undefined } : m)),
          {
            id: msgId,
            sender: 'appu',
            text: answer,
            timestamp: Date.now(),
            status: 'sent',
            audioSource: result?.audioUri || null,
            lessonState: result?.lesson ? 'ready' : 'none',
            lessonTopic: result?.lesson?.topic,
            quickReplies: result && !result.blocked ? ['Quiz me on my notes', 'Explain it more simply', 'What are the key points?'] : undefined,
          },
        ]);
        if (result?.audioUri && (useSettingsStore.getState().autoSpeak || liveModeRef.current)) {
          voiceService.playAppuVoice({
            audioSource: result.audioUri,
            text: answer,
            onStart: () => setPlayingMessageId(msgId),
            onFinish: () => setPlayingMessageId(null),
            onError: () => setPlayingMessageId(null),
          });
        }
        return;
      }

      const response = await sendAppuMessage({
        message: messageContent,
        language: (currentLanguage as 'en' | 'kn' | 'hi') || 'en',
        includeAudio: true,
        accessToken: session?.access_token,
        childId: resolvedChildId,
        guestToken: isGuest ? guestToken || undefined : undefined,
        conversationId,
        newConversation: isNewConversation,
        imageBase64: imageToSend?.dataUrl,
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
      const isLimitReached =
        Boolean(response.loginRequired) ||
        response.code === 'GUEST_LIMIT_REACHED' ||
        (isGuest &&
          ((response.guest && response.guest.remaining <= 0) ||
            (response.guestSession && response.guestSession.remaining <= 0)));

      if (isLimitReached) {
        updateGuestQuota(0);
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
        const replyText = response.text || '';

        if (replyText) {
          const msgId = response.requestId || `appu_${Date.now()}`;
          const newMsg: ChatMessage = {
            id: msgId,
            sender: 'appu',
            text: replyText,
            timestamp: Date.now(),
            status: 'sent',
            audioStreamUrl: response.audioStreamUrl,
            audioSource: response.audioSource,
            quickReplies: Array.isArray(response.quickReplies) && response.quickReplies.length >= 2
              ? response.quickReplies
              : ['Give me a hint', 'Show an example', 'Quiz me on this'],
            lessonState: 'loading',
          };
          // Build the study lesson (mind map, quiz, flashcards, diagram) for this answer.
          void fetchStudyLesson({
            id: msgId,
            question: messageContent,
            answer: replyText,
            grade: gradeFromBand(activeChild?.gradeBand),
            language: (currentLanguage as string) || 'en',
          }).then((lesson) => {
            if (lesson) void rememberLesson(replyText, lesson);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId
                  ? { ...m, lessonState: lesson ? 'ready' : 'none', lessonTopic: lesson?.topic }
                  : m
              )
            );
          });
          setMessages((prev) => [
            ...prev.map((m) => (m.quickReplies ? { ...m, quickReplies: undefined } : m)),
            newMsg,
          ]);

          // Auto-speak if enabled in settings
          const autoSpeak = useSettingsStore.getState().autoSpeak;
          if (autoSpeak || liveModeRef.current) {
            voiceService.playAppuVoice({
              audioStreamUrl: response.audioStreamUrl,
              audioSource: response.audioSource,
              text: replyText,
              language: (currentLanguage as 'en' | 'kn' | 'hi') || 'en',
              accessToken: session?.access_token,
              guestToken: guestToken || undefined,
              onStart: () => setPlayingMessageId(msgId),
              onFinish: () => setPlayingMessageId(null),
              onError: () => setPlayingMessageId(null),
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('[Chat] Send failed:', err);
      // Mark user message as error
      setMessages((prev) =>
        prev.map((m) => (m.id === userMessageId ? { ...m, status: 'error' } : m))
      );
    } finally {
      liveVoice.awaitingAnswer = false;
      setIsLoading(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleRetry = (msg: ChatMessage) => {
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    handleSendMessage(msg.text);
  };

  const handlePlayAppuAudio = (item: ChatMessage) => {
    if (playingMessageId === item.id) {
      voiceService.stopPlayback();
      setPlayingMessageId(null);
      return;
    }

    setPlayingMessageId(item.id);
    voiceService.playAppuVoice({
      text: item.text,
      audioStreamUrl: item.audioStreamUrl,
      audioSource: item.audioSource,
      language: (currentLanguage as 'en' | 'kn' | 'hi') || 'en',
      accessToken: session?.access_token,
      guestToken: isGuest ? guestToken : undefined,
      onFinish: () => {
        setPlayingMessageId(null);
      },
      onError: () => {
        setPlayingMessageId(null);
      },
    });
  };

  const handleShareWhatsApp = (text: string) => {
    const url = buildWhatsAppShareUrl(undefined, text, activeChild?.preferredName);
    Linking.openURL(url).catch((err) =>
      console.warn('[Chat] Failed to open WhatsApp:', err)
    );
  };

  const handleShareAnswer = (text: string) => {
    Share.share({ message: `${text}\n\n— from Appu, my AI learning friend (appuai.online)` }).catch(() => {});
  };

  const handleAttach = async (choice: AttachChoice) => {
    try {
      if (choice === 'file') {
        setIsReadingFile(true);
        const picked = await pickNotesFile();
        setIsReadingFile(false);
        if (!picked) return;
        if (picked.kind === 'image') {
          setPendingImage(picked.image);
          return;
        }
        startNotes(picked.doc);
        return;
      }
      const photo = await pickPhoto(choice);
      if (photo) setPendingImage(photo);
    } catch (err: any) {
      setIsReadingFile(false);
      Alert.alert('Appu', err?.message || 'That file could not be opened.');
    }
  };

  const startNotes = (doc: NotesDocument) => {
    setActiveDoc(doc);
    addMarker(`📄 Learning from your notes: ${doc.name}`);
    void handleSendMessage('Teach me the key ideas from my notes.', doc);
  };

  // Same checks as typing: sign-in, learner profile and the parent feedback gate.
  const voiceAllowed = () => {
    if (isAuthRequired) {
      navigation.navigate('Auth', { returnTo: 'Chat' });
      return false;
    }
    if (isProfileRequired) {
      navigation.navigate('ParentZone', {
        tab: activeChild ? 'personalization' : 'learners',
        returnToChat: true,
        promptSetupRequired: true,
      });
      return false;
    }
    if (isFeedbackGated) {
      setIsFeedbackGateModalVisible(true);
      return false;
    }
    return true;
  };

  // Live callbacks run long after this render, so they call the latest send function.
  const sendRef = useRef(handleSendMessage);
  sendRef.current = handleSendMessage;

  const addMarker = (text: string) =>
    setMessages((prev) => [
      ...prev,
      { id: `sys_${Date.now()}`, sender: 'appu', text, timestamp: Date.now(), status: 'sent', isSystem: true },
    ]);

  const liveCallbacks = {
    onPartial: (text: string) => {
      if (liveModeRef.current === 'mic') setInputText(text);
      else setHeard(text);
    },
    onFinal: (text: string) => {
      setHeard(text);
      setInputText('');
      void sendRef.current(text);
    },
    onBargeIn: () => setPlayingMessageId(null),
    onStopped: (reason: 'user' | 'blocked') => {
      setLiveMode(null);
      if (reason === 'blocked') {
        addMarker('🎙️ Microphone is blocked. Allow it in your phone settings to talk to Appu.');
      }
    },
  };

  // Mic button: always-on voice typing until tapped again. Each sentence is sent like typed text.
  const toggleMic = async () => {
    if (liveMode === 'mic') {
      liveVoice.stop();
      setLiveMode(null);
      setInputText('');
      return;
    }
    if (!voiceAllowed()) return;
    voiceService.stopPlayback();
    setPlayingMessageId(null);
    const ok = await liveVoice.start('mic', currentLanguage || 'en', liveCallbacks);
    if (ok) setLiveMode('mic');
  };

  // Phone button: full-screen hands-free call. Start and end are noted in the chat.
  const startCall = async () => {
    if (!voiceAllowed()) return;
    voiceService.stopPlayback();
    setPlayingMessageId(null);
    setHeard('');
    const ok = await liveVoice.start('call', currentLanguage || 'en', liveCallbacks);
    if (!ok) return;
    setCallStartedAt(Date.now());
    setLiveMode('call');
    addMarker('📞 Voice call started');
  };

  const endCall = () => {
    liveVoice.stop();
    voiceService.stopPlayback();
    setPlayingMessageId(null);
    setLiveMode(null);
    const secs = Math.max(0, Math.round((Date.now() - callStartedAt) / 1000));
    addMarker(`📞 Voice call ended · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
  };

  useEffect(() => {
    liveVoice.setLanguage(currentLanguage || 'en');
  }, [currentLanguage]);

  useEffect(() => () => liveVoice.stop('user', false), []);

  const settingsReady = useSettingsStore((st) => st.isInitialized);
  const tourDone = useSettingsStore((st) => st.onboardingCompleted);
  useEffect(() => {
    void useSettingsStore.getState().initialize();
  }, []);
  const tourRequested = route.params?.startTour;
  useEffect(() => {
    if (!tourRequested) return;
    navigation.setParams({ startTour: undefined } as never);
    openTour();
  }, [tourRequested]);
  // First visit: show the tour once the learner can actually use the chat.
  useEffect(() => {
    if (settingsReady && !tourDone && !isAuthRequired && !isProfileRequired && !isFeedbackGated) openTour();
  }, [settingsReady, tourDone, isAuthRequired, isProfileRequired, isFeedbackGated]);

  // While there is something to send, the mic and call buttons make room for Send.
  const hasDraft = Boolean(inputText.trim() || pendingImage || isLoading);

  const callState: CallState = playingMessageId ? 'speaking' : isLoading ? 'thinking' : 'listening';

  const handleDrawerAction = (action: DrawerAction) => {
    switch (action) {
      case 'newChat':
        return handleNewChat();
      case 'recent':
        if (isGuest || !session) return navigation.navigate('Auth', { returnTo: 'Chat' });
        return setIsHistoryModalVisible(true);
      case 'myLearning':
        return navigation.navigate('MyLearning');
      case 'achievements':
        return setIsAchievementsOpen(true);
      case 'explorePrompts':
        return setIsExploreOpen(true);
      case 'parentZone':
        if (isGuest || !session) return navigation.navigate('Auth', { returnTo: 'ParentZone' });
        return navigation.navigate('ParentZone');
      case 'reports':
        if (isGuest || !session) return navigation.navigate('Auth', { returnTo: 'ParentZone' });
        return navigation.navigate('ParentZone', { tab: 'reports' });
      case 'studySchedule':
        return navigation.navigate('StudySchedule');
      case 'settings':
        return navigation.navigate('Settings');
      case 'tour':
        return openTour();
      case 'legal':
        return navigation.navigate('Legal');
      case 'signIn':
        return navigation.navigate('Auth', { returnTo: 'Chat' });
      case 'signOut':
        handleNewChat();
        void useAuthStore.getState().signOut();
        return;
    }
  };

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
              <Text style={styles.gateButtonText}>{t('auth.signInTab')} / {t('auth.createAccountTab')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.n_plansBtn}
              onPress={() => navigation.navigate('Legal', { initialTab: 'pricing' })}
              activeOpacity={0.8}
            >
              <Text style={styles.n_plansText}>See plans</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const isUser = item.sender === 'user';
    const isPlaying = playingMessageId === item.id;
    if (item.id.startsWith('welcome')) return null; // the greeting replaces the welcome bubble
    if (item.isBrainBreak) {
      return <BrainBreakCard language={currentLanguage || 'en'} grade={Number(gradeFromBand(activeChild?.gradeBand))} />;
    }
    if (item.isSystem) {
      return (
        <View style={styles.n_system}>
          <Text style={styles.n_systemText}>{item.text}</Text>
        </View>
      );
    }

    if (isUser) {
      return (
        <View style={styles.n_userRow}>
          <View style={[styles.n_userBubble, item.status === 'error' && styles.bubbleError]}>
            {item.imageUri ? <Image source={{ uri: item.imageUri }} style={styles.n_userPhoto} resizeMode="cover" /> : null}
            <Text noTranslate style={styles.n_userText}>{item.text}</Text>
          </View>
          {item.status === 'error' && (
            <TouchableOpacity style={styles.retryBtn} onPress={() => handleRetry(item)}>
              <Text style={styles.retryText}>⚠️ {t('chat.retry')}</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    const lesson = item.lessonState === 'ready' ? getLesson(item.id) : null;
    const saved = lesson ? savedLessons.isSaved(lesson.id) : false;
    return (
      <View style={styles.n_appuTurn}>
        <View style={styles.n_appuHead}>
          <Text style={styles.n_appuName}>Appu</Text>
        </View>
        <View style={styles.n_appuBubble}>
          <Text noTranslate style={styles.n_appuText}>{item.text}</Text>
        </View>
        <View style={styles.n_actions}>
          <TouchableOpacity style={[styles.n_action, styles.n_listen]} onPress={() => handlePlayAppuAudio(item)} accessibilityLabel="Listen">
            <Text style={[styles.n_actionText, styles.n_listenText]}>{isPlaying ? '⏸ Stop' : '🔊 Listen'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.n_action} onPress={() => handleShareAnswer(item.text)} accessibilityLabel="Share">
            <Text style={styles.n_actionText}>↗ Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.n_action} onPress={() => handleShareWhatsApp(item.text)} accessibilityLabel="Send on WhatsApp">
            <Text style={styles.n_actionText}>💬 WhatsApp</Text>
          </TouchableOpacity>
          {lesson && (
            <TouchableOpacity
              style={[styles.n_action, saved && styles.n_actionOn]}
              onPress={() => (saved ? savedLessons.remove(lesson.id) : savedLessons.save(lesson))}
              accessibilityLabel={saved ? 'Remove from My Learning' : 'Save lesson'}
            >
              <Text style={styles.n_actionText}>{saved ? '✓ Saved' : '☆ Save lesson'}</Text>
            </TouchableOpacity>
          )}
        </View>
        {item.lessonState === 'missing' && (
          <TouchableOpacity style={styles.n_drawBtn} onPress={() => drawPictures(item)} accessibilityLabel="Show pictures for this answer">
            <Text style={styles.n_drawText}>🎨 Show pictures, mind map and quiz</Text>
          </TouchableOpacity>
        )}
        {item.lessonState === 'loading' && (
          <View style={styles.lessonPending}>
            <ActivityIndicator size="small" color={theme.colors.cyan} />
            <Text style={styles.lessonPendingText}>🎨 Appu is drawing pictures for this…</Text>
          </View>
        )}
        {lesson && (
          <View style={styles.n_lesson}>
            <StudyModes lesson={lesson} />
          </View>
        )}
        {Array.isArray(item.quickReplies) && item.quickReplies.length >= 2 && (
          <View style={styles.n_replies}>
            {item.quickReplies.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={styles.n_chip}
                disabled={isLoading}
                onPress={() => handleSendMessage(opt)}
                activeOpacity={0.75}
              >
                <Text style={styles.n_chipText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.container}
      >
        {/* Slim top bar (website phone layout): menu, progress, new chat */}
        <View style={styles.n_topbar}>
          <TouchableOpacity ref={tourTargets.menu} style={styles.n_iconBtn} onPress={() => setIsDrawerOpen(true)} accessibilityLabel="Open menu">
            <Text style={styles.n_menuIcon}>☰</Text>
          </TouchableOpacity>
          <View style={styles.n_topCenter}>
            <Text style={styles.n_brand}>Appu</Text>
            <Text style={styles.n_status} numberOfLines={1}>
              {activeChild
                ? `${activeChild.preferredName} · Class ${gradeFromBand(activeChild.gradeBand)}`
                : isGuest
                ? guestRemainingQuota > 0
                  ? `${guestRemainingQuota} free chats left`
                  : 'Free chats used'
                : isAuthRequired
                ? 'Sign in to chat'
                : 'Your AI learning mentor'}
            </Text>
          </View>
          <TouchableOpacity ref={tourTargets.progress} style={styles.n_progress} onPress={() => setIsAchievementsOpen(true)} accessibilityLabel="My progress">
            <Text style={styles.n_progressText}>🔥 {streak}</Text>
            <Text style={styles.n_progressText}>⭐ {xp}</Text>
          </TouchableOpacity>
          <TouchableOpacity ref={tourTargets.newChat} style={styles.n_iconBtn} onPress={handleNewChat} accessibilityLabel="New chat">
            <Text style={styles.n_menuIcon}>✏️</Text>
          </TouchableOpacity>
        </View>
        <XpToast />

        {/* Message List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messageListContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            isProfileRequired ? (
              <View style={styles.profileNoticeCard}>
                <Text style={styles.profileNoticeTitle}>✦ Set Up Learner Profile</Text>
                <Text style={styles.profileNoticeDesc}>
                  Appu personalizes explanations to your child's class and learning style.
                </Text>
                <TouchableOpacity
                  style={styles.profileNoticeBtn}
                  onPress={() =>
                    navigation.navigate('ParentZone', {
                      tab: activeChild ? 'personalization' : 'learners',
                      returnToChat: true,
                      promptSetupRequired: true,
                    })
                  }
                  activeOpacity={0.8}
                >
                  <Text style={styles.profileNoticeBtnText}>Configure in Parent Zone →</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          ListFooterComponent={
            <>
              {isLoading && <TypingIndicator label={t('chat.thinking')} />}
              {messages.length === 1 && !isLoading && (
                <View style={styles.n_greeting}>
                  <View style={styles.n_beta}>
                    <Text style={styles.n_betaText}>Free Beta</Text>
                  </View>
                  <Text style={styles.n_hi}>
                    {activeChild ? `Hi ${activeChild.preferredName}!` : "Hi! I'm Appu."}
                  </Text>
                  <Text style={styles.n_question}>What shall we learn today?</Text>
                  <Text style={styles.n_sub}>Ask anything from Class 5–12. I'll explain it your way.</Text>
                  <View ref={tourTargets.missions} collapsable={false} style={styles.n_tiles}>
                    {MISSIONS.map((m, i) => (
                      <TouchableOpacity
                        key={m.title}
                        style={[styles.n_tile, { backgroundColor: TILE_COLORS[i % TILE_COLORS.length] }]}
                        onPress={() => handleSendMessage(m.prompt)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.n_tileIcon}>{m.icon}</Text>
                        <Text style={styles.n_tileText}>{m.title}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {!isAuthRequired && !isProfileRequired && !isFeedbackGated && (
                    <TouchableOpacity style={styles.n_talkBig} onPress={startCall} activeOpacity={0.85} accessibilityLabel="Talk to Appu">
                      <Text style={styles.n_talkBigText}>📞  Talk to Appu</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          }
        />

        {/* Bottom Input or Auth/Profile Gate Banner */}
        {isAuthRequired ? (
          <View style={styles.exhaustedBar}>
            <Text style={styles.exhaustedText}>
              {isGuest
                ? "✦ You've used your 5 free chats. Sign in to continue with unlimited learning!"
                : '🔒 Sign in required to chat with Appu (Free Beta)'}
            </Text>
            <TouchableOpacity
              style={styles.signInBarBtn}
              onPress={() => navigation.navigate('Auth', { returnTo: 'Chat' })}
              activeOpacity={0.8}
            >
              <Text style={styles.signInBarBtnText}>
                {t('auth.signInTab')} / {t('auth.createAccountTab')} →
              </Text>
            </TouchableOpacity>
          </View>
        ) : isProfileRequired ? (
          <View style={styles.exhaustedBar}>
            <Text style={styles.exhaustedText}>
              ✦ Set up learner profile to start chatting
            </Text>
            <TouchableOpacity
              style={styles.signInBarBtn}
              onPress={() =>
                navigation.navigate('ParentZone', {
                  tab: activeChild ? 'personalization' : 'learners',
                  returnToChat: true,
                  promptSetupRequired: true,
                })
              }
              activeOpacity={0.8}
            >
              <Text style={styles.signInBarBtnText}>
                Configure in Parent Zone →
              </Text>
            </TouchableOpacity>
          </View>
        ) : isFeedbackGated ? (
          <View style={styles.exhaustedBar}>
            <Text style={styles.exhaustedText}>
              🔒 {t('chat.feedbackGateNote')}
            </Text>
            <TouchableOpacity
              style={styles.signInBarBtn}
              onPress={() => setIsFeedbackGateModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.signInBarBtnText}>
                {t('parent.giveFeedbackBtn')} →
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputContainer}>
            {isGuest && guestRemainingQuota > 0 && (
              <View style={styles.guestReminderBar}>
                <Text style={styles.guestReminderText}>
                  ✦ {guestRemainingQuota} complimentary {guestRemainingQuota === 1 ? 'chat' : 'chats'} remaining ·{' '}
                  <Text
                    style={styles.guestReminderLink}
                    onPress={() => navigation.navigate('Auth', { returnTo: 'Chat' })}
                  >
                    Sign in to save history
                  </Text>
                </Text>
              </View>
            )}
            <View ref={tourTargets.input} collapsable={false} style={styles.n_composer}>
              {(pendingImage || activeDoc || isReadingFile) && (
                <View style={styles.n_attachRow}>
                  {isReadingFile && (
                    <View style={styles.n_attachChip}>
                      <ActivityIndicator size="small" color={theme.colors.cyan} />
                      <Text style={styles.n_attachText}>Reading your notes…</Text>
                    </View>
                  )}
                  {pendingImage && (
                    <View style={styles.n_attachChip}>
                      <Image source={{ uri: pendingImage.uri }} style={styles.n_attachThumb} />
                      <Text style={styles.n_attachText}>Photo ready</Text>
                      <TouchableOpacity onPress={() => setPendingImage(null)} style={styles.n_attachX} accessibilityLabel="Remove photo">
                        <Text style={styles.n_attachXText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {activeDoc && (
                    <View style={styles.n_attachChip}>
                      <Text style={styles.n_attachText} numberOfLines={1}>📄 {activeDoc.name}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setActiveDoc(null);
                          addMarker('📄 Stopped using your notes');
                        }}
                        style={styles.n_attachX}
                        accessibilityLabel="Stop using these notes"
                      >
                        <Text style={styles.n_attachXText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
              <View style={styles.n_composerRow}>
                <TouchableOpacity ref={tourTargets.attach} style={styles.n_roundBtn} onPress={() => setIsAttachOpen(true)} accessibilityLabel="Add a photo or notes">
                  <Text style={styles.n_plus}>＋</Text>
                </TouchableOpacity>
                <TextInput
                style={styles.n_input}
                placeholder={liveMode === 'mic' ? 'Listening… speak your question' : 'Ask Appu anything…'}
                placeholderTextColor={theme.colors.textMuted}
                value={inputText}
                onChangeText={(v) => {
                  lastInputAt.current = Date.now();
                  setInputText(v);
                }}
                multiline
                maxLength={2000}
                editable={!isLoading}
              />
                {hasDraft ? null : (
                <TouchableOpacity ref={tourTargets.mic} style={[styles.n_roundBtn, liveMode === 'mic' && styles.n_micOn]} onPress={toggleMic} accessibilityLabel={liveMode === 'mic' ? 'Turn the mic off' : 'Speak to Appu'} accessibilityState={{ selected: liveMode === 'mic' }}>
                  <Text style={styles.n_roundIcon}>🎙️</Text>
                </TouchableOpacity>
                )}
                {hasDraft ? (
                <TouchableOpacity
                  style={[styles.n_send, ((!inputText.trim() && !pendingImage) || isLoading) && styles.n_sendOff]}
                  onPress={() => handleSendMessage()}
                  disabled={(!inputText.trim() && !pendingImage) || isLoading}
                  accessibilityLabel="Send"
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={tc('#04121f', 't')} />
                  ) : (
                    <Text style={styles.n_sendIcon}>↑</Text>
                  )}
                </TouchableOpacity>
                ) : (
                <TouchableOpacity ref={tourTargets.call} style={[styles.n_roundBtn, styles.n_callBtn]} onPress={startCall} accessibilityLabel="Start a voice call with Appu">
                  <Text style={styles.n_roundIcon}>📞</Text>
                </TouchableOpacity>
                )}
              </View>
              {liveMode === 'mic' && <Text style={styles.n_micHint}>🎙️ Listening… tap the mic again to stop</Text>}
            </View>
          </View>
        )}

        <CallScreen
          visible={liveMode === 'call'}
          state={callState}
          heard={heard}
          startedAt={callStartedAt}
          onInterrupt={() => {
            voiceService.stopPlayback();
            setPlayingMessageId(null);
            liveVoice.resume();
          }}
          onEnd={endCall}
        />

        {/* Chat History Modal */}
        <RecentChatsModal
          visible={isHistoryModalVisible}
          onClose={() => setIsHistoryModalVisible(false)}
          onSelectConversation={handleSelectConversation}
          onNewChat={handleNewChat}
          currentConversationId={conversationId}
          accessToken={session?.access_token}
          childId={activeChild?.id}
        />

        <SideDrawer
          visible={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onAction={handleDrawerAction}
          onMission={(prompt) => handleSendMessage(prompt)}
        />
        <AttachSheet
          visible={isAttachOpen}
          onClose={() => setIsAttachOpen(false)}
          onChoose={(choice) => void handleAttach(choice)}
          onPasteNotes={(text) => startNotes({ name: 'Pasted notes', text })}
        />
        <ParentalLock
          accessToken={!isGuest ? session?.access_token : null}
          childId={!isGuest ? activeChild?.id : null}
          onAddPhone={() => navigation.navigate('ParentZone', { tab: 'personalization' })}
        />
        <AchievementsModal visible={isAchievementsOpen} onClose={() => setIsAchievementsOpen(false)} />
        <ExplorePromptsModal
          visible={isExploreOpen}
          onClose={() => setIsExploreOpen(false)}
          onSelectPrompt={(prompt) => {
            setIsExploreOpen(false);
            handleSendMessage(prompt);
          }}
        />
        <SpotlightTour
          visible={isTourOpen}
          targets={tourTargets}
          onClose={() => {
            setIsTourOpen(false);
            void useSettingsStore.getState().setOnboardingCompleted(true);
          }}
        />

        {/* Parent Feedback Gate Modal (after 12 chats, dismissible with snooze) */}
        <ParentFeedbackGateModal
          visible={isFeedbackGateModalVisible}
          accessToken={session?.access_token}
          userId={session?.user?.id}
          onFeedbackSubmitted={() => {
            setFeedbackUnlocked(true);
            setIsFeedbackGateModalVisible(false);
          }}
          onDismiss={() => {
            const uid = session?.user?.id;
            void snoozeAuthedChatCount(uid).then((newCount) => {
              setAuthedChatCount(newCount);
              setIsFeedbackGateModalVisible(false);
            });
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  n_topbar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  n_iconBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  n_menuIcon: { color: theme.colors.text, fontSize: 22 },
  n_topCenter: { flex: 1 },
  n_brand: { color: theme.colors.text, fontSize: 18, fontFamily: theme.fonts.heading },
  n_status: { color: theme.colors.textMuted, fontSize: 12, fontFamily: theme.fonts.body },
  n_progress: { flexDirection: 'row', gap: 8, minHeight: 44, alignItems: 'center', paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.line },
  n_progressText: { color: theme.colors.text, fontSize: 14, fontFamily: theme.fonts.bodyBold },
  n_greeting: { paddingTop: 36, paddingHorizontal: 4, gap: 8 },
  n_hi: { color: theme.colors.cyanSoft, fontSize: 18, fontFamily: theme.fonts.bodyBold },
  n_question: { color: theme.colors.text, fontSize: 30, lineHeight: 36, fontFamily: theme.fonts.heading },
  n_sub: { color: theme.colors.textMuted, fontSize: 15, fontFamily: theme.fonts.body, marginBottom: 12 },
  n_userRow: { alignItems: 'flex-end', marginVertical: 8 },
  n_userBubble: { maxWidth: '85%', backgroundColor: theme.colors.userBubble, borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  n_userText: { color: theme.colors.text, fontSize: 16, lineHeight: 22, fontFamily: theme.fonts.body },
  n_appuTurn: { marginVertical: 10, gap: 8 },
  n_appuHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  n_appuName: { color: theme.colors.cyanSoft, fontSize: 14, fontFamily: theme.fonts.bodyBold },
  n_appuBubble: { backgroundColor: theme.colors.surface, borderRadius: 20, borderTopLeftRadius: 6, borderWidth: 1, borderColor: theme.colors.line, paddingHorizontal: 16, paddingVertical: 12 },
  n_appuText: { color: theme.colors.text, fontSize: 17, lineHeight: 26, fontFamily: theme.fonts.body },
  n_listen: { backgroundColor: theme.colors.cyan, borderColor: theme.colors.cyan, paddingHorizontal: 16 },
  n_listenText: { color: tc('#04121f', 't'), fontSize: 15 },
  n_tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  n_tile: { width: '47%', flexGrow: 1, minHeight: 96, borderRadius: 22, padding: 14, justifyContent: 'space-between' },
  n_tileIcon: { fontSize: 30 },
  n_tileText: { color: tc('#0f172a', 't'), fontSize: 16, lineHeight: 20, fontFamily: theme.fonts.heading },
  n_talkBig: { marginTop: 12, minHeight: 56, borderRadius: 999, backgroundColor: tc('#22c55e', 'b'), alignItems: 'center', justifyContent: 'center' },
  n_talkBigText: { color: tc('#04121f', 't'), fontSize: 18, fontFamily: theme.fonts.heading },
  n_micHint: { color: tc('#f87171', 't'), fontSize: 13, fontFamily: theme.fonts.bodyBold, marginTop: 6, textAlign: 'center' },
  n_actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  n_action: { minHeight: 36, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.line, justifyContent: 'center' },
  n_actionOn: { borderColor: theme.colors.cyan, backgroundColor: tc('rgba(14,165,233,0.15)', 'b') },
  n_actionText: { color: theme.colors.textMuted, fontSize: 13, fontFamily: theme.fonts.bodyBold },
  n_lesson: { marginTop: 4 },
  n_drawBtn: { marginTop: 10, alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 16, borderRadius: 999, borderWidth: 2, borderColor: theme.colors.cyan, borderStyle: 'dashed', justifyContent: 'center' },
  n_drawText: { color: theme.colors.cyan, fontSize: 14, fontFamily: theme.fonts.bodyBold },
  n_replies: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  n_chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface },
  n_chipText: { color: theme.colors.text, fontSize: 14, fontFamily: theme.fonts.body },
  n_composer: { marginHorizontal: 10, marginBottom: 8, borderRadius: 28, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, paddingHorizontal: 8, paddingVertical: 8 },
  n_input: { flex: 1, color: theme.colors.text, fontSize: 17, fontFamily: theme.fonts.body, maxHeight: 120, minHeight: 46, paddingVertical: 10 },
  n_composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  n_roundBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.line },
  n_callBtn: { backgroundColor: tc('rgba(34,197,94,0.18)', 'b'), borderColor: tc('rgba(34,197,94,0.6)', 'b') },
  n_roundIcon: { fontSize: 17 },
  n_send: { width: 46, height: 46, borderRadius: 23, backgroundColor: theme.colors.cyan, alignItems: 'center', justifyContent: 'center' },
  n_sendOff: { opacity: 0.4 },
  n_userPhoto: { width: 200, height: 150, borderRadius: 12, marginBottom: 8 },
  n_attachRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  n_attachChip: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%', backgroundColor: theme.colors.bg, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.line, paddingLeft: 8, minHeight: 40 },
  n_attachThumb: { width: 30, height: 30, borderRadius: 6 },
  n_attachText: { color: theme.colors.text, fontSize: 13, fontFamily: theme.fonts.body, flexShrink: 1 },
  n_attachX: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  n_attachXText: { color: theme.colors.textMuted, fontSize: 14 },
  n_plus: { color: theme.colors.text, fontSize: 20 },
  n_plansBtn: { marginTop: 8, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: theme.colors.line },
  n_plansText: { color: theme.colors.cyanSoft, fontSize: 15, fontFamily: theme.fonts.bodyBold },
  n_beta: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, borderColor: theme.colors.cyan, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 4 },
  n_betaText: { color: theme.colors.cyanSoft, fontSize: 12, fontFamily: theme.fonts.bodyBold },
  n_micOn: { backgroundColor: tc('rgba(239,68,68,0.25)', 'b'), borderColor: tc('#ef4444', 'b') },
  n_system: { alignItems: 'center', marginVertical: 8 },
  n_systemText: { color: theme.colors.textMuted, fontSize: 13, fontFamily: theme.fonts.bodyBold, backgroundColor: theme.colors.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, overflow: 'hidden' },
  n_sendIcon: { color: tc('#04121f', 't'), fontSize: 20, fontFamily: theme.fonts.bodyBold },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  container: {
    flex: 1,
  },
  lessonPending: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  lessonPendingText: { color: theme.colors.textMuted, fontSize: 13 },
  messageListContent: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  bubbleError: {
    borderColor: tc('#ef4444', 'b'),
    backgroundColor: tc('#260e15', 'b'),
  },
  retryBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  retryText: {
    fontSize: 12,
    color: tc('#f87171', 't'),
    fontWeight: '700',
  },
  gateCardContainer: {
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  gateCard: {
    backgroundColor: tc('#0d223f', 'b'),
    borderColor: tc('rgba(56, 189, 248, 0.4)', 'b'),
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
    color: tc('#04121f', 't'),
    fontSize: 14,
    fontWeight: '800',
  },
  inputContainer: {
    backgroundColor: tc('#0f1a2e', 'b'),
    borderTopWidth: 1,
    borderTopColor: theme.colors.line,
  },
  guestReminderBar: {
    paddingVertical: 5,
    paddingHorizontal: 16,
    backgroundColor: tc('rgba(56, 189, 248, 0.08)', 'b'),
    borderBottomWidth: 1,
    borderBottomColor: tc('rgba(56, 189, 248, 0.15)', 'b'),
    alignItems: 'center',
  },
  guestReminderText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  guestReminderLink: {
    color: theme.colors.cyanSoft,
    fontWeight: '700',
  },
  exhaustedBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: tc('#0b203d', 'b'),
    borderTopWidth: 1,
    borderTopColor: tc('rgba(245, 158, 11, 0.3)', 'b'),
    alignItems: 'center',
    gap: 10,
  },
  exhaustedText: {
    color: tc('#fef3c7', 't'),
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
    color: tc('#04121f', 't'),
    fontSize: 14,
    fontWeight: '800',
  },
  profileNoticeCard: {
    backgroundColor: tc('#0a1d35', 'b'),
    borderColor: tc('rgba(56, 189, 248, 0.3)', 'b'),
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  profileNoticeTitle: {
    color: theme.colors.cyanSoft,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  profileNoticeDesc: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  profileNoticeBtn: {
    backgroundColor: theme.colors.cyan,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  profileNoticeBtnText: {
    color: tc('#04121f', 't'),
    fontSize: 13,
    fontWeight: '800',
  },
});
