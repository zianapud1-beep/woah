import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  BulletinCard,
  ConnectionBadge,
  HousePicker,
  HouseStandings,
  NoticeStrip,
  OrnatePanel,
  OrnateRule,
  ResponderPips,
  StatusBanner,
  ThemedBackground,
} from '@/components';
import { useAppTheme } from '@/context/ThemeProvider';
import { useBulletin } from '@/hooks/useBulletin';
import { useQuizSync } from '@/hooks/useQuizSync';
import { getDegradedNotice } from '@/services/quizSync';
import { isFirebaseConfigured } from '@/services/firebaseConfig';
import { bulletinHouseToId, type BulletinPost } from '@/services/types';
import {
  HOUSE_ORDER,
  alpha,
  houseTheme,
  ink,
  radii,
  spacing,
  typography,
} from '@/styles/theme';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE GREAT GALLERY — landing page
 *  Live house standings, the house theme switcher, the live question strip
 *  and the weekly bulletin board streamed from Firestore.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const FILTERS = [
  { value: 'ALL' as const, label: 'ALL' },
  { value: 'ZEUS' as const, label: 'ZEUS' },
  { value: 'POSEIDON' as const, label: 'POSEIDON' },
  { value: 'ATHENA' as const, label: 'ATHENA' },
  { value: 'APHRODITE' as const, label: 'APHRODITE' },
];

const CATEGORY_META: Record<
  BulletinPost['category'],
  { label: string; icon: keyof typeof Ionicons.glyphMap; tint: string }
> = {
  EVENT: { label: 'THIS WEEK', icon: 'sparkles', tint: ink.goldBright },
  ANNOUNCEMENT: { label: 'BULLETIN', icon: 'megaphone', tint: ink.bone },
  REMINDER: { label: 'REMINDER', icon: 'alarm', tint: '#F0B429' },
  RESULT: { label: 'RESULT', icon: 'trophy', tint: '#4FC3C7' },
};

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { house, selectHouse, theme } = useAppTheme();
  const quiz = useQuizSync();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const { visible, loading, total } = useBulletin(filter);
  const degraded = getDegradedNotice();

  const onRefresh = useCallback(() => {
    // The feed is push-based; the refresh simply re-reads the cached mirror
    // so officers can confirm the link is alive.
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 650);
  }, []);

  const header = (
    <View>
      {/* ── masthead ─────────────────────────────────────────────────────── */}
      <View style={styles.masthead}>
        <Text style={[styles.kicker, { color: theme.primary }]}>
          LIBERTAD NATIONAL HIGH SCHOOL
        </Text>
        <LinearGradient
          colors={[theme.primary, '#F3D98B', theme.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.titleRule}
        />
        <Text style={styles.title}>STE QUIZBALL</Text>
        <Text style={styles.subtitle}>
          {theme.name} · {theme.stream}
        </Text>
        <View style={styles.mastheadMeta}>
          <ConnectionBadge
            connection={quiz.connection}
            onToggleDemoLink={() => quiz.setDemoOnline(!quiz.connection.online)}
            compact
          />
          <View style={styles.mastheadRight}>
            <Ionicons name="trophy-outline" size={12} color={ink.ash} />
            <Text style={styles.mastheadStat}>
              {quiz.totalPoints} TOTAL
            </Text>
          </View>
        </View>
      </View>

      {/* ── live question strip ──────────────────────────────────────────── */}
      <Pressable
        onPress={() => router.push('/display')}
        accessibilityRole="button"
        accessibilityLabel="Open the Quizball projector display"
      >
        <OrnatePanel
          house={house}
          tone="sunken"
          style={styles.livePanel}
        >
          <View style={styles.liveHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.eyebrow, { color: theme.primary }]}>
                ON THE BOARD NOW
              </Text>
              <Text style={styles.liveQuestion} numberOfLines={2}>
                {quiz.question
                  ? `Q${quiz.question.index} · ${quiz.question.text}`
                  : 'The display is dark. Awaiting the officer.'}
              </Text>
            </View>
            <Ionicons name="tv-outline" size={20} color={theme.accent} />
          </View>

          {quiz.question ? (
            <>
              <StatusBanner
                status={quiz.status}
                size="sm"
                caption={`${quiz.correctCount} of ${quiz.maxResponders} correct answers banked · ${quiz.question.pointValue} pts`}
              />
              <View style={styles.pipRow}>
                <ResponderPips
                  count={quiz.correctCount}
                  max={quiz.maxResponders}
                  accent={theme.primary}
                />
              </View>
            </>
          ) : null}
        </OrnatePanel>
      </Pressable>

      {/* ── standings ────────────────────────────────────────────────────── */}
      <OrnatePanel
        eyebrow="THE TALLY"
        title="HOUSE STANDINGS"
        house={house}
        style={styles.section}
      >
        <HouseStandings points={quiz.points} activeHouse={house} />
      </OrnatePanel>

      {/* ── theme switcher ───────────────────────────────────────────────── */}
      <OrnatePanel
        eyebrow="PROFILE SETTING"
        title="YOUR HOUSE THEME"
        house={house}
        style={styles.section}
      >
        <HousePicker value={house} onChange={selectHouse} />
        <Text style={styles.themeHint}>
          The selected house repaints the gallery, the gilding and your
          bulletin filter.
        </Text>
      </OrnatePanel>

      {/* ── bulletin ─────────────────────────────────────────────────────── */}
      <View style={styles.bulletinHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: CATEGORY_META.EVENT.tint }]}>
            {CATEGORY_META.EVENT.label}
          </Text>
          <Text style={styles.bulletinTitle}>WEEKLY BULLETIN</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{visible.length}</Text>
          <Text style={styles.countLabel}>OF {total}</Text>
        </View>
      </View>

      <OrnateRule style={{ marginBottom: spacing.md }} />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = f.value === filter;
          const target = bulletinHouseToId(f.value);
          const accent = target ? houseTheme(target).primary : ink.gold;
          return (
            <Pressable
              key={f.value}
              onPress={() => setFilter(f.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.filterChip,
                active
                  ? { borderColor: accent, backgroundColor: alpha(accent, 0.2) }
                  : null,
              ]}
            >
              <Text
                style={[styles.filterText, { color: active ? accent : ink.ash }]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      <OrnateRule style={{ marginBottom: spacing.lg }} />
      <Text style={styles.footerTitle}>ENTER THE EVENT</Text>
      <View style={styles.portalRow}>
        <PortalCard
          title="STUDENT"
          caption="BUZZ IN"
          icon="flash"
          house="zeus"
          onPress={() => router.push('/student')}
        />
        <PortalCard
          title="DISPLAY"
          caption="PROJECTOR"
          icon="tv"
          house="athena"
          onPress={() => router.push('/display')}
        />
        <PortalCard
          title="OFFICER"
          caption="CONTROL"
          icon="shield"
          house="aphrodite"
          onPress={() => router.push('/admin')}
        />
      </View>

      {!isFirebaseConfigured ? (
        <View style={{ marginTop: spacing.lg }}>
          <NoticeStrip
            tone="info"
            icon="flask-outline"
            message="Demo mirror active — no Firebase credentials found. The same rules, transactions and first-10 cap run locally; add EXPO_PUBLIC_FIREBASE_* to go live."
          />
        </View>
      ) : null}

      {degraded ? (
        <View style={{ marginTop: spacing.md }}>
          <NoticeStrip message={degraded} />
        </View>
      ) : null}

      <Text style={styles.colophon}>
        Anno Domini MMXXVI · Libertad STE Department
      </Text>
    </View>
  );

  return (
    <ThemedBackground house={house} intensity="ambient">
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <BulletinCard post={item} />}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          <OrnatePanel tone="sunken" style={styles.section}>
            <Text style={styles.emptyTitle}>THE BOARD IS BARE</Text>
            <Text style={styles.emptyBody}>
              {loading
                ? 'Opening the ledger…'
                : 'No bulletins match this filter yet. The faculty moderator publishes here every week.'}
            </Text>
          </OrnatePanel>
        }
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      />
    </ThemedBackground>
  );
}

function PortalCard({
  title,
  caption,
  icon,
  house,
  onPress,
}: {
  title: string;
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
  house: (typeof HOUSE_ORDER)[number];
  onPress: () => void;
}) {
  const theme = houseTheme(house);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title} — ${caption}`}
      style={({ pressed }) => [
        styles.portal,
        { borderColor: alpha(theme.primary, 0.45) },
        pressed ? { opacity: 0.75, transform: [{ scale: 0.98 }] } : null,
      ]}
    >
      <LinearGradient
        colors={[`${theme.primary}22`, 'rgba(6,8,14,0.9)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Ionicons name={icon} size={22} color={theme.accent} />
      <Text style={[styles.portalTitle, { color: theme.accent }]}>{title}</Text>
      <Text style={styles.portalCaption}>{caption}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },

  masthead: { alignItems: 'center', paddingVertical: spacing.sm, gap: 2 },
  kicker: {
    fontFamily: typography.label,
    fontSize: 10,
    letterSpacing: 4,
  },
  titleRule: { width: 180, height: 1, marginVertical: spacing.sm },
  title: {
    fontFamily: typography.displayBlack,
    color: ink.vellum,
    fontSize: 34,
    letterSpacing: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.script,
    color: ink.bone,
    fontSize: 14,
    letterSpacing: 0.6,
  },
  mastheadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
  mastheadRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  mastheadStat: {
    fontFamily: typography.label,
    color: ink.ash,
    fontSize: 10,
    letterSpacing: 2,
  },

  livePanel: { marginTop: spacing.md },
  liveHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  eyebrow: {
    fontFamily: typography.label,
    fontSize: 10,
    letterSpacing: 2.8,
  },
  liveQuestion: {
    fontFamily: typography.bodySemibold,
    color: ink.vellum,
    fontSize: 16,
    lineHeight: 22,
    marginTop: 2,
  },
  pipRow: { alignItems: 'center', marginTop: spacing.md },

  section: { marginTop: spacing.md },

  bulletinHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: spacing.lg,
  },
  bulletinTitle: {
    fontFamily: typography.display,
    color: ink.vellum,
    fontSize: 22,
    letterSpacing: 3,
  },
  countPill: { alignItems: 'flex-end' },
  countText: {
    fontFamily: typography.numeral,
    color: ink.goldBright,
    fontSize: 20,
  },
  countLabel: {
    fontFamily: typography.label,
    color: ink.slate,
    fontSize: 8,
    letterSpacing: 2,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    backgroundColor: 'rgba(6,8,14,0.6)',
  },
  filterText: {
    fontFamily: typography.label,
    fontSize: 10,
    letterSpacing: 1.8,
  },

  emptyTitle: {
    fontFamily: typography.display,
    color: ink.vellum,
    fontSize: 16,
    letterSpacing: 2,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: typography.body,
    color: ink.ash,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },

  footer: { marginTop: spacing.xl },
  footerTitle: {
    fontFamily: typography.display,
    color: ink.bone,
    fontSize: 15,
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  portalRow: { flexDirection: 'row', gap: spacing.md },
  portal: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  portalTitle: {
    fontFamily: typography.display,
    fontSize: 13,
    letterSpacing: 2,
    marginTop: 4,
  },
  portalCaption: {
    fontFamily: typography.label,
    color: ink.ash,
    fontSize: 8,
    letterSpacing: 2,
  },
  colophon: {
    fontFamily: typography.script,
    color: ink.slate,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.xl,
    letterSpacing: 0.6,
  },
  themeHint: {
    fontFamily: typography.body,
    color: ink.ash,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.md,
  },
});
