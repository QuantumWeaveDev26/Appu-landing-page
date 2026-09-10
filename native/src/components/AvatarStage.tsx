import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { theme } from '../theme';
import { useLanguage } from '../i18n/useLanguage';

interface AvatarStageProps {
  onPressAvatar?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AVATAR_SIZE = Math.min(SCREEN_WIDTH * 0.58, 240);

export function AvatarStage({ onPressAvatar }: AvatarStageProps) {
  const { t } = useLanguage();
  const [speechBubbleText, setSpeechBubbleText] = useState<string | null>(null);

  // Floating breathing animation
  const translateY = useSharedValue(0);
  const avatarScale = useSharedValue(1);

  // Halo pulse animations
  const haloScale = useSharedValue(1);
  const haloOpacity = useSharedValue(0.5);

  useEffect(() => {
    // Continuous floating breathing motion (4-second cycle)
    translateY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(4, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Continuous halo breathing
    haloScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.95, { duration: 2600, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    haloOpacity.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.35, { duration: 2600, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
  }, []);

  const animatedAvatarStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: avatarScale.value },
    ],
  }));

  const animatedHaloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloScale.value }],
    opacity: haloOpacity.value,
  }));

  const handlePress = () => {
    // Tactile spring bounce on tap
    avatarScale.value = withSequence(
      withSpring(0.92, { damping: 10, stiffness: 300 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );

    const greetings = [
      'Namaskara! What are we learning today?',
      'Ask me anything about science, maths, or homework!',
      'Ready when you are! Pick a mission below.',
    ];
    const pick = greetings[Math.floor(Math.random() * greetings.length)];
    setSpeechBubbleText(pick);

    if (onPressAvatar) {
      onPressAvatar();
    }
  };

  return (
    <View style={styles.stageWrapper}>
      {/* Dynamic Speech Bubble on Tap */}
      {speechBubbleText ? (
        <TouchableOpacity
          style={styles.speechBubble}
          onPress={() => setSpeechBubbleText(null)}
          activeOpacity={0.8}
        >
          <Text style={styles.speechBubbleText}>{speechBubbleText}</Text>
          <View style={styles.speechBubbleArrow} />
        </TouchableOpacity>
      ) : null}

      {/* Holographic Halo & Aura Behind Avatar */}
      <Animated.View style={[styles.haloGlow, animatedHaloStyle]} />
      <Animated.View style={[styles.haloOuterRing, animatedHaloStyle]} />

      {/* Concentric Holographic Podium Base Rings */}
      <View style={styles.podiumBase}>
        <View style={styles.podiumRingOuter} />
        <View style={styles.podiumRingInner} />
      </View>

      {/* Interactive Floating Avatar Figure */}
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.9}
        style={styles.avatarTouchable}
      >
        <Animated.View style={[styles.avatarContainer, animatedAvatarStyle]}>
          <Image
            source={require('../../assets/appu_cutout.png')}
            style={styles.avatarImage}
            resizeMode="contain"
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Brand Nameplate */}
      <View style={styles.nameplate}>
        <View style={styles.onlineDot} />
        <Text style={styles.nameplateBrand}>APPU</Text>
        <Text style={styles.nameplateSep}>·</Text>
        <Text style={styles.nameplateTag}>{t('common.companionTag')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stageWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
    position: 'relative',
    height: AVATAR_SIZE + 70,
  },
  haloGlow: {
    position: 'absolute',
    width: AVATAR_SIZE * 1.15,
    height: AVATAR_SIZE * 1.15,
    borderRadius: (AVATAR_SIZE * 1.15) / 2,
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    top: 10,
  },
  haloOuterRing: {
    position: 'absolute',
    width: AVATAR_SIZE * 1.32,
    height: AVATAR_SIZE * 1.32,
    borderRadius: (AVATAR_SIZE * 1.32) / 2,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.22)',
    top: -5,
  },
  podiumBase: {
    position: 'absolute',
    bottom: 22,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scaleY: 0.32 }],
  },
  podiumRingOuter: {
    width: AVATAR_SIZE * 1.25,
    height: AVATAR_SIZE * 1.25,
    borderRadius: (AVATAR_SIZE * 1.25) / 2,
    borderWidth: 2,
    borderColor: 'rgba(105, 216, 239, 0.45)',
    backgroundColor: 'rgba(8, 30, 54, 0.6)',
  },
  podiumRingInner: {
    position: 'absolute',
    width: AVATAR_SIZE * 0.9,
    height: AVATAR_SIZE * 0.9,
    borderRadius: (AVATAR_SIZE * 0.9) / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(34, 211, 238, 0.7)',
  },
  avatarTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  avatarContainer: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  speechBubble: {
    position: 'absolute',
    top: -24,
    backgroundColor: 'rgba(8, 30, 54, 0.95)',
    borderWidth: 1,
    borderColor: theme.colors.cyan,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex: 20,
    maxWidth: SCREEN_WIDTH * 0.82,
    shadowColor: theme.colors.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  speechBubbleText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  speechBubbleArrow: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    marginLeft: -6,
    width: 12,
    height: 6,
    borderTopWidth: 6,
    borderTopColor: theme.colors.cyan,
    borderLeftWidth: 6,
    borderLeftColor: 'transparent',
    borderRightWidth: 6,
    borderRightColor: 'transparent',
  },
  nameplate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: 'rgba(8, 30, 54, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.line,
    zIndex: 12,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  nameplateBrand: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  nameplateSep: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  nameplateTag: {
    color: theme.colors.cyanSoft,
    fontSize: 11,
    fontWeight: '600',
  },
});
