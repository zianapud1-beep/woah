import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { alpha, houseTheme, ink, typography } from '@/styles/theme';
import type { HouseId } from '@/services/types';

/**
 * Gilded countdown ring for the projector display. Renders the remaining
 * seconds plus a sweeping arc that turns from gold to crimson as time runs out.
 */

interface Props {
  seconds: number;
  progress: number;
  size?: number;
  house?: HouseId | null;
  label?: string;
  urgent?: boolean;
}

export function CountdownRing({
  seconds,
  progress,
  size = 180,
  house = null,
  label = 'SECONDS',
  urgent = false,
}: Props) {
  const theme = house ? houseTheme(house) : null;
  const stroke = Math.max(6, size * 0.06);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!urgent) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 620,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 620,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, urgent]);

  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const danger = '#E2553F';
  const strokeColor = urgent ? danger : (theme?.primary ?? ink.gold);
  const from = urgent ? danger : (theme?.secondary ?? ink.goldDeep);
  const to = urgent ? '#F2A65A' : (theme?.primary ?? ink.goldBright);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ scale: glowScale }],
            opacity: urgent
              ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.5] })
              : 0.22,
          },
        ]}
        pointerEvents="none"
      >
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: strokeColor,
          }}
        />
      </Animated.View>

      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <Text
        style={[
          styles.seconds,
          { fontSize: size * 0.34, color: urgent ? danger : ink.vellum },
        ]}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {seconds}
      </Text>
      <Text style={[styles.label, { color: alpha(strokeColor, 0.85) }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  seconds: {
    fontFamily: typography.numeral,
    includeFontPadding: false,
    textAlign: 'center',
  },
  label: {
    fontFamily: typography.label,
    fontSize: 10,
    letterSpacing: 3,
    marginTop: -2,
  },
});

export default CountdownRing;
