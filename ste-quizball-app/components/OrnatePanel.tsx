import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import { HouseSigil } from './HouseSigil';
import { HOUSES, alpha, houseTheme, ink, radii, spacing, typography } from '@/styles/theme';
import type { HouseId } from '@/services/types';

/** Thin gilded rule with a lozenge at its centre — a section divider. */
export function OrnateRule({
  color = ink.gold,
  style,
  width = '100%',
}: {
  color?: string;
  style?: StyleProp<ViewStyle>;
  width?: number | `${number}%`;
}) {
  return (
    <View style={[styles.rule, { width }, style]}>
      <LinearGradient
        colors={['rgba(0,0,0,0)', color, 'rgba(0,0,0,0)']}
        style={styles.ruleLine}
      />
      <View style={[styles.ruleDiamond, { borderColor: color }]} />
    </View>
  );
}

interface PanelProps {
  children: React.ReactNode;
  house?: HouseId | null;
  /** Slight opacity drop for nested panels. */
  tone?: 'solid' | 'raised' | 'sunken';
  accent?: string;
  title?: string;
  eyebrow?: string;
  /** Ionicon glyph shown beside the title. */
  icon?: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  /** Draw the house sigil instead of an icon. */
  sigil?: HouseId;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  padded?: boolean;
}

/**
 * A gilded panel: double hairline frame, corner fleurons and a canvas-filled
 * interior. The workhorse surface for every card in the app.
 */
export function OrnatePanel({
  children,
  house = null,
  tone = 'raised',
  accent,
  title,
  eyebrow,
  icon,
  sigil,
  style,
  contentStyle,
  padded = true,
}: PanelProps) {
  const theme = house ? houseTheme(house) : null;
  const line = accent ?? theme?.line ?? 'rgba(212,175,55,0.3)';
  const fill =
    tone === 'solid'
      ? 'rgba(9,11,18,0.94)'
      : tone === 'sunken'
        ? 'rgba(3,5,10,0.78)'
        : 'rgba(14,17,27,0.86)';

  return (
    <View style={[styles.panel, { borderColor: line, backgroundColor: fill }, style]}>
      <View style={[styles.innerBorder, { borderColor: alpha(ink.gold, 0.18) }]} pointerEvents="none" />
      {title ? (
        <View style={styles.header}>
          {sigil ? <HouseSigil house={sigil} size={18} color={line} /> : null}
          {icon ? <Ionicons name={icon} size={16} color={line} /> : null}
          <View style={{ flex: 1 }}>
            {eyebrow ? (
              <Text style={[styles.eyebrow, { color: line }]} numberOfLines={1}>
                {eyebrow}
              </Text>
            ) : null}
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          </View>
        </View>
      ) : null}
      <View style={[padded ? styles.body : undefined, contentStyle]}>{children}</View>
    </View>
  );
}

/** Four engraved corner flourons — drawn once, reused by the display screen. */
export function CornerFleurons({
  color = ink.gold,
  size = 26,
  opacity = 0.55,
}: {
  color?: string;
  size?: number;
  opacity?: number;
}) {
  const corner = (rotate: string) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      <G transform={`rotate(${rotate} 12 12)`}>
        <Path
          d="M2 22V10C2 5 5 2 10 2h12"
          stroke={color}
          strokeWidth={1.1}
          fill="none"
          strokeLinecap="round"
        />
        <Circle cx="6" cy="6" r="1.6" fill={color} />
        <Path d="M10 10c4 0 6 2 6 6" stroke={color} strokeWidth={0.7} fill="none" />
      </G>
    </Svg>
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.tl}>{corner('0')}</View>
      <View style={styles.tr}>{corner('90')}</View>
      <View style={styles.bl}>{corner('270')}</View>
      <View style={styles.br}>{corner('180')}</View>
    </View>
  );
}

/** A house "wax seal" chip used on cards and filters. */
export function HouseSeal({
  house,
  size = 40,
  label,
}: {
  house: HouseId;
  size?: number;
  label?: string;
}) {
  const theme = HOUSES[house];
  return (
    <View
      style={[
        styles.seal,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: theme.line,
        },
      ]}
    >
      <LinearGradient
        colors={[alpha(theme.primary, 0.28), 'rgba(6,8,14,0.9)']}
        style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
      />
      <HouseSigil house={house} size={size * 0.5} color={theme.accent} />
      {label ? (
        <Text style={[styles.sealLabel, { color: theme.accent, fontSize: size * 0.3 }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    opacity: 0.9,
  },
  ruleLine: {
    flex: 1,
    height: 1,
  },
  ruleDiamond: {
    width: 7,
    height: 7,
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  panel: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  innerBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.lg,
    borderWidth: 1,
    margin: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  eyebrow: {
    fontFamily: typography.label,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: typography.display,
    fontSize: 19,
    letterSpacing: 1.1,
    color: ink.vellum,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  tl: { position: 'absolute', top: 4, left: 4 },
  tr: { position: 'absolute', top: 4, right: 4 },
  bl: { position: 'absolute', bottom: 4, left: 4 },
  br: { position: 'absolute', bottom: 4, right: 4 },
  seal: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  sealLabel: {
    position: 'absolute',
    bottom: 2,
    fontFamily: typography.display,
    letterSpacing: 1,
  },
});

export type { TextStyle };
export default OrnatePanel;
