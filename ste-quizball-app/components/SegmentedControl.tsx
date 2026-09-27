import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { alpha, ink, radii, spacing, typography } from '@/styles/theme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

/** Gilded tab bar used for the question type and the officer tabs. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accent = ink.gold,
  style,
}: {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (next: T) => void;
  accent?: string;
  style?: object;
}) {
  return (
    <View style={[styles.track, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={[styles.item, active && { borderColor: accent }]}
          >
            {active ? (
              <LinearGradient
                colors={[alpha(accent, 0.32), alpha(accent, 0.1)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            {opt.icon ? (
              <Ionicons
                name={opt.icon}
                size={13}
                color={active ? accent : ink.ash}
              />
            ) : null}
            <Text
              style={[
                styles.label,
                { color: active ? ink.vellum : ink.ash },
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small pill filters for the bulletin board. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  accentFor,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  accentFor?: (value: T) => string;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = opt.value === value;
        const accent = accentFor ? accentFor(opt.value) : ink.gold;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.chip,
              active
                ? { borderColor: accent, backgroundColor: alpha(accent, 0.18) }
                : null,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: active ? accent : ink.ash },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: 'rgba(4,6,12,0.7)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    padding: 3,
    gap: 3,
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  label: {
    fontFamily: typography.label,
    fontSize: 11,
    letterSpacing: 1.8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    backgroundColor: 'rgba(6,8,14,0.6)',
  },
  chipText: {
    fontFamily: typography.label,
    fontSize: 10,
    letterSpacing: 1.8,
  },
});

export default SegmentedControl;
