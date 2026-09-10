import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { theme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Home');
    }, 1200);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>IGR ACADEMY</Text>
      <Text style={styles.brand}>APPU</Text>
      <Text style={styles.subtitle}>Your AI Learning Companion</Text>
      <ActivityIndicator size="small" color={theme.colors.cyan} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  eyebrow: {
    color: theme.colors.cyanSoft,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 10,
  },
  brand: {
    color: theme.colors.text,
    fontSize: 54,
    fontWeight: '800',
    letterSpacing: 2,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  loader: {
    marginTop: 32,
  },
});
