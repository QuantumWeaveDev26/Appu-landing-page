/**
 * Learner model sync (same backend as the website's learning-sync.js): graded lesson answers
 * and the lesson modes a child opens go to POST /api/appu/learning/events. The backend keeps
 * nothing unless a parent switched learning tracking on for that child.
 */
import { config } from '../config';
import { useAuthStore } from '../stores/authStore';

export type LearningEvent = {
  source: 'lesson_quiz' | 'flashcard' | 'mode_open';
  topic: string;
  isCorrect?: boolean;
  mode?: 'see' | 'quiz' | 'cards' | 'diagram' | 'notes' | 'audio' | 'voice' | 'call';
  question?: string;
};

export type LearningProfile = {
  consent: { granted: boolean; decided?: boolean; grantedAt?: string };
  model: {
    gradedAnswers: number;
    recentAccuracy: number | null;
    learnsBestWith: string[];
  } | null;
  topics: { topic: string; attempts: number; correct: number; recent: string; status: string; lastMistake: string | null }[];
};

const FLUSH_MS = 1500;
let queue: LearningEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function signedIn(): { token: string; childId: string } | null {
  const { session, activeChildId, isGuest } = useAuthStore.getState();
  const token = session?.access_token;
  return token && activeChildId && !isGuest ? { token, childId: activeChildId } : null;
}

async function request(path: string, method: string, token: string, body?: object): Promise<any | null> {
  try {
    const res = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.ok ? await res.json().catch(() => ({})) : null;
  } catch {
    return null;
  }
}

export async function flushLearning(): Promise<void> {
  timer = null;
  const who = signedIn();
  const events = queue.splice(0, 20);
  if (!who || !events.length) return;
  await request('/api/appu/learning/events', 'POST', who.token, { childId: who.childId, events });
  if (queue.length) timer = setTimeout(flushLearning, 0);
}

/** Queues one event; sent in a small batch shortly after. Ignored for guests and empty topics. */
export function reportLearning(event: LearningEvent): void {
  const topic = event.topic.trim().slice(0, 120);
  if (!topic || !signedIn()) return;
  queue.push({ ...event, topic, question: event.question?.trim().slice(0, 300) || undefined });
  if (!timer) timer = setTimeout(flushLearning, FLUSH_MS);
}

export function getLearningProfile(childId: string): Promise<LearningProfile | null> {
  const token = useAuthStore.getState().session?.access_token;
  return token ? request(`/api/children/${encodeURIComponent(childId)}/learning`, 'GET', token) : Promise.resolve(null);
}

export async function setLearningConsent(childId: string, granted: boolean): Promise<boolean> {
  const token = useAuthStore.getState().session?.access_token;
  if (!token) return false;
  const res = await request(`/api/children/${encodeURIComponent(childId)}/learning-consent`, 'PUT', token, { granted });
  return Boolean(res);
}
