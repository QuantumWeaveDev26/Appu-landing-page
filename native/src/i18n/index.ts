import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { en } from './resources/en';
import { kn } from './resources/kn';
import { hi } from './resources/hi';

export const LANGUAGE_STORAGE_KEY = 'appu_lang';

export const resources = {
  en: { translation: en },
  kn: { translation: kn },
  hi: { translation: hi },
} as const;

export type SupportedLanguage = keyof typeof resources;
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'kn', 'hi'];

/**
 * Resolves the initial language based on:
 * 1. Stored preference in AsyncStorage (handled post-init)
 * 2. Device primary locale matching supported languages
 * 3. Default fallback to 'en'
 */
export function getDeviceLanguage(): SupportedLanguage {
  try {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
      const langCode = locales[0].languageCode?.toLowerCase();
      if (langCode === 'kn') return 'kn';
      if (langCode === 'hi') return 'hi';
    }
  } catch {
    // Fail safe to English
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React handles XSS safely
  },
  compatibilityJSON: 'v4',
});

// Asynchronously load stored language preference if exists
AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
  .then((stored) => {
    if (stored && (stored === 'en' || stored === 'kn' || stored === 'hi')) {
      i18n.changeLanguage(stored);
    }
  })
  .catch(() => {});

export default i18n;
