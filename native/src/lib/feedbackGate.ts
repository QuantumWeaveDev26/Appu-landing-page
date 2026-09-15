import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchFamilyFeedback } from './api';

export const FEEDBACK_CHAT_THRESHOLD = 12;
export const AUTHED_CHATS_COUNT_KEY = 'appu_authed_chats';
export const FEEDBACK_UNLOCKED_KEY = 'appu_feedback_unlocked';

/**
 * Returns current count of authenticated chats sent by the parent.
 */
export async function getAuthedChatCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(AUTHED_CHATS_COUNT_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch (err) {
    console.warn('[feedbackGate] Failed to read chat count:', err);
    return 0;
  }
}

/**
 * Increments and returns the updated authenticated chat count.
 */
export async function incrementAuthedChatCount(): Promise<number> {
  try {
    const current = await getAuthedChatCount();
    const next = current + 1;
    await AsyncStorage.setItem(AUTHED_CHATS_COUNT_KEY, String(next));
    return next;
  } catch (err) {
    console.warn('[feedbackGate] Failed to increment chat count:', err);
    return 0;
  }
}

/**
 * Checks if feedback unlock is already cached locally.
 */
export async function isCachedFeedbackUnlocked(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(FEEDBACK_UNLOCKED_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

/**
 * Persists local cache that reports and chat are unlocked.
 */
export async function setCachedFeedbackUnlocked(): Promise<void> {
  try {
    await AsyncStorage.setItem(FEEDBACK_UNLOCKED_KEY, 'true');
  } catch (err) {
    console.warn('[feedbackGate] Failed to cache feedback unlocked:', err);
  }
}

/**
 * Verifies with the backend whether the household has submitted feedback to unlock reports & chat.
 */
export async function checkFeedbackStatus(accessToken: string): Promise<boolean> {
  if (!accessToken) return false;
  try {
    const status = await fetchFamilyFeedback(accessToken);
    if (status.reportsUnlocked) {
      await setCachedFeedbackUnlocked();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[feedbackGate] Failed to fetch feedback status:', err);
    return false;
  }
}
