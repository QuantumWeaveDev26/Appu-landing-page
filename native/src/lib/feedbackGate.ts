import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchFamilyFeedback } from './api';

export const FEEDBACK_CHAT_THRESHOLD = 12;
export const SNOOZE_CHATS = 8;
export const AUTHED_CHATS_COUNT_KEY = 'appu_authed_chats';
export const FEEDBACK_UNLOCKED_KEY = 'appu_feedback_unlocked';

function getChatKey(userId?: string | null): string {
  return userId ? `${AUTHED_CHATS_COUNT_KEY}:${userId}` : AUTHED_CHATS_COUNT_KEY;
}

function getUnlockedKey(userId?: string | null): string {
  return userId ? `${FEEDBACK_UNLOCKED_KEY}:${userId}` : FEEDBACK_UNLOCKED_KEY;
}

/**
 * Returns current count of authenticated chats sent by the parent.
 */
export async function getAuthedChatCount(userId?: string | null): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(getChatKey(userId));
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch (err) {
    console.warn('[feedbackGate] Failed to read chat count:', err);
    return 0;
  }
}

/**
 * Increments and returns the updated authenticated chat count.
 */
export async function incrementAuthedChatCount(userId?: string | null): Promise<number> {
  try {
    const current = await getAuthedChatCount(userId);
    const next = current + 1;
    await AsyncStorage.setItem(getChatKey(userId), String(next));
    return next;
  } catch (err) {
    console.warn('[feedbackGate] Failed to increment chat count:', err);
    return 0;
  }
}

/**
 * Snoozes the feedback gate by setting chat count to threshold - SNOOZE_CHATS (e.g. 12 - 8 = 4).
 * Returns the updated chat count.
 */
export async function snoozeAuthedChatCount(userId?: string | null): Promise<number> {
  try {
    const snoozed = Math.max(0, FEEDBACK_CHAT_THRESHOLD - SNOOZE_CHATS);
    await AsyncStorage.setItem(getChatKey(userId), String(snoozed));
    return snoozed;
  } catch (err) {
    console.warn('[feedbackGate] Failed to snooze chat count:', err);
    return 0;
  }
}

/**
 * Checks if feedback unlock is already cached locally.
 */
export async function isCachedFeedbackUnlocked(userId?: string | null): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(getUnlockedKey(userId));
    return val === 'true';
  } catch {
    return false;
  }
}

/**
 * Persists local cache that reports and chat are unlocked.
 */
export async function setCachedFeedbackUnlocked(userId?: string | null): Promise<void> {
  try {
    await AsyncStorage.setItem(getUnlockedKey(userId), 'true');
  } catch (err) {
    console.warn('[feedbackGate] Failed to cache feedback unlocked:', err);
  }
}

/**
 * Verifies with the backend whether the household has submitted feedback to unlock reports & chat.
 */
export async function checkFeedbackStatus(accessToken: string, userId?: string | null): Promise<boolean> {
  if (!accessToken) return false;
  try {
    const status = await fetchFamilyFeedback(accessToken);
    if (status.reportsUnlocked) {
      await setCachedFeedbackUnlocked(userId);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[feedbackGate] Failed to fetch feedback status:', err);
    return false;
  }
}
