/** Light / dark preference. Applied at start-up, so changing it restarts the app. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import type { ThemeMode } from '../theme';

const KEY = 'appu_theme';

export async function loadThemePref(): Promise<ThemeMode> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** Saves the choice and restarts Appu with it. Returns false if the app could not restart itself. */
export async function switchTheme(mode: ThemeMode): Promise<boolean> {
  await AsyncStorage.setItem(KEY, mode).catch(() => {});
  try {
    await Updates.reloadAsync();
    return true;
  } catch {
    return false;
  }
}
