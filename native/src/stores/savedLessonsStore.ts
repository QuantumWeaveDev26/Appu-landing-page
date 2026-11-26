/** My Learning: lessons the learner saved, kept on the device (website: saved-lessons-ui.js). */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { registerLesson, type StudyLesson } from '../lessons/lessonApi';

const STORAGE_KEY = 'appu_saved_lessons_v1';
const MAX_SAVED = 100;

export interface SavedLesson {
  lesson: StudyLesson;
  savedAt: number;
}

interface Store {
  items: SavedLesson[];
  load: () => Promise<void>;
  isSaved: (id: string) => boolean;
  save: (lesson: StudyLesson) => void;
  remove: (id: string) => void;
}

const persist = (items: SavedLesson[]) =>
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});

export const useSavedLessonsStore = create<Store>((set, get) => ({
  items: [],
  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const items: SavedLesson[] = raw ? JSON.parse(raw) : [];
      items.forEach((i) => registerLesson(i.lesson));
      set({ items });
    } catch {}
  },
  isSaved: (id) => get().items.some((i) => i.lesson.id === id),
  save: (lesson) => {
    if (get().isSaved(lesson.id)) return;
    const items = [{ lesson, savedAt: Date.now() }, ...get().items].slice(0, MAX_SAVED);
    set({ items });
    persist(items);
  },
  remove: (id) => {
    const items = get().items.filter((i) => i.lesson.id !== id);
    set({ items });
    persist(items);
  },
}));
