import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { HouseSigil } from './HouseSigil';
import { alpha, houseTheme, ink, spacing, typography } from '@/styles/theme';
import { HOUSE_ORDER } from '@/styles/theme';
import type { HouseId, HousePoints } from '@/services/types';

/**
 * The "first 10" pips plus a compact house strip — used on the projector
 * display and the dashboard's live strip.
 */

export function ResponderPips({
  count,
  max,
  accent = ink.gold,
}: {
  count: number;
  max: number;
  accent?: string;
}) {
  return (
    <View
      style={styles.pips}
      accessibilityLabel={`${count} of ${max} correct answers received`}
    >
      {Array.from({ length: max }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.pip,
            {
              backgroundColor: i < count ? accent : 'rgba(255,255,255,0.12)',
              borderColor: i < count ? accent : 'rgba(255,255,255,0.2)',
              shadowColor: accent,
            },
          ]}
        />
      ))}
    </View>
  );
}

/** Horizontal standings strip for the bottom of the projector screen. */
export function HouseScoreStrip({
  points,
  leader,
  height = 74,
}: {
  points: HousePoints;
  leader: HouseId | null;
  height?: number;
}) {
  const max = Math.max(1, ...HOUSE_ORDER.map((h) => points[h] ?? 0));
  return (
    <View style={[styles.strip, { height }]}>
      {HOUSE_ORDER.map((house) => {
        const theme = houseTheme(house);
        const value = points[house] ?? 0;
        return (
          <View key={house} style={styles.stripCol}>
            <View style={styles.stripNameRow}>
              <HouseSigil house={house} size={14} color={theme.accent} />
              <Text style={[styles.stripName, { color: theme.accent }]} numberOfLines={1}>
                {theme.name.toUpperCase()}
              </Text>
              {leader === house ? (
                <Text style={[styles.crown, { color: theme.accent }]}>◆</Text>
              ) : null}
            </View>
            <View style={styles.stripBar}>
              <LinearGradient
                colors={[...theme.bar]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.stripFill, { width: `${(value / max) * 100}%` }]}
              />
            </View>
            <Text style={styles.stripValue}>{value}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** A number that rolls up to its new value — used for point totals. */
export function RollingNumber({
  value,
  size = 30,
  color = ink.vellum,
  duration = 700,
}: {
  value: number;
  size?: number;
  color?: string;
  duration?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = React.useState(value);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(anim, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [anim, duration, value]);

  return (
    <Text style={[styles.rolling, { fontSize: size, color }]}>{display}</Text>
  );
}

const styles = StyleSheet.create({
  pips: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  pip: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    shadowOpacity: 0.7,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  strip: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: alpha(ink.gold, 0.25),
    backgroundColor: 'rgba(4,6,12,0.7)',
  },
  stripCol: { flex: 1, gap: 4 },
  stripNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stripName: {
    fontFamily: typography.display,
    fontSize: 12,
    letterSpacing: 2,
    flexShrink: 1,
  },
  crown: { fontSize: 9 },
  stripBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: alpha(ink.gold, 0.2),
    overflow: 'hidden',
  },
  stripFill: { height: '100%', borderRadius: 4 },
  stripValue: {
    fontFamily: typography.numeral,
    color: ink.bone,
    fontSize: 15,
  },
  rolling: {
    fontFamily: typography.numeral,
    textAlign: 'center',
  },
});

export default ResponderPips;
