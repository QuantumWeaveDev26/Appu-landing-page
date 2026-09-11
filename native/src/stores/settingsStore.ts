import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  VOICE_RATE: 'appu_voice_rate',
  VOICE_PITCH: 'appu_voice_pitch',
  AUTO_SPEAK: 'appu_auto_speak',
  SOUND_SFX: 'appu_sound_sfx',
  ONBOARDING_DONE: 'appu_onboarding_completed',
};

export interface SettingsState {
  voiceRate: number;
  voicePitch: number;
  autoSpeak: boolean;
  soundEffects: boolean;
  onboardingCompleted: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  setVoiceRate: (rate: number) => Promise<void>;
  setVoicePitch: (pitch: number) => Promise<void>;
  setAutoSpeak: (enabled: boolean) => Promise<void>;
  setSoundEffects: (enabled: boolean) => Promise<void>;
  setOnboardingCompleted: (completed: boolean) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  voiceRate: 0.95,
  voicePitch: 1.05,
  autoSpeak: true,
  soundEffects: true,
  onboardingCompleted: false,
  isInitialized: false,

  initialize: async () => {
    if (get().isInitialized) return;
    try {
      const [rate, pitch, autoSpeak, soundSfx, onboarding] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.VOICE_RATE),
        AsyncStorage.getItem(STORAGE_KEYS.VOICE_PITCH),
        AsyncStorage.getItem(STORAGE_KEYS.AUTO_SPEAK),
        AsyncStorage.getItem(STORAGE_KEYS.SOUND_SFX),
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_DONE),
      ]);

      set({
        voiceRate: rate !== null ? parseFloat(rate) : 0.95,
        voicePitch: pitch !== null ? parseFloat(pitch) : 1.05,
        autoSpeak: autoSpeak !== null ? autoSpeak === 'true' : true,
        soundEffects: soundSfx !== null ? soundSfx === 'true' : true,
        onboardingCompleted: onboarding === 'true',
        isInitialized: true,
      });
    } catch (e) {
      console.warn('[SettingsStore] Failed to load preferences:', e);
      set({ isInitialized: true });
    }
  },

  setVoiceRate: async (rate: number) => {
    const clamped = Math.max(0.75, Math.min(1.35, Math.round(rate * 100) / 100));
    set({ voiceRate: clamped });
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.VOICE_RATE, String(clamped));
    } catch (e) {
      console.warn('[SettingsStore] Failed to save voiceRate:', e);
    }
  },

  setVoicePitch: async (pitch: number) => {
    const clamped = Math.max(0.85, Math.min(1.25, Math.round(pitch * 100) / 100));
    set({ voicePitch: clamped });
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.VOICE_PITCH, String(clamped));
    } catch (e) {
      console.warn('[SettingsStore] Failed to save voicePitch:', e);
    }
  },

  setAutoSpeak: async (enabled: boolean) => {
    set({ autoSpeak: enabled });
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTO_SPEAK, String(enabled));
    } catch (e) {
      console.warn('[SettingsStore] Failed to save autoSpeak:', e);
    }
  },

  setSoundEffects: async (enabled: boolean) => {
    set({ soundEffects: enabled });
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SOUND_SFX, String(enabled));
    } catch (e) {
      console.warn('[SettingsStore] Failed to save soundEffects:', e);
    }
  },

  setOnboardingCompleted: async (completed: boolean) => {
    set({ onboardingCompleted: completed });
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_DONE, String(completed));
    } catch (e) {
      console.warn('[SettingsStore] Failed to save onboardingCompleted:', e);
    }
  },

  resetToDefaults: async () => {
    set({
      voiceRate: 0.95,
      voicePitch: 1.05,
      autoSpeak: true,
      soundEffects: true,
    });
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.VOICE_RATE, '0.95'),
        AsyncStorage.setItem(STORAGE_KEYS.VOICE_PITCH, '1.05'),
        AsyncStorage.setItem(STORAGE_KEYS.AUTO_SPEAK, 'true'),
        AsyncStorage.setItem(STORAGE_KEYS.SOUND_SFX, 'true'),
      ]);
    } catch (e) {
      console.warn('[SettingsStore] Failed to reset defaults:', e);
    }
  },
}));
