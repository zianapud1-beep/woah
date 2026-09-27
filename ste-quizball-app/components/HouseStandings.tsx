import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { HouseSigil } from './HouseSigil';
import { alpha, houseTheme, ink, radii, spacing, typography } from '@/styles/theme';
import { HOUSE_ORDER } from '@/styles/theme';
import { HOUSE_IDS, type HouseId, type HousePoints } from '@/services/types';

/**
 * Leaderboard rendered as gilded progress bars filled with each house's
 * oil-painting palette, plus a laurel rank medallion.
 */

interface Props {
  points: HousePoints;
  /** Which house the viewer belongs to (drawn with a highlight frame). */
  activeHouse?: HouseId | null;
  /** Current house leads the room (used for live feedback). */
  animate?: boolean;
  compact?: boolean;
  onSelect?: (house: HouseId) => void;
}

const RANK_LABEL = ['I', 'II', 'III', 'IV'];

export function HouseStandings({
  points,
  activeHouse = null,
  animate = true,
  compact = false,
  onSelect,
}: Props) {
  const ranked = HOUSE_ORDER.map((house) => ({
    house,
    points: points[house] ?? 0,
  })).sort((a, b) => b.points - a.points);

  const max = Math.max(1, ...ranked.map((r) => r.points));
  const total = ranked.reduce((sum, r) => sum + r.points, 0);

  return (
    <View style={styles.wrap}>
      {ranked.map((row, index) => {
        const theme = houseTheme(row.house);
        const isActive = activeHouse === row.house;
        return (
          <Pressable
            key={row.house}
            onPress={onSelect ? () => onSelect(row.house) : undefined}
            disabled={!onSelect}
            accessibilityRole="button"
            accessibilityLabel={`${theme.name}, ${row.points} points, rank ${index + 1}`}
            style={({ pressed }) => [
              styles.row,
              compact && styles.rowCompact,
              isActive && { borderColor: theme.line, backgroundColor: alpha(theme.primary, 0.07) },
              pressed && onSelect ? { opacity: 0.7 } : null,
            ]}
          >
            <View style={[styles.medal, { borderColor: alpha(theme.primary, 0.5) }]}>
              <Text style={[styles.medalText, { color: theme.accent }]}>
                {RANK_LABEL[index]}
              </Text>
            </View>

            <View style={styles.labelCol}>
              <View style={styles.nameRow}>
                <HouseSigil house={row.house} size={compact ? 12 : 15} color={theme.accent} />
                <Text
                  style={[
                    styles.name,
                    compact && { fontSize: 12 },
                    { color: theme.accent },
                  ]}
                  numberOfLines={1}
                >
                  {theme.name.toUpperCase()}
                </Text>
              </View>
              {!compact ? (
                <Text style={styles.stream} numberOfLines={1}>
                  {theme.stream}
                </Text>
              ) : null}
            </View>

            <View style={styles.barCol}>
              <View style={[styles.barTrack, compact && { height: 10 }]}>
                <FillBar
                  house={row.house}
                  ratio={row.points / max}
                  animate={animate}
                  delay={index * 110}
                />
                {/* gilding glint */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.0)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
              </View>
            </View>

            <View style={styles.pointsCol}>
              <Text style={[styles.points, { color: theme.accent }, compact && { fontSize: 14 }]}>
                {row.points}
              </Text>
              <Text style={styles.pointsLabel}>PTS</Text>
            </View>
          </Pressable>
        );
      })}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {HOUSE_IDS.length} HOUSES · {total} POINTS CAST
        </Text>
      </View>
    </View>
  );
}

function FillBar({
  house,
  ratio,
  animate,
  delay,
}: {
  house: HouseId;
  ratio: number;
  animate: boolean;
  delay: number;
}) {
  const theme = houseTheme(house);
  const anim = useRef(new Animated.Value(animate ? 0 : ratio)).current;

  useEffect(() => {
    if (!animate) {
      anim.setValue(ratio);
      return;
    }
    const animation = Animated.timing(anim, {
      toValue: ratio,
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [anim, animate, delay, ratio]);

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.fillWrap, { width }]}>
      <LinearGradient
        colors={[...theme.bar]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {/* oil-paint sheen */}
      <LinearGradient
        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%' }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.14)',
    backgroundColor: 'rgba(8,10,18,0.55)',
  },
  rowCompact: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  medal: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalText: { fontFamily: typography.numeral, fontSize: 12 },
  labelCol: { flex: 1, minWidth: 90 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: typography.display, fontSize: 14, letterSpacing: 1.6 },
  stream: {
    fontFamily: typography.body,
    color: ink.ash,
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  barCol: { flex: 1.6, minWidth: 80 },
  barTrack: {
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fillWrap: {
    height: '100%',
    borderRadius: 6,
    overflow: 'hidden',
  },
  pointsCol: { alignItems: 'flex-end', minWidth: 42 },
  points: { fontFamily: typography.numeral, fontSize: 17 },
  pointsLabel: {
    fontFamily: typography.label,
    color: ink.slate,
    fontSize: 8,
    letterSpacing: 2,
  },
  footer: { alignItems: 'center', paddingTop: spacing.xs },
  footerText: {
    fontFamily: typography.label,
    color: ink.slate,
    fontSize: 9,
    letterSpacing: 2.6,
  },
});

export default HouseStandings;
