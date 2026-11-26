/**
 * Real learning progress, same rules as the website (frontend/app.js gamification v2):
 * everything starts at 0 and only grows from what the learner actually does.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = 'appu_gamification_v2';

export type ActivityKind = 'questions' | 'quizCorrect' | 'flashcards' | 'diagrams';

export interface ProgressState {
  xp: number;
  streak: number;
  bestStreak: number;
  lastActiveDay: string | null;
  badges: string[];
  stats: Record<ActivityKind, number>;
}

export const LEVELS = [
  { level: 1, title: 'Seedling Scholar 🌱', minXp: 0, maxXp: 50 },
  { level: 2, title: 'Curious Explorer 🚀', minXp: 50, maxXp: 150 },
  { level: 3, title: 'Brain Booster 💡', minXp: 150, maxXp: 300 },
  { level: 4, title: 'Star Student 🌟', minXp: 300, maxXp: 500 },
  { level: 5, title: 'Master Mind 🏆', minXp: 500, maxXp: 1000 },
];

export const BADGE_RULES: { id: string; icon: string; name: string; rule: string; earned: (s: ProgressState) => boolean }[] = [
  { id: 'curious-mind', icon: '🚀', name: 'Curious Mind', rule: 'Ask Appu your first question', earned: (s) => s.stats.questions >= 1 },
  { id: 'space-cadet', icon: '🪐', name: 'Space Cadet', rule: 'Ask Appu 10 questions', earned: (s) => s.stats.questions >= 10 },
  { id: 'quick-thinker', icon: '⚡', name: 'Quick Thinker', rule: 'Answer 3 quiz questions correctly', earned: (s) => s.stats.quizCorrect >= 3 },
  { id: 'diagram-detective', icon: '🔍', name: 'Diagram Detective', rule: 'Master your first diagram', earned: (s) => s.stats.diagrams >= 1 },
  { id: 'flashcard-pro', icon: '🗂️', name: 'Flashcard Pro', rule: 'Master 10 flashcards', earned: (s) => s.stats.flashcards >= 10 },
  { id: 'on-fire', icon: '🔥', name: 'On Fire', rule: 'Learn 3 days in a row', earned: (s) => s.bestStreak >= 3 },
  { id: 'week-warrior', icon: '🏅', name: 'Week Warrior', rule: 'Learn 7 days in a row', earned: (s) => s.bestStreak >= 7 },
];

export function levelFor(xp: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) if (xp >= LEVELS[i].minXp) return LEVELS[i];
  return LEVELS[0];
}

const localDayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function dayDiff(from: string | null, to: string): number {
  if (!from) return Infinity;
  const [a, b] = [from, to].map((k) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86400000);
}

const empty = (): ProgressState => ({
  xp: 0,
  streak: 0,
  bestStreak: 0,
  lastActiveDay: null,
  badges: [],
  stats: { questions: 0, quizCorrect: 0, flashcards: 0, diagrams: 0 },
});

export interface Toast {
  id: number;
  text: string;
}

interface Store extends ProgressState {
  loaded: boolean;
  toast: Toast | null;
  load: () => Promise<void>;
  /** Counts a real learning action (keeps the daily streak) and optionally awards XP. */
  record: (kind: ActivityKind, xp?: number, reason?: string) => void;
  clearToast: () => void;
}

export const useProgressStore = create<Store>((set, get) => ({
  ...empty(),
  loaded: false,
  toast: null,

  load: async () => {
    let state = empty();
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) state = { ...state, ...JSON.parse(raw) };
    } catch {}
    // A streak only stays alive while the learner was active today or yesterday.
    if (dayDiff(state.lastActiveDay, localDayKey()) > 1) state.streak = 0;
    set({ ...state, loaded: true });
  },

  record: (kind, xp = 0, reason) => {
    const s = get();
    const today = localDayKey();
    const gap = dayDiff(s.lastActiveDay, today);
    const next: ProgressState = {
      xp: s.xp + Math.max(0, Math.floor(xp)),
      streak: gap === 0 ? s.streak : gap === 1 ? s.streak + 1 : 1,
      bestStreak: s.bestStreak,
      lastActiveDay: today,
      badges: s.badges,
      stats: { ...s.stats, [kind]: s.stats[kind] + 1 },
    };
    next.bestStreak = Math.max(next.bestStreak, next.streak);
    const before = new Set(s.badges);
    next.badges = BADGE_RULES.filter((b) => b.earned(next)).map((b) => b.id);
    const newBadge = BADGE_RULES.find((b) => next.badges.includes(b.id) && !before.has(b.id));
    const levelUp = levelFor(next.xp).level > levelFor(s.xp).level;
    const text = newBadge
      ? `${newBadge.icon} Badge unlocked: ${newBadge.name}!`
      : levelUp
      ? `🎉 Level up! ${levelFor(next.xp).title}`
      : xp > 0
      ? `⭐ +${xp} XP · ${reason || 'Great job!'}`
      : null;
    set({ ...next, toast: text ? { id: Date.now(), text } : s.toast });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  },

  clearToast: () => set({ toast: null }),
}));
