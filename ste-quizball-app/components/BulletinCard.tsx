import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Bulletin } from '../services/types';
import { Fonts, Palette, HOUSES } from '../styles/theme';
import type { HouseId } from '../styles/theme';

export function bulletinAccent(house: Bulletin['house']): string {
  if (house === 'ALL') return Palette.gold;
  const h = HOUSES[house.toLowerCase() as HouseId];
  return h ? h.colors.accent : Palette.gold;
}

/** Parchment announcement card with a house-colored ribbon. */
export default function BulletinCard({
  item,
  onDelete,
}: {
  item: Bulletin;
  onDelete?: (id: string) => void;
}) {
  const accent = bulletinAccent(item.house);

  return (
    <View style={styles.card}>
      <View style={[styles.ribbon, { backgroundColor: accent }]} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={[styles.chip, { borderColor: accent }]}>
            <Text style={[styles.chipText, { color: accent }]}>
              {item.house === 'ALL' ? '✦ ALL HOUSES' : `✦ ${item.house}`}
            </Text>
          </View>
          {onDelete ? (
            <TouchableOpacity
              onPress={() => onDelete(item.id)}
              hitSlop={10}
              accessibilityLabel="Delete bulletin"
            >
              <Ionicons name="trash-outline" size={18} color="#E88" />
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.message}>{item.body}</Text>

        <View style={styles.footer}>
          {item.eventDate ? (
            <View style={styles.meta}>
              <Ionicons name="calendar-outline" size={14} color={Palette.goldSoft} />
              <Text style={styles.metaText}>{item.eventDate}</Text>
            </View>
          ) : null}
          {item.location ? (
            <View style={styles.meta}>
              <Ionicons name="location-outline" size={14} color={Palette.goldSoft} />
              <Text style={styles.metaText}>{item.location}</Text>
            </View>
          ) : null}
        </View>
        {item.author ? (
          <Text style={styles.author}>— {item.author}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Palette.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Palette.cardBorder,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  ribbon: { width: 6 },
  body: { flex: 1, padding: 13 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  chipText: {
    fontFamily: Fonts.display,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 17,
    color: Palette.parchment,
    marginBottom: 5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  message: {
    fontFamily: Fonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: '#E7DCC2',
  },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontFamily: Fonts.bodySemi, fontSize: 14, color: Palette.goldSoft },
  author: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontStyle: 'italic',
    color: Palette.muted,
    marginTop: 8,
    textAlign: 'right',
  },
});
