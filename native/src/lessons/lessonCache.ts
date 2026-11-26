/**
 * Keeps each answer's study lesson (pictures, mind map, quiz) on the phone, so a chat reopened
 * from history shows its visuals again. History messages come back from the server with new ids,
 * so lessons are matched by the answer text.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerLesson, type StudyLesson } from './lessonApi';

const STORAGE_KEY = 'appu_answer_lessons_v1';
const MAX_KEPT = 80;

/** Short stable key for an answer's text (whitespace and case don't matter). */
export function answerKey(answer: string): string {
  const s = answer.replace(/\s+/g, ' ').trim().toLowerCase();
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${s.length}_${h.toString(36)}`;
}

type Entry = { key: string; lesson: StudyLesson };

async function readAll(): Promise<Entry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function rememberLesson(answer: string, lesson: StudyLesson): Promise<void> {
  const key = answerKey(answer);
  const next = [{ key, lesson }, ...(await readAll()).filter((e) => e.key !== key)].slice(0, MAX_KEPT);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}

/**
 * Finds the saved lessons for reopened messages and registers each under the message's new id.
 * Returns the ids of messages that now have their lesson back.
 */
export async function restoreLessons(messages: { id: string; text: string }[]): Promise<Set<string>> {
  const byKey = new Map((await readAll()).map((e) => [e.key, e.lesson]));
  const restored = new Set<string>();
  for (const m of messages) {
    const lesson = byKey.get(answerKey(m.text));
    if (!lesson) continue;
    registerLesson({ ...lesson, id: m.id });
    restored.add(m.id);
  }
  return restored;
}
