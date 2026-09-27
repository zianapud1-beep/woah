import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { describeStatus } from '@/services/answerLogic';
import { alpha, ink, radii, spacing, typography } from '@/styles/theme';
import type { HouseId, QuizStatus } from '@/services/types';

/**
 * The status banner that sits above every question — `BUZZERS OPEN`,
 * `TIME UP`, `ANSWER REVEALED` — colour-coded and gently animated so it
 * reads instantly from the back of the hall.
 */

const STYLES: Record<
  QuizStatus,
  { color: string; icon: keyof typeof Ionicons.glyphMap; pulse: boolean }
> = {
  IDLE: { color: ink.ash, icon: 'hourglass-outline', pulse: false },
  BUZZERS_OPEN: { color: '#7BE495', icon: 'flash', pulse: true },
  PAUSED: { color: ink.goldBright, icon: 'pause', pulse: false },
  TIME_UP: { color: '#E2553F', icon: 'alarm', pulse: false },
  ANSWER_REVEALED: { color: '#F3D98B', icon: 'sparkles', pulse: true },
  CLOSED: { color: ink.ash, icon: 'lock-closed', pulse: false },
};

interface Props {
  status: QuizStatus;
  house?: HouseId | null;
  /** Extra line, e.g. "Correct answers received 4 / 10". */
  caption?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function StatusBanner({ status, house, caption, size = 'md' }: Props) {
  const conf = STYLES[status];
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!conf.pulse) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [conf.pulse, pulse]);

  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.32] });
  const height = size === 'xl' ? 64 : size === 'sm' ? 34 : size === 'lg' ? 56 : 46;
  const fontSize = size === 'xl' ? 26 : size === 'sm' ? 13 : size === 'lg' ? 21 : 18;

  return (
    <View style={{ borderRadius: radii.sm, overflow: 'hidden' }}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: conf.color, opacity: glow }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[
          alpha(conf.color, 0.3),
          'rgba(6,8,14,0.88)',
          alpha(conf.color, 0.22),
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.bar,
          { height, borderColor: alpha(conf.color, 0.55) },
        ]}
      >
        <Ionicons name={conf.icon} size={fontSize * 1.05} color={conf.color} />
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.label,
              { fontSize, color: conf.color },
            ]}
            numberOfLines={1}
            accessibilityLiveRegion="polite"
          >
            {describeStatus(status)}
          </Text>
          {caption ? (
            <Text style={styles.caption} numberOfLines={1}>
              {caption}
            </Text>
          ) : null}
        </View>
        {house ? (
          <View style={[styles.tag, { borderColor: alpha(conf.color, 0.4) }]}>
            <Text style={[styles.tagText, { color: conf.color }]}>
              {house.toUpperCase()}
            </Text>
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    justifyContent: 'center',
  },
  label: {
    fontFamily: typography.display,
    letterSpacing: 3.4,
    textAlign: 'center',
  },
  caption: {
    fontFamily: typography.body,
    color: ink.bone,
    fontSize: 12,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  tag: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  tagText: { fontFamily: typography.label, fontSize: 9, letterSpacing: 1.8 },
});

export default StatusBanner;
