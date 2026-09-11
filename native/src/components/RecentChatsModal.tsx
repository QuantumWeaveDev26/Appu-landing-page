import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import {
  fetchConversations,
  deleteConversation,
  type ConversationSummary,
} from '../lib/api';

interface RecentChatsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectConversation: (conversationId: string) => Promise<void> | void;
  onNewChat: () => void;
  currentConversationId?: string | null;
  accessToken?: string | null;
  childId?: string | null;
}

export function RecentChatsModal({
  visible,
  onClose,
  onSelectConversation,
  onNewChat,
  currentConversationId,
  accessToken,
  childId,
}: RecentChatsModalProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadConversations = async () => {
    if (!accessToken || !childId) return;
    setLoading(true);
    try {
      const list = await fetchConversations(accessToken, childId);
      setConversations(list);
    } catch (err) {
      console.warn('[RecentChatsModal] Load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadConversations();
    }
  }, [visible, accessToken, childId]);

  const handleDelete = async (convId: string, title: string) => {
    if (!accessToken || !childId) return;
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete "${title || 'this conversation'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(convId);
            const success = await deleteConversation(accessToken, childId, convId);
            setDeletingId(null);
            if (success) {
              setConversations((prev) => prev.filter((c) => c.id !== convId));
              if (currentConversationId === convId) {
                onNewChat();
              }
            }
          },
        },
      ]
    );
  };

  const formatChatDate = (rawDate?: string | null): string => {
    if (!rawDate) return 'Recent';
    try {
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return 'Recent';

      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHour / 24);

      if (diffSec < 60) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHour < 24 && d.getDate() === now.getDate()) {
        return `${diffHour}h ago`;
      }
      if (diffDays === 1 || (diffHour < 48 && d.getDate() === now.getDate() - 1)) {
        return 'Yesterday';
      }
      if (diffDays < 7) {
        return `${diffDays}d ago`;
      }
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Recent';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.sheetContainer} edges={['bottom']}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerIcon}>🕒</Text>
              <Text style={styles.sheetTitle}>Recent Chats</Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.newChatBtn}
                onPress={() => {
                  onNewChat();
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.newChatBtnText}>+ New</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Body */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={theme.colors.cyan} />
              <Text style={styles.loadingText}>Loading conversation history...</Text>
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>No saved chats yet</Text>
              <Text style={styles.emptySubtitle}>
                Conversations with Appu will appear here so you can continue learning anytime.
              </Text>
              <TouchableOpacity
                style={styles.startChatBtn}
                onPress={() => {
                  onNewChat();
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.startChatBtnText}>Start a New Chat</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isActive = item.id === currentConversationId;
                const isBeingDeleted = deletingId === item.id;

                return (
                  <TouchableOpacity
                    style={[styles.chatCard, isActive && styles.chatCardActive]}
                    onPress={() => {
                      onSelectConversation(item.id);
                      onClose();
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.chatCardBody}>
                      <View style={styles.titleRow}>
                        <Text
                          style={[
                            styles.chatTitle,
                            isActive && styles.chatTitleActive,
                          ]}
                          numberOfLines={1}
                        >
                          {item.title || 'Conversation with Appu'}
                        </Text>
                        {isActive && (
                          <View style={styles.activeBadge}>
                            <Text style={styles.activeBadgeText}>Active</Text>
                          </View>
                        )}
                      </View>

                      {item.lastMessagePreview ? (
                        <Text style={styles.previewText} numberOfLines={1}>
                          {item.lastMessagePreview}
                        </Text>
                      ) : null}

                      <View style={styles.metaRow}>
                        <Text style={styles.dateText}>
                          {formatChatDate(item.updatedAt || item.createdAt || item.updated_at || item.created_at)}
                        </Text>
                        {typeof item.message_count === 'number' && item.message_count > 0 && (
                          <Text style={styles.countText}>
                            · {item.message_count} {item.message_count === 1 ? 'message' : 'messages'}
                          </Text>
                        )}
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(item.id, item.title)}
                      disabled={isBeingDeleted}
                      activeOpacity={0.6}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      {isBeingDeleted ? (
                        <ActivityIndicator size="small" color={theme.colors.textMuted} />
                      ) : (
                        <Text style={styles.deleteBtnText}>🗑️</Text>
                      )}
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
            />
          )}
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
    maxHeight: '80%',
    minHeight: 380,
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 18,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  newChatBtn: {
    backgroundColor: theme.colors.cyan,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  newChatBtnText: {
    color: '#031124',
    fontSize: 13,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#091a32',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  closeBtnText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: 'bold',
  },
  centerContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 280,
  },
  startChatBtn: {
    backgroundColor: theme.colors.cyan,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
  },
  startChatBtnText: {
    color: '#031124',
    fontSize: 14,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#091a32',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
    padding: 14,
  },
  chatCardActive: {
    borderColor: theme.colors.cyan,
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
  },
  chatCardBody: {
    flex: 1,
    marginRight: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  chatTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  chatTitleActive: {
    color: theme.colors.cyanSoft,
  },
  activeBadge: {
    backgroundColor: 'rgba(34, 211, 238, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.cyanSoft,
  },
  previewText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  countText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginLeft: 4,
  },
  deleteBtn: {
    padding: 6,
  },
  deleteBtnText: {
    fontSize: 15,
    opacity: 0.7,
  },
});
