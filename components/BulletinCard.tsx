import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bulletin } from '../services/bulletinSync';
import { COLORS, HOUSES, isHouseId } from '../styles/theme';

function formatDate(value?: string) {
  if (!value) return 'WEEKLY DISPATCH';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'WEEKLY DISPATCH';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}

export default function BulletinCard({ item }: { item: Bulletin }) {
  const houseTheme = isHouseId(item.audience) ? HOUSES[item.audience] : null;
  const accent = houseTheme?.accent ?? COLORS.gold;

  return (
    <LinearGradient colors={['rgba(34,30,27,0.91)', 'rgba(16,16,20,0.95)']} style={[styles.card, { borderColor: `${accent}40` }]}>
      <View style={styles.topLine}>
        <View style={[styles.dateMark, { borderColor: `${accent}65`, backgroundColor: `${accent}13` }]}>
          <Text style={[styles.date, { color: accent }]}>{formatDate(item.eventDate)}</Text>
        </View>
        <Text style={[styles.audience, { color: accent }]}>{item.audience === 'ALL' ? 'ALL HOUSES' : item.audience}</Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.body}>{item.body}</Text>
      <View style={styles.bottomLine}>
        <View style={[styles.rule, { backgroundColor: `${accent}8A` }]} />
        <Text style={styles.footer}>LIBERTAD · STE BULLETIN</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 17, padding: 15, marginBottom: 10 },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dateMark: { borderWidth: 1, borderRadius: 5, paddingVertical: 5, paddingHorizontal: 7 },
  date: { fontSize: 9, letterSpacing: 1.15, fontWeight: '800' },
  audience: { fontSize: 9, fontWeight: '800', letterSpacing: 1.15 },
  title: { color: '#F5EEDF', fontSize: 19, lineHeight: 25, fontFamily: 'serif', fontWeight: '700', marginTop: 12 },
  body: { color: 'rgba(245,238,223,0.72)', fontSize: 13, lineHeight: 20, marginTop: 6 },
  bottomLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14 },
  rule: { height: 1, width: 22 },
  footer: { color: 'rgba(245,238,223,0.38)', letterSpacing: 1.15, fontSize: 8, fontWeight: '700' },
});
