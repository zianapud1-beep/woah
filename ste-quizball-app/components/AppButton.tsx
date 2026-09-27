import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { alpha, houseTheme, ink, radii, spacing, typography } from '@/styles/theme';
import type { HouseId } from '@/services/types';

/** Primary action button — gilded plate with an engraved label. */
export function AppButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  house = null,
  disabled,
  loading,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'ghost' | 'danger';
  house?: HouseId | null;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const theme = house ? houseTheme(house) : null;
  const accent = theme?.primary ?? ink.gold;
  const deep = theme?.secondary ?? ink.goldDeep;

  const scale = useRef(new Animated.Value(1)).current;
  const background =
    variant === 'primary'
      ? [deep, accent]
      : variant === 'danger'
        ? ['#5A1717', '#8E2A22']
        : ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.04)'];

  const textColor =
    variant === 'primary'
      ? (theme?.onPrimary ?? '#1A1204')
      : variant === 'danger'
        ? '#FFE9E6'
        : accent;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.96,
            useNativeDriver: true,
            speed: 50,
            bounciness: 0,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 20,
          }).start()
        }
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !!disabled, busy: !!loading }}
        style={[
          styles.button,
          variant === 'ghost' && { borderColor: alpha(accent, 0.5) },
          (disabled || loading) && { opacity: 0.45 },
        ]}
      >
        <LinearGradient
          colors={background as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {variant === 'primary' ? (
          <View style={styles.sheen} pointerEvents="none" />
        ) : null}
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : icon ? (
          <Ionicons name={icon} size={16} color={textColor} />
        ) : null}
        <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/** Compact square control used for timer presets and steppers. */
export function OrnateButton({
  label,
  onPress,
  active,
  icon,
  tone = 'gold',
  disabled,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  active?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'gold' | 'crimson' | 'verdigris';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const accent =
    tone === 'crimson' ? '#E2553F' : tone === 'verdigris' ? '#4FC3C7' : ink.gold;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      style={[
        styles.mini,
        active
          ? { borderColor: accent, backgroundColor: alpha(accent, 0.22) }
          : null,
        disabled ? { opacity: 0.4 } : null,
        style,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={14}
          color={active ? accent : ink.bone}
        />
      ) : null}
      <Text
        style={[
          styles.miniLabel,
          { color: active ? accent : ink.bone },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  label: {
    fontFamily: typography.display,
    fontSize: 14,
    letterSpacing: 2,
  },
  mini: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    backgroundColor: 'rgba(8,10,18,0.7)',
  },
  miniLabel: {
    fontFamily: typography.label,
    fontSize: 11,
    letterSpacing: 1.4,
  },
});

export default AppButton;
