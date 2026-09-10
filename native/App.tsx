import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import './src/i18n';
import { RootNavigator } from './src/navigation/RootNavigator';
import { theme } from './src/theme';

const appTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: theme.colors.cyan,
    background: theme.colors.bg,
    card: theme.colors.bgElevated,
    text: theme.colors.text,
    border: theme.colors.line,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={appTheme}>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
