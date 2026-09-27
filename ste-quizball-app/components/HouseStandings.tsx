import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { HOUSE_IDS, HOUSES, Fonts, Palette } from '../styles/theme';
import type { HouseId } from '../styles/theme';

const MEDALS = ['#FFD700', '#C9CCD6', '#E0995C', '#7A7466'];

function HouseBar({
  house,
  points,
  max,
  rank,
}: {
  house: HouseId;
  points: number;
  max: number;
  rank: number;
}) {
  const t = HOUSES[house];
  const pct = max > 0 ? Math.min(1, Math.max(0.07, points / max)) : 0.07;

  return (
    <View style={styles.row}>
      <View style={styles.rankCol}>
        <Ionicons
          name={rank === 0 ? 'trophy' : 'medal'}
          size={22}
          color={MEDALS[rank] ?? MEDALS[3]}
        />
        <Text style={styles.rankText}>#{rank + 1}</Text>
      </View>

      <View style={styles.mainCol}>
        <View style={styles.nameRow}>
          <View
            style={[
              styles.houseDot,
              { backgroundColor: t.colors.primary, borderColor: t.colors.accent },
            ]}
          >
            <Ionicons name={t.icon as never} size={15} color={t.colors.accent} />
          </View>
          <Text style={styles.houseName}>{t.name}</Text>
          <Text style={styles.domain} numberOfLines={1}>
            {t.domain}
          </Text>
        </View>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(pct * 100)}%` }]}>
            <LinearGradient
              colors={[t.colors.secondary, t.colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fillGradient}
            />
          </View>
        </View>
      </View>

      <View style={styles.pointsCol}>
        <Text style={[styles.points, { color: t.colors.goldSoft }]}>
          {points.toLocaleString()}
        </Text>
        <Text style={styles.ptsLabel}>PTS</Text>
      </View>
    </View>
  );
}

/** Live leaderboard with oil-painting styled progress bars. */
export default function HouseStandings({
  standings,
}: {
  standings: Record<HouseId, number>;
}) {
  const sorted = [...HOUSE_IDS].sort(
    (a, b) => (standings[b] || 0) - (standings[a] || 0)
  );
  const max = Math.max(1, ...sorted.map((h) => standings[h] || 0));

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="podium" size={18} color={Palette.gold} />
        <Text style={styles.cardTitle}>HOUSE STANDINGS</Text>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>
      {sorted.map((h, i) => (
        <HouseBar
          key={h}
          house={h}
          points={standings[h] || 0}
          max={max}
          rank={i}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Palette.cardBorder,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.25)',
    paddingBottom: 10,
  },
  cardTitle: {
    fontFamily: Fonts.display,
    fontSize: 15,
    letterSpacing: 2,
    color: Palette.gold,
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(46, 196, 113, 0.15)',
    borderColor: 'rgba(46, 196, 113, 0.5)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2ECC71' },
  liveText: {
    fontFamily: Fonts.display,
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#7DEAA8',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  rankCol: { width: 40, alignItems: 'center' },
  rankText: {
    fontFamily: Fonts.display,
    fontSize: 10,
    color: Palette.parchmentDim,
    marginTop: 2,
  },
  mainCol: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  houseDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  houseName: {
    fontFamily: Fonts.display,
    fontSize: 14,
    letterSpacing: 1,
    color: Palette.parchment,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  domain: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Palette.muted,
    flex: 1,
    textAlign: 'right',
  },
  track: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 6, overflow: 'hidden' },
  fillGradient: { flex: 1 },
  pointsCol: { width: 64, alignItems: 'flex-end' },
  points: {
    fontFamily: Fonts.displayBlack,
    fontSize: 19,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  ptsLabel: {
    fontFamily: Fonts.display,
    fontSize: 9,
    letterSpacing: 2,
    color: Palette.muted,
  },
});
