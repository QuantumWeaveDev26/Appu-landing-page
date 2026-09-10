import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';
import { useLanguage } from '../i18n/useLanguage';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export function ChatScreen({ navigation }: Props) {
  const { t } = useLanguage();
  const [inputText, setInputText] = useState('');

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
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
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t('chat.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('common.statusReady')}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Message body / stub */}
        <View style={styles.messageArea}>
          <View style={styles.appuGreetingBubble}>
            <Text style={styles.appuSender}>{t('common.appTitle')}</Text>
            <Text style={styles.greetingText}>{t('chat.emptyState')}</Text>
          </View>
        </View>

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={theme.colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={() => {}}
            activeOpacity={0.8}
          >
            <Text style={styles.sendBtnText}>➤</Text>
          </TouchableOpacity>
        </View>
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
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: theme.colors.cyan,
    fontSize: 11,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 48,
  },
  messageArea: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appuGreetingBubble: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.lg,
    padding: 18,
    maxWidth: 320,
  },
  appuSender: {
    color: theme.colors.cyan,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  greetingText: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.line,
    backgroundColor: theme.colors.bgElevated,
    gap: 10,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    color: theme.colors.text,
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#00121d',
    fontSize: 16,
    fontWeight: '800',
  },
});
