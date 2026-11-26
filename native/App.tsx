import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { useFonts, Manrope_500Medium, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import './src/i18n';
import { applyTheme, theme } from './src/theme';
import { loadThemePref } from './src/lib/themePref';

export default function App() {
  // The website's fonts. If they fail to load, the app still runs with the system font.
  const [fontsLoaded, fontError] = useFonts({ Manrope_500Medium, Manrope_700Bold, SpaceGrotesk_700Bold });
  // Screens build their styles when first loaded, so the theme is applied before loading them.
  const [Navigator, setNavigator] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    void loadThemePref().then((mode) => {
      applyTheme(mode);
      setNavigator(() => require('./src/navigation/RootNavigator').RootNavigator);
    });
  }, []);

  if ((!fontsLoaded && !fontError) || !Navigator) return null;

  const base = theme.mode === 'light' ? DefaultTheme : DarkTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.colors.cyan,
      background: theme.colors.bg,
      card: theme.colors.bgElevated,
      text: theme.colors.text,
      border: theme.colors.line,
    },
  };

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style={theme.mode === 'light' ? 'dark' : 'light'} />
        <Navigator />
      </NavigationContainer>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
