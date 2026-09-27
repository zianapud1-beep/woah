import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import ThemedBackground from '../components/ThemedBackground';
import HouseStandings from '../components/HouseStandings';
import HousePicker from '../components/HousePicker';
import BulletinCard from '../components/BulletinCard';
import { useHouseTheme } from '../context/HouseThemeContext';
import { Bulletin, subscribeBulletins } from '../services/bulletinSync';
import { EMPTY_STANDINGS, Standings, subscribeStandings } from '../services/quizSync';
import { COLORS, HOUSE_LIST, HouseFilter, HouseId } from '../styles/theme';
import { isFirebaseConfigured } from '../services/firebaseConfig';

const FILTERS: HouseFilter[] = ['ALL', 'ZEUS', 'POSEIDON', 'ATHENA', 'APHRODITE'];

function SectionHeading({ eyebrow, title, trailing }: { eyebrow?: string; title: string; trailing?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <View>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {trailing ? <Text style={styles.sectionTrailing}>{trailing}</Text> : null}
    </View>
  );
}

function NavLink({ icon, label, target }: { icon: keyof typeof Ionicons.glyphMap; label: string; target: '/student' | '/display' | '/admin' }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(target)} style={({ pressed }) => [styles.navLink, pressed && styles.pressed]}>
      <Ionicons name={icon} size={15} color={COLORS.gold} />
      <Text style={styles.navLabel}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { selectedHouse, selectedTheme, setSelectedHouse } = useHouseTheme();
  const [standings, setStandings] = useState<Standings>(EMPTY_STANDINGS);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [filter, setFilter] = useState<HouseFilter>('ALL');
  const [connectionError, setConnectionError] = useState('');

  useEffect(() => {
    const reportError = (error: Error) => setConnectionError(error.message || 'Live service is temporarily unavailable.');
    const unsubscribeStandings = subscribeStandings(setStandings, reportError);
    const unsubscribeBulletins = subscribeBulletins(setBulletins, reportError);
    return () => {
      unsubscribeStandings();
      unsubscribeBulletins();
    };
  }, []);

  const filteredBulletins = useMemo(
    () => (filter === 'ALL' ? bulletins : bulletins.filter((item) => item.audience === 'ALL' || item.audience === filter)),
    [bulletins, filter],
  );

  const renderBulletin = ({ item }: ListRenderItemInfo<Bulletin>) => <BulletinCard item={item} />;

  const header = (
    <View>
      <View style={styles.topBar}>
        <View style={styles.brandLockup}>
          <View style={[styles.seal, { borderColor: `${selectedTheme.accent}92` }]}>
            <Ionicons name="sparkles" size={18} color={selectedTheme.accent} />
          </View>
          <View>
            <Text style={styles.schoolName}>LIBERTAD NATIONAL HIGH SCHOOL</Text>
            <Text style={styles.schoolMeta}>SCIENCE · TECHNOLOGY · ENGINEERING</Text>
          </View>
        </View>
        <View style={styles.syncBadge}>
          <View style={[styles.syncDot, { backgroundColor: isFirebaseConfigured && !connectionError ? COLORS.success : '#D3A959' }]} />
          <Text style={styles.syncText}>{isFirebaseConfigured && !connectionError ? 'LIVE' : 'SETUP'}</Text>
        </View>
      </View>

      {!isFirebaseConfigured ? (
        <View style={styles.setupNotice}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.gold} />
          <Text style={styles.setupText}>Add Firebase keys to .env to enable live scores, bulletins, and Quizball.</Text>
        </View>
      ) : connectionError ? (
        <View style={styles.setupNotice}>
          <Ionicons name="cloud-offline-outline" size={16} color={COLORS.gold} />
          <Text style={styles.setupText}>Live sync unavailable: {connectionError}</Text>
        </View>
      ) : null}

      <LinearGradient colors={['rgba(53,43,32,0.89)', 'rgba(20,18,20,0.95)']} style={[styles.heroCard, { borderColor: `${selectedTheme.accent}51` }]}>
        <View pointerEvents="none" style={[styles.heroOrnament, { borderColor: `${selectedTheme.accent}35` }]} />
        <View style={styles.heroTop}>
          <View style={[styles.heroKicker, { backgroundColor: `${selectedTheme.accent}19`, borderColor: `${selectedTheme.accent}48` }]}>
            <Ionicons name="trophy-outline" size={12} color={selectedTheme.accent} />
            <Text style={[styles.heroKickerText, { color: selectedTheme.accent }]}>THE HOUSES OF LIBERTAD</Text>
          </View>
          <Ionicons name="aperture-outline" size={22} color={`${selectedTheme.accent}A8`} />
        </View>
        <Text style={styles.heroTitle}>STE <Text style={{ color: selectedTheme.accent }}>Quizball</Text></Text>
        <Text style={styles.heroDescription}>Four houses. One pursuit of knowledge. Follow the live standings and take your place in the next challenge.</Text>
        <View style={styles.navRow}>
          <NavLink icon="person-circle-outline" label="JOIN THE GAME" target="/student" />
          <NavLink icon="tv-outline" label="DISPLAY" target="/display" />
          <NavLink icon="key-outline" label="OFFICERS" target="/admin" />
        </View>
      </LinearGradient>

      <View style={styles.sectionBlock}>
        <SectionHeading eyebrow="THE LIVE LEDGER" title="House standings" trailing="SYNCED LIVE" />
        <HouseStandings scores={standings} />
      </View>

      <View style={styles.sectionBlock}>
        <SectionHeading eyebrow="YOUR PERSONAL LENS" title="Choose a house" />
        <Text style={styles.sectionDescription}>Your choice sets the classical art direction throughout the app.</Text>
        <HousePicker value={selectedHouse} onChange={(house: HouseId) => void setSelectedHouse(house)} />
        <Text style={[styles.houseDiscipline, { color: selectedTheme.muted }]}>
          <Text style={{ color: selectedTheme.accent }}>{selectedTheme.name.toUpperCase()} · </Text>{selectedTheme.discipline}
        </Text>
      </View>

      <View style={styles.bulletinHeadingWrap}>
        <SectionHeading eyebrow="FROM THE COUNCIL" title="Weekly bulletin" trailing={`${bulletins.length} ${bulletins.length === 1 ? 'NOTICE' : 'NOTICES'}`} />
        <Text style={styles.sectionDescription}>Events, rounds, and important announcements from your STE community.</Text>
        <View style={styles.filterRow}>
          {FILTERS.map((item) => {
            const active = item === filter;
            const accent = item === 'ALL' ? selectedTheme.accent : HOUSE_LIST.find((house) => house.id === item)?.accent ?? selectedTheme.accent;
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(item)}
                style={[styles.filterChip, active && { borderColor: `${accent}90`, backgroundColor: `${accent}18` }]}
              >
                <Text style={[styles.filterText, active && { color: accent }]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );

  return (
    <ThemedBackground house={selectedHouse} imageOpacity={0.52} overlayOpacity={0.95}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <FlatList
          data={filteredBulletins}
          renderItem={renderBulletin}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          ListEmptyComponent={(
            <View style={styles.emptyBulletin}>
              <Ionicons name="newspaper-outline" size={23} color={selectedTheme.accent} />
              <Text style={styles.emptyTitle}>The notice board is quiet</Text>
              <Text style={styles.emptyCopy}>New weekly events will appear here as soon as they are published.</Text>
            </View>
          )}
          ListFooterComponent={(
            <View style={styles.footer}>
              <View style={styles.footerRule} />
              <Text style={styles.footerText}>LIBERTAD · LEARN WITH COURAGE</Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingBottom: 28, maxWidth: 720, width: '100%', alignSelf: 'center' },
  topBar: { minHeight: 57, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  seal: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(12,12,15,0.75)' },
  schoolName: { color: '#F1E8D7', letterSpacing: 1.25, fontSize: 9, fontWeight: '800' },
  schoolMeta: { color: 'rgba(244,235,215,0.47)', letterSpacing: 0.82, fontSize: 7, marginTop: 4 },
  syncBadge: { flexDirection: 'row', gap: 6, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 9 },
  syncDot: { width: 6, height: 6, borderRadius: 3 },
  syncText: { color: '#E7DECD', fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  setupNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(216,181,106,0.11)', borderColor: 'rgba(216,181,106,0.28)', borderWidth: 1, borderRadius: 11, padding: 10, marginBottom: 12 },
  setupText: { flex: 1, color: 'rgba(246,238,222,0.77)', fontSize: 11, lineHeight: 16 },
  heroCard: { minHeight: 232, overflow: 'hidden', borderWidth: 1, borderRadius: 21, padding: 19, marginBottom: 27 },
  heroOrnament: { position: 'absolute', right: -61, bottom: -111, width: 253, height: 253, borderWidth: 1, borderRadius: 127, opacity: 0.7 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroKicker: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 9 },
  heroKickerText: { fontSize: 8, letterSpacing: 1.2, fontWeight: '800' },
  heroTitle: { color: '#F7EFDF', fontSize: 34, lineHeight: 41, fontWeight: '700', fontFamily: 'serif', marginTop: 18 },
  heroDescription: { color: 'rgba(245,237,221,0.66)', fontSize: 12, lineHeight: 19, maxWidth: 440, marginTop: 5 },
  navRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  navLink: { minHeight: 35, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(5,5,7,0.29)', paddingHorizontal: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  navLabel: { color: '#F0E7D6', fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  sectionBlock: { marginBottom: 27 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  eyebrow: { color: 'rgba(232,195,106,0.76)', fontSize: 8, letterSpacing: 1.7, fontWeight: '800', marginBottom: 4 },
  sectionTitle: { color: '#F4EBDD', fontSize: 23, lineHeight: 29, fontFamily: 'serif', fontWeight: '700' },
  sectionTrailing: { color: 'rgba(242,232,213,0.44)', fontSize: 8, fontWeight: '800', letterSpacing: 1.05, marginBottom: 4 },
  sectionDescription: { color: 'rgba(242,232,213,0.61)', fontSize: 12, lineHeight: 18, marginTop: -5, marginBottom: 12 },
  houseDiscipline: { fontSize: 10, marginTop: 10, letterSpacing: 0.35 },
  bulletinHeadingWrap: { marginTop: 1, marginBottom: 13 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 2 },
  filterChip: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', backgroundColor: 'rgba(12,12,15,0.46)', paddingHorizontal: 11, paddingVertical: 7 },
  filterText: { color: 'rgba(242,232,213,0.57)', fontSize: 8, fontWeight: '800', letterSpacing: 0.75 },
  emptyBulletin: { minHeight: 147, alignItems: 'center', justifyContent: 'center', padding: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.18)', borderRadius: 16, marginBottom: 10 },
  emptyTitle: { color: '#F4EBDD', fontFamily: 'serif', fontSize: 17, marginTop: 8 },
  emptyCopy: { color: 'rgba(242,232,213,0.56)', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 5, maxWidth: 255 },
  footer: { alignItems: 'center', paddingTop: 17, paddingBottom: 5 },
  footerRule: { width: 48, height: 1, backgroundColor: 'rgba(216,181,106,0.5)', marginBottom: 9 },
  footerText: { color: 'rgba(242,232,213,0.33)', letterSpacing: 1.6, fontSize: 8, fontWeight: '700' },
});
