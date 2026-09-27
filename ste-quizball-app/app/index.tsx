import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ThemedBackground from '../components/ThemedBackground';
import HouseStandings from '../components/HouseStandings';
import BulletinCard from '../components/BulletinCard';
import { useHouseTheme } from '../contexts/ThemeContext';
import { HOUSE_IDS, HOUSES, Fonts, Palette } from '../styles/theme';
import type { HouseId } from '../styles/theme';
import {
  Bulletin,
  BulletinHouse,
  LiveState,
  defaultLiveState,
} from '../services/types';
import { subscribeToLiveState } from '../services/quizSync';
import { subscribeToBulletins } from '../services/bulletinSync';
import { isFirebaseConfigured } from '../services/firebaseConfig';

const FILTERS: BulletinHouse[] = [
  'ALL',
  'ZEUS',
  'POSEIDON',
  'ATHENA',
  'APHRODITE',
];

export default function HomeScreen() {
  const router = useRouter();
  const { house, theme, setHouse } = useHouseTheme();
  const [live, setLive] = useState<LiveState>(() => defaultLiveState());
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [filter, setFilter] = useState<BulletinHouse>('ALL');

  useEffect(() => subscribeToLiveState(setLive), []);
  useEffect(() => subscribeToBulletins(setBulletins), []);

  const filtered =
    filter === 'ALL'
      ? bulletins
      : bulletins.filter((b) => b.house === filter || b.house === 'ALL');

  const navCards: {
    route: '/display' | '/student' | '/admin';
    icon: string;
    title: string;
    sub: string;
  }[] = [
    {
      route: '/display',
      icon: 'tv-outline',
      title: 'CAST DISPLAY',
      sub: 'Projector view',
    },
    {
      route: '/student',
      icon: 'phone-portrait-outline',
      title: 'ANSWER PORTAL',
      sub: 'Play live',
    },
    {
      route: '/admin',
      icon: 'shield-checkmark-outline',
      title: 'OFFICER PANEL',
      sub: 'Control room',
    },
  ];

  return (
    <ThemedBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* ---------- masthead ---------- */}
              <View style={styles.masthead}>
                <View style={styles.crest}>
                  <Ionicons name="school" size={30} color={Palette.gold} />
                </View>
                <Text style={styles.school}>LIBERTAD NATIONAL HIGH SCHOOL</Text>
                <Text style={styles.eventTitle}>S·T·E OLYMPUS</Text>
                <Text style={styles.eventSub}>
                  Quizball Arena & Weekly Bulletin
                </Text>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerGlyph}>❦</Text>
                  <View style={styles.dividerLine} />
                </View>
              </View>

              {/* ---------- house theme switcher ---------- */}
              <View style={styles.card}>
                <Text style={styles.cardLabel}>CHOOSE YOUR HOUSE</Text>
                <View style={styles.houseRow}>
                  {HOUSE_IDS.map((h: HouseId) => {
                    const t = HOUSES[h];
                    const active = h === house;
                    return (
                      <TouchableOpacity
                        key={h}
                        onPress={() => setHouse(h)}
                        style={[
                          styles.houseBtn,
                          active && {
                            borderColor: t.colors.accent,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                          },
                        ]}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.houseOrb,
                            {
                              backgroundColor: t.colors.primary,
                              borderColor: t.colors.accent,
                            },
                          ]}
                        >
                          <Ionicons
                            name={t.icon as never}
                            size={20}
                            color={t.colors.accent}
                          />
                        </View>
                        <Text
                          style={[
                            styles.houseName,
                            active && { color: t.colors.accent },
                          ]}
                        >
                          {t.name.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.motto}>
                  {theme.epithet} — “{theme.motto}”
                </Text>
              </View>

              {/* ---------- standings ---------- */}
              <View style={styles.sectionGap}>
                <HouseStandings standings={live.standings} />
              </View>

              {/* ---------- navigation ---------- */}
              <View style={styles.navRow}>
                {navCards.map((c) => (
                  <TouchableOpacity
                    key={c.route}
                    style={styles.navCard}
                    onPress={() => router.push(c.route)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={c.icon as never}
                      size={26}
                      color={Palette.gold}
                    />
                    <Text style={styles.navTitle}>{c.title}</Text>
                    <Text style={styles.navSub}>{c.sub}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ---------- bulletin header + filters ---------- */}
              <View style={styles.bulletinHeader}>
                <Ionicons
                  name="megaphone-outline"
                  size={18}
                  color={Palette.gold}
                />
                <Text style={styles.bulletinTitle}>WEEKLY BULLETIN</Text>
              </View>
              <View style={styles.chips}>
                {FILTERS.map((f) => {
                  const active = f === filter;
                  return (
                    <TouchableOpacity
                      key={f}
                      onPress={() => setFilter(f)}
                      style={[
                        styles.chip,
                        active && styles.chipActive,
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {f}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          }
          renderItem={({ item }) => <BulletinCard item={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="newspaper-outline"
                size={34}
                color={Palette.muted}
              />
              <Text style={styles.emptyText}>
                No proclamations yet. The officers are still writing history.
              </Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.footer}>
              {!isFirebaseConfigured ? (
                <View style={styles.demoBanner}>
                  <Ionicons
                    name="flask-outline"
                    size={15}
                    color={Palette.goldSoft}
                  />
                  <Text style={styles.demoText}>
                    DEMO MODE — add Firebase keys in .env for live multi-device
                    sync
                  </Text>
                </View>
              ) : (
                <View style={styles.demoBanner}>
                  <View style={styles.liveDot} />
                  <Text style={styles.demoText}>
                    CONNECTED — live sync via Firebase
                  </Text>
                </View>
              )}
              <Text style={styles.footerText}>
                Libertad NHS • Science, Technology & Engineering
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 32 },
  masthead: { alignItems: 'center', marginTop: 6, marginBottom: 14 },
  crest: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 2,
    borderColor: Palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: Palette.gold,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  school: {
    fontFamily: Fonts.display,
    fontSize: 11,
    letterSpacing: 2.5,
    color: Palette.goldSoft,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  eventTitle: {
    fontFamily: Fonts.displayBlack,
    fontSize: 40,
    letterSpacing: 4,
    color: Palette.gold,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  eventSub: {
    fontFamily: Fonts.bodySemi,
    fontSize: 18,
    fontStyle: 'italic',
    color: Palette.parchment,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
    width: '80%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.5)',
  },
  dividerGlyph: { color: Palette.gold, fontSize: 16 },
  card: {
    backgroundColor: Palette.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Palette.cardBorder,
    padding: 14,
  },
  cardLabel: {
    fontFamily: Fonts.display,
    fontSize: 12,
    letterSpacing: 2.5,
    color: Palette.gold,
    textAlign: 'center',
    marginBottom: 10,
  },
  houseRow: { flexDirection: 'row', gap: 8 },
  houseBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.2)',
    gap: 6,
  },
  houseOrb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  houseName: {
    fontFamily: Fonts.display,
    fontSize: 10,
    letterSpacing: 1,
    color: Palette.parchmentDim,
  },
  motto: {
    fontFamily: Fonts.body,
    fontSize: 15,
    fontStyle: 'italic',
    color: Palette.goldSoft,
    textAlign: 'center',
    marginTop: 10,
  },
  sectionGap: { marginTop: 14 },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  navCard: {
    flex: 1,
    backgroundColor: Palette.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Palette.cardBorder,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  navTitle: {
    fontFamily: Fonts.display,
    fontSize: 11,
    letterSpacing: 1,
    color: Palette.parchment,
    textAlign: 'center',
  },
  navSub: { fontFamily: Fonts.body, fontSize: 13, color: Palette.muted },
  bulletinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 10,
  },
  bulletinTitle: {
    fontFamily: Fonts.display,
    fontSize: 16,
    letterSpacing: 2,
    color: Palette.gold,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  chipActive: { backgroundColor: Palette.gold, borderColor: Palette.gold },
  chipText: {
    fontFamily: Fonts.display,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Palette.parchment,
  },
  chipTextActive: { color: '#1A1405' },
  empty: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  emptyText: {
    fontFamily: Fonts.body,
    fontSize: 16,
    fontStyle: 'italic',
    color: Palette.muted,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  footer: { alignItems: 'center', marginTop: 18, gap: 10 },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  demoText: {
    fontFamily: Fonts.display,
    fontSize: 9,
    letterSpacing: 1.2,
    color: Palette.goldSoft,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2ECC71' },
  footerText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontStyle: 'italic',
    color: Palette.muted,
  },
});
