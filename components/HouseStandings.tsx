import React from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HouseId, HOUSE_LIST } from '../styles/theme';

type Props = {
  scores: Record<HouseId, number>;
  compact?: boolean;
};

export default function HouseStandings({ scores, compact = false }: Props) {
  const maxScore = Math.max(100, ...HOUSE_LIST.map(({ id }) => Math.max(0, scores[id] || 0)));

  return (
    <View style={[styles.grid, compact && styles.compactGrid]}>
      {HOUSE_LIST.map((house, index) => {
        const score = Math.max(0, Number(scores[house.id]) || 0);
        const progress = Math.min(100, Math.max(4, (score / maxScore) * 100));
        return (
          <ImageBackground
            key={house.id}
            source={house.image}
            imageStyle={styles.cardImage}
            style={[
              styles.card,
              compact && styles.compactCard,
              { borderColor: house.border },
              index === 0 && !compact ? styles.firstCard : null,
            ]}
          >
            <LinearGradient
              colors={['rgba(10,10,14,0.60)', 'rgba(10,10,14,0.92)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.topline}>
              <View style={[styles.iconDisc, { backgroundColor: `${house.accent}1f`, borderColor: `${house.accent}55` }]}>
                <Text style={[styles.houseGlyph, { color: house.accent }]}>{house.name.slice(0, 1)}</Text>
              </View>
              <View style={styles.nameColumn}>
                <Text style={[styles.houseName, compact && styles.compactName]} numberOfLines={1}>{house.name.toUpperCase()}</Text>
                {!compact && <Text style={styles.discipline} numberOfLines={1}>{house.discipline}</Text>}
              </View>
              <Text style={[styles.points, { color: house.highlight }, compact && styles.compactPoints]}>
                {score.toLocaleString()}
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${progress}%`, backgroundColor: house.accent, shadowColor: house.accent }]} />
            </View>
            {!compact && <Text style={styles.pointsLabel}>POINTS EARNED</Text>}
          </ImageBackground>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  compactGrid: { gap: 8 },
  card: {
    width: '48.4%',
    minHeight: 102,
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    justifyContent: 'center',
    backgroundColor: '#15151A',
  },
  firstCard: { width: '100%', minHeight: 112 },
  compactCard: { width: '100%', minHeight: 71, paddingVertical: 9, paddingHorizontal: 10 },
  cardImage: { opacity: 0.47 },
  topline: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  iconDisc: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  houseGlyph: { fontFamily: 'serif', fontSize: 19, fontWeight: '700' },
  nameColumn: { flex: 1 },
  houseName: { color: '#F6F0E5', fontFamily: 'serif', fontSize: 13, fontWeight: '700', letterSpacing: 1.2 },
  compactName: { fontSize: 12 },
  discipline: { color: 'rgba(245,238,223,0.58)', fontSize: 9, marginTop: 3 },
  points: { color: '#FFF2D2', fontSize: 19, fontWeight: '800', fontVariant: ['tabular-nums'] },
  compactPoints: { fontSize: 17 },
  track: { height: 4, marginTop: 12, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, shadowOpacity: 0.8, shadowRadius: 5 },
  pointsLabel: { color: 'rgba(245,238,223,0.43)', fontSize: 8, letterSpacing: 1.5, marginTop: 6, textAlign: 'right' },
});
