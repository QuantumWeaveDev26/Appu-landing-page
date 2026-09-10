import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

export interface MissionCardProps {
  title: string;
  description: string;
  prompt: string;
  icon: string;
  accentColor: string;
  onPress: (prompt: string) => void;
}

export function MissionCard({
  title,
  description,
  prompt,
  icon,
  accentColor,
  onPress,
}: MissionCardProps) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        { borderLeftColor: accentColor, borderLeftWidth: 3 },
      ]}
      onPress={() => onPress(prompt)}
      activeOpacity={0.78}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}35` },
        ]}
      >
        <Text style={styles.icon}>{icon}</Text>
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>
      </View>

      <View style={[styles.arrowCircle, { borderColor: `${accentColor}40` }]}>
        <Text style={[styles.arrow, { color: accentColor }]}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  description: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    fontSize: 14,
    fontWeight: '900',
  },
});
