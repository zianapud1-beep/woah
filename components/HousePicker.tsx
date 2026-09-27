import React from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HouseId, HOUSE_LIST } from '../styles/theme';

type Props = {
  value: HouseId;
  onChange: (house: HouseId) => void;
};

export default function HousePicker({ value, onChange }: Props) {
  return (
    <View style={styles.grid}>
      {HOUSE_LIST.map((house) => {
        const selected = house.id === value;
        return (
          <Pressable
            key={house.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Select House ${house.name}`}
            onPress={() => onChange(house.id)}
            style={[styles.pressable, selected && { borderColor: house.accent, shadowColor: house.accent }]}
          >
            <ImageBackground source={house.image} imageStyle={styles.image} style={styles.tile}>
              <LinearGradient
                colors={['rgba(9,9,13,0.20)', 'rgba(9,9,13,0.93)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.copy}>
                <Text style={[styles.name, { color: selected ? house.highlight : '#F4EEE2' }]}>{house.name.toUpperCase()}</Text>
                <Text style={styles.motto} numberOfLines={1}>{house.motto}</Text>
              </View>
              {selected && <View style={[styles.check, { backgroundColor: house.accent }]}><Text style={styles.checkText}>✓</Text></View>}
            </ImageBackground>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  pressable: {
    width: '48.5%',
    borderRadius: 13,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowOpacity: 0.17,
    shadowRadius: 10,
    elevation: 2,
  },
  tile: { height: 78, justifyContent: 'flex-end', backgroundColor: '#19171A' },
  image: { opacity: 0.68 },
  copy: { paddingHorizontal: 11, paddingBottom: 9, paddingRight: 27 },
  name: { fontSize: 11, letterSpacing: 1.25, fontWeight: '800', fontFamily: 'serif' },
  motto: { color: 'rgba(255,248,234,0.60)', marginTop: 3, fontSize: 9 },
  check: { position: 'absolute', right: 7, top: 7, width: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: '#211B14', fontSize: 13, fontWeight: '900', marginTop: -1 },
});
