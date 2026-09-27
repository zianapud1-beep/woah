import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageBackground,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { alpha, houseTheme, ink } from '@/styles/theme';
import type { HouseId } from '@/services/types';

const GRAIN = require('../assets/grain.png');

/* ------------------------------------------------------------------ motifs */

function ZeusMotif() {
  return (
    <G>
      {/* engraved circuit traces */}
      <Path d="M0 40 H120 V88 H230 V150 H330" stroke={ink.gold} strokeWidth={0.7} fill="none" opacity={0.5} />
      <Path d="M330 30 H250 V96 H150 V178" stroke={ink.gold} strokeWidth={0.5} fill="none" opacity={0.35} />
      <Circle cx="120" cy="40" r="3" fill={ink.gold} opacity={0.6} />
      <Circle cx="230" cy="88" r="3" fill={ink.gold} opacity={0.6} />
      <Circle cx="250" cy="96" r="2" fill={ink.gold} opacity={0.45} />
      {/* storm arcs */}
      <Path
        d="M40 250 92 118 68 118 128 4 108 4 160 96 122 96 176 208"
        stroke={ink.goldBright}
        strokeWidth={2.2}
        fill="none"
        strokeLinejoin="round"
        opacity={0.55}
      />
      <Polygon points="150,40 118,124 148,124 108,230 196,128 162,128 196,40" fill={ink.goldBright} opacity={0.14} />
    </G>
  );
}

function PoseidonMotif() {
  const waves = [0, 1, 2, 3, 4].map((i) => {
    const y = 60 + i * 46;
    return (
      <Path
        key={i}
        d={`M-20 ${y} q 40 -26 80 0 t 80 0 t 80 0 t 80 0 t 80 0`}
        stroke="#9FE9E4"
        strokeWidth={1.1}
        fill="none"
        opacity={0.32 - i * 0.04}
      />
    );
  });
  return (
    <G>
      {waves}
      {/* hydrodynamic grid */}
      <Path d="M0 10 H360 M0 70 H360 M0 130 H360 M0 190 H360 M0 250 H360" stroke="#7FD6D2" strokeWidth={0.35} opacity={0.18} />
      <Path d="M60 0 V270 M140 0 V270 M220 0 V270 M300 0 V270" stroke="#7FD6D2" strokeWidth={0.35} opacity={0.14} />
      {/* trident */}
      <Path d="M300 60 V230" stroke="#CFF6F4" strokeWidth={2} opacity={0.4} strokeLinecap="round" />
      <Path d="M276 96 V52 M300 84 V40 M324 96 V52" stroke="#CFF6F4" strokeWidth={2} opacity={0.4} strokeLinecap="round" />
    </G>
  );
}

function AthenaMotif() {
  const spokes = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return (
      <Line
        key={i}
        x1={180 + Math.cos(a) * 44}
        y1={140 + Math.sin(a) * 44}
        x2={180 + Math.cos(a) * 70}
        y2={140 + Math.sin(a) * 70}
        stroke={ink.gold}
        strokeWidth={1}
        opacity={0.35}
      />
    );
  });
  return (
    <G>
      {/* sacred geometry */}
      <Circle cx="180" cy="140" r="70" stroke={ink.gold} strokeWidth={0.8} fill="none" opacity={0.35} />
      <Circle cx="180" cy="140" r="44" stroke={ink.gold} strokeWidth={0.6} fill="none" opacity={0.28} />
      <Polygon
        points="180,60 252,100 252,180 180,220 108,180 108,100"
        stroke={ink.goldBright}
        strokeWidth={0.9}
        fill="none"
        opacity={0.3}
      />
      {spokes}
      {/* constellation */}
      <Path d="M40 40 96 74 132 38 186 82" stroke="#E7DFC9" strokeWidth={0.7} fill="none" opacity={0.28} />
      <Circle cx="40" cy="40" r="2.4" fill="#E7DFC9" opacity={0.4} />
      <Circle cx="96" cy="74" r="2.4" fill="#E7DFC9" opacity={0.4} />
      <Circle cx="132" cy="38" r="2.4" fill="#E7DFC9" opacity={0.4} />
      <Circle cx="186" cy="82" r="2.4" fill="#E7DFC9" opacity={0.4} />
    </G>
  );
}

function AphroditeMotif() {
  // Golden spiral, sampled from a log spiral r = a·e^(bθ)
  const pts: string[] = [];
  const steps = 90;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const theta = t * Math.PI * 3.2;
    const r = 6 * Math.exp(0.223 * theta);
    const x = 150 + r * Math.cos(theta - Math.PI / 2);
    const y = 150 + r * Math.sin(theta - Math.PI / 2);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  const hexes: Array<[number, number]> = [
    [60, 60],
    [110, 40],
    [160, 60],
    [60, 130],
    [110, 110],
    [160, 130],
  ];
  return (
    <G>
      <Polyline2 points={pts} color="#FFD9E3" opacity={0.45} />
      {hexes.map(([x, y], i) => (
        <Polygon
          key={i}
          points={hexagon(x, y, 22)}
          stroke={ink.gold}
          strokeWidth={0.9}
          fill="none"
          opacity={0.32}
        />
      ))}
      <Path d="M0 260 q 40 -40 80 0 t 80 0 t 80 0 t 80 0" stroke="#E0577F" strokeWidth={1.2} fill="none" opacity={0.3} />
    </G>
  );
}

function Polyline2({ points, color, opacity }: { points: string[]; color: string; opacity: number }) {
  return (
    <Path
      d={`M${points.join(' L')}`}
      stroke={color}
      strokeWidth={1.4}
      fill="none"
      strokeLinecap="round"
      opacity={opacity}
    />
  );
}

function hexagon(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

function HouseMotif({ house }: { house: HouseId }) {
  const content = {
    zeus: <ZeusMotif />,
    poseidon: <PoseidonMotif />,
    athena: <AthenaMotif />,
    aphrodite: <AphroditeMotif />,
  }[house];
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox="0 0 360 280"
      preserveAspectRatio="xMidYMid slice"
      opacity={0.5}
    >
      {content}
    </Svg>
  );
}

/* ------------------------------------------------------------------ props */

interface Props {
  house?: HouseId | null;
  /** How strongly the plate shows through the scrim. */
  intensity?: 'ambient' | 'dim' | 'full';
  /** Disable the slow ken-burns drift (useful for the projector screen). */
  animate?: boolean;
  motif?: boolean;
  grain?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const SCRIM: Record<NonNullable<Props['intensity']>, readonly (readonly [string, number])[]> = {
  ambient: [
    ['rgba(5,7,15,0.97)', 0],
    ['rgba(5,7,15,0.9)', 0.45],
    ['rgba(5,7,15,0.93)', 1],
  ],
  dim: [
    ['rgba(5,7,15,0.92)', 0],
    ['rgba(5,7,15,0.66)', 0.5],
    ['rgba(5,7,15,0.88)', 1],
  ],
  full: [
    ['rgba(5,7,15,0.86)', 0],
    ['rgba(5,7,15,0.4)', 0.5],
    ['rgba(5,7,15,0.82)', 1],
  ],
};

/**
 * The house-themed canvas: classical plate, chiaroscuro scrim, engraved
 * STE motif, canvas grain and a vignette — the shared backdrop for every
 * screen in the app.
 */
export function ThemedBackground({
  house = 'zeus',
  intensity = 'ambient',
  animate = true,
  motif = true,
  grain = true,
  style,
  children,
}: Props) {
  const theme = useMemo(() => houseTheme(house), [house]);
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 26000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 26000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, drift]);

  const scale = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [1.04, 1.14],
  });
  const shiftX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 10],
  });
  const shiftY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [6, -6],
  });

  return (
    <View style={[styles.root, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale }, { translateX: shiftX }, { translateY: shiftY }] }]}>
        <ImageBackground
          source={theme.plate}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        >
          <LinearGradient
            colors={SCRIM[intensity] as unknown as [string, string, ...string[]]}
            locations={[0, 0.5, 1]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[
              'rgba(5,7,15,0.0)',
              'rgba(5,7,15,0.0)',
              alpha(theme.shade, 0.85),
            ]}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
      </Animated.View>

      {motif ? <HouseMotif house={theme.id} /> : null}

      {grain ? (
        <View style={styles.grain} pointerEvents="none">
          <Image source={GRAIN} resizeMode="repeat" style={StyleSheet.absoluteFill} />
        </View>
      ) : null}

      <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="vignette" cx="50%" cy="42%" rx="78%" ry="72%">
            <Stop offset="0.35" stopColor="#05070F" stopOpacity="0" />
            <Stop offset="0.72" stopColor="#05070F" stopOpacity="0.35" />
            <Stop offset="1" stopColor="#05070F" stopOpacity="0.92" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#vignette)" />
      </Svg>

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ink.abyss,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  grain: {
    ...StyleSheet.absoluteFill,
    opacity: 0.07,
    overflow: 'hidden',
  },
});

export default ThemedBackground;
