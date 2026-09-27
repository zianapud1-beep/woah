import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { HouseSigil } from './HouseSigil';
import { alpha, houseTheme, ink, radii, spacing, typography } from '@/styles/theme';
import { HOUSE_ORDER } from '@/styles/theme';
import type { HouseId } from '@/services/types';

/**
 * House theme switcher — a profile setting that repaints the whole app with
 * the chosen house's classical palette. Rendered as a row of plate thumbnails.
 */

interface Props {
  value: HouseId;
  onChange: (house: HouseId) => void;
  /** Student picker shows the full stream; profile switcher stays compact. */
  variant?: 'profile' | 'entry';
}

export function HousePicker({ value, onChange, variant = 'profile' }: Props) {
  const isEntry = variant === 'entry';

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Ionicons
          name={isEntry ? 'ribbon-outline' : 'color-palette-outline'}
          size={14}
          color={houseTheme(value).primary}
        />
        <Text style={[styles.eyebrow, { color: houseTheme(value).primary }]}>
          {isEntry ? 'CHOOSE YOUR HOUSE' : 'HOUSE THEME'}
        </Text>
      </View>

      <ScrollView
        horizontal={!isEntry}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={isEntry ? styles.grid : styles.row}
      >
        {HOUSE_ORDER.map((id) => {
          const theme = houseTheme(id);
          const selected = id === value;
          return (
            <Pressable
              key={id}
              onPress={() => onChange(id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${theme.name} house, ${theme.stream}`}
              style={({ pressed }) => [
                isEntry ? styles.entryCard : styles.chip,
                selected && {
                  borderColor: theme.primary,
                  borderWidth: 2,
                  shadowColor: theme.primary,
                  shadowOpacity: 0.5,
                  shadowRadius: 14,
                },
                pressed ? { opacity: 0.8 } : null,
              ]}
            >
              {isEntry ? (
                <>
                  <ImageBackground
                    source={theme.plate}
                    style={styles.entryPlate}
                    imageStyle={styles.plateImage}
                    resizeMode="cover"
                  >
                    <LinearGradient
                      colors={['rgba(4,5,10,0.15)', 'rgba(4,5,10,0.9)']}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.entrySigilWrap}>
                      <HouseSigil house={id} size={30} color={theme.accent} />
                    </View>
                  </ImageBackground>
                  <View style={styles.entryBody}>
                    <Text style={[styles.entryName, { color: theme.accent }]}>
                      {theme.name.toUpperCase()}
                    </Text>
                    <Text style={styles.entryStream} numberOfLines={2}>
                      {theme.stream}
                    </Text>
                    <Text style={[styles.entryEpithet, { color: alpha(theme.accent, 0.6) }]}>
                      {theme.epithet}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.chipPlateWrap}>
                    <ImageBackground
                      source={theme.plate}
                      style={styles.chipPlate}
                      imageStyle={styles.chipPlateImage}
                      resizeMode="cover"
                    >
                      <LinearGradient
                        colors={['rgba(4,5,10,0.25)', 'rgba(4,5,10,0.8)']}
                        style={StyleSheet.absoluteFill}
                      />
                    </ImageBackground>
                    <View style={styles.chipSigil}>
                      <HouseSigil
                        house={id}
                        size={17}
                        color={selected ? theme.accent : ink.bone}
                      />
                    </View>
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.chipName,
                        { color: selected ? theme.accent : ink.bone },
                      ]}
                    >
                      {theme.name.toUpperCase()}
                    </Text>
                    <Text style={styles.chipSub}>{theme.short}</Text>
                  </View>
                </>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: {
    fontFamily: typography.label,
    fontSize: 10,
    letterSpacing: 2.6,
  },
  row: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)',
    backgroundColor: 'rgba(8,10,18,0.7)',
  },
  chipName: { fontFamily: typography.display, fontSize: 12, letterSpacing: 1.4 },
  chipPlateWrap: { width: 34, height: 34 },
  chipPlate: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  chipPlateImage: { borderRadius: 17 },
  chipSigil: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSub: {
    fontFamily: typography.label,
    fontSize: 8,
    letterSpacing: 1.6,
    color: ink.slate,
  },

  entryCard: {
    width: '47%',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    overflow: 'hidden',
    backgroundColor: 'rgba(8,10,18,0.8)',
  },
  entryPlate: { height: 96, alignItems: 'center', justifyContent: 'center' },
  plateImage: { borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  entrySigilWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  entryBody: { padding: spacing.md, gap: 2 },
  entryName: { fontFamily: typography.display, fontSize: 15, letterSpacing: 1.6 },
  entryStream: {
    fontFamily: typography.body,
    color: ink.bone,
    fontSize: 12,
    lineHeight: 16,
  },
  entryEpithet: { fontFamily: typography.script, fontSize: 11 },
});

export default HousePicker;
