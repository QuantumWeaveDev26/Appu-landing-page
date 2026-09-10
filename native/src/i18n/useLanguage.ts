import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from './index';

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  nativeLabel: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'ENG' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिंदी' },
];

export function useLanguage() {
  const { t, i18n } = useTranslation();

  const currentLanguage = (
    SUPPORTED_LANGUAGES.includes(i18n.language as SupportedLanguage)
      ? i18n.language
      : 'en'
  ) as SupportedLanguage;

  const setLanguage = async (lang: SupportedLanguage) => {
    if (lang === currentLanguage) return;
    try {
      await i18n.changeLanguage(lang);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch (err) {
      console.warn('[i18n] Failed to persist language change:', err);
    }
  };

  return {
    t,
    currentLanguage,
    setLanguage,
    languages: LANGUAGE_OPTIONS,
  };
}
