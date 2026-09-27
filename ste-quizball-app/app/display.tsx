import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { HOUSE_IDS, HOUSES, Fonts, Palette } from '../styles/theme';
import { LiveState, QuizStatus, defaultLiveState } from '../services/types';
import { subscribeToLiveState, markTimeUp } from '../services/quizSync';

const STATUS_META: Record<QuizStatus, { label: string; color: string }> = {
  IDLE: { label: 'STAND BY', color: '#9A917E' },
  BUZZERS_OPEN: { label: '● BUZZERS OPEN', color: '#2ECC71' },
  PAUSED: { label: '❚❚ PAUSED', color: '#F5C542' },
  TIME_UP: { label: 'TIME UP', color: '#E74C3C' },
  ANSWER_REVEALED: { label: 'ANSWER REVEALED', color: '#5DADE2' },
};

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * Landscape projector view. Cast this screen to a TV — it reacts
 * instantly to Firebase state via onValue (no polling).
 */
export default function DisplayScreen() {
  const router = useRouter();
  const [live, setLive] = useState<LiveState>(() => defaultLiveState());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    (async () => {
      try {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );
      } catch {
        /* web / unsupported — layout already favors landscape */
      }
    })();
    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

  useEffect(() => subscribeToLiveState(setLive), []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Any display client auto-closes the buzzers the instant time expires.
  useEffect(() => {
    if (
      live.status === 'BUZZERS_OPEN' &&
      live.timerEndsAt > 0 &&
      now > live.timerEndsAt
    ) {
      markTimeUp().catch(() => {});
    }
  }, [now, live.status, live.timerEndsAt]);

  const remaining =
    live.status === 'BUZZERS_OPEN' && live.timerEndsAt > 0
      ? Math.max(0, Math.ceil((live.timerEndsAt - now) / 1000))
      : live.status === 'PAUSED'
        ? live.pausedRemaining
        : 0;
  const total = Math.max(1, live.timerDuration || 1);
  const timerPct =
    live.status === 'BUZZERS_OPEN'
      ? remaining / total
      : live.status === 'PAUSED'
        ? live.pausedRemaining / total
        : 0;

  const status = STATUS_META[live.status];
  const sorted = [...HOUSE_IDS].sort(
    (a, b) => (live.standings[b] || 0) - (live.standings[a] || 0)
  );
  const winners = Array.from({ length: live.maxWinners || 10 });
  const urgent = live.status === 'BUZZERS_OPEN' && remaining <= 5;

  return (
    <ImageBackground
      source={require('../assets/houses/zeus.jpg')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.scrim}>
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
          {/* top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={22} color={Palette.gold} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>QUIZBALL — LIVE ARENA</Text>
            <View
              style={[
                styles.statusBanner,
                { borderColor: status.color, shadowColor: status.color },
              ]}
            >
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
          </View>

          <View style={styles.content}>
            {/* left: question */}
            <View style={styles.leftCol}>
              <View style={styles.questionCard}>
                <View style={styles.qMetaRow}>
                  <Text style={styles.qNumber}>
                    {live.questionNumber > 0
                      ? `QUESTION ${live.questionNumber}`
                      : 'AWAITING QUESTION'}
                  </Text>
                  <View style={styles.ptsBadge}>
                    <Text style={styles.ptsBadgeText}>
                      {live.pointValue} PTS
                    </Text>
                  </View>
                </View>
                <Text style={styles.qText} numberOfLines={5}>
                  {live.text || 'The officers are preparing the next trial…'}
                </Text>

                {live.type === 'MULTIPLE_CHOICE' &&
                live.options.length > 0 ? (
                  <View style={styles.optionsGrid}>
                    {live.options.map((opt, i) => (
                      <View key={i} style={styles.option}>
                        <View style={styles.letterBadge}>
                          <Text style={styles.letterText}>{LETTERS[i]}</Text>
                        </View>
                        <Text style={styles.optionText} numberOfLines={2}>
                          {opt}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : live.questionNumber > 0 ? (
                  <Text style={styles.blankHint}>
                    ✒ Short answer — type it exactly, heroes.
                  </Text>
                ) : null}

                {live.status === 'ANSWER_REVEALED' && live.revealAnswer ? (
                  <View style={styles.revealBox}>
                    <Ionicons name="eye" size={20} color="#0B1E33" />
                    <Text style={styles.revealText}>{live.revealAnswer}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* right: timer + winners + standings */}
            <View style={styles.rightCol}>
              <View style={styles.timerCard}>
                <Text
                  style={[styles.timerNumber, urgent && styles.timerUrgent]}
                >
                  {live.status === 'BUZZERS_OPEN' || live.status === 'PAUSED'
                    ? remaining
                    : '—'}
                </Text>
                <Text style={styles.timerLabel}>SECONDS</Text>
                <View style={styles.timerTrack}>
                  <LinearGradient
                    colors={
                      urgent
                        ? ['#E74C3C', '#F39C12']
                        : ['#D4AF37', '#F5C542']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.timerFill,
                      { width: `${Math.round(timerPct * 100)}%` },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.winnersCard}>
                <Text style={styles.winnersTitle}>
                  CORRECT ANSWERS RECEIVED
                </Text>
                <Text style={styles.winnersCount}>
                  {live.correctCount} / {live.maxWinners || 10}
                </Text>
                <View style={styles.dots}>
                  {winners.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        i < live.correctCount && styles.dotFilled,
                      ]}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.miniStandings}>
                {sorted.map((h) => (
                  <View key={h} style={styles.miniRow}>
                    <Ionicons
                      name={HOUSES[h].icon as never}
                      size={16}
                      color={HOUSES[h].colors.accent}
                    />
                    <Text style={styles.miniName}>{HOUSES[h].name}</Text>
                    <Text
                      style={[
                        styles.miniPts,
                        { color: HOUSES[h].colors.goldSoft },
                      ]}
                    >
                      {live.standings[h] || 0}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  scrim: { flex: 1, backgroundColor: 'rgba(4, 6, 12, 0.84)' },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: Palette.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    fontFamily: Fonts.display,
    fontSize: 20,
    letterSpacing: 3,
    color: Palette.gold,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  statusBanner: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  statusText: {
    fontFamily: Fonts.displayBlack,
    fontSize: 17,
    letterSpacing: 2,
  },
  content: { flex: 1, flexDirection: 'row', padding: 14, gap: 14 },
  leftCol: { flex: 1.7 },
  rightCol: { flex: 1, gap: 12 },
  questionCard: {
    flex: 1,
    backgroundColor: 'rgba(5,7,14,0.72)',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Palette.cardBorder,
    padding: 22,
  },
  qMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  qNumber: {
    fontFamily: Fonts.display,
    fontSize: 15,
    letterSpacing: 3,
    color: Palette.goldSoft,
  },
  ptsBadge: {
    backgroundColor: Palette.gold,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  ptsBadgeText: {
    fontFamily: Fonts.displayBlack,
    fontSize: 14,
    color: '#1A1405',
  },
  qText: {
    fontFamily: Fonts.display,
    fontSize: 30,
    lineHeight: 38,
    color: Palette.parchment,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  option: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.4)',
    borderRadius: 12,
    padding: 12,
  },
  letterBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: {
    fontFamily: Fonts.displayBlack,
    fontSize: 17,
    color: '#1A1405',
  },
  optionText: {
    flex: 1,
    fontFamily: Fonts.bodySemi,
    fontSize: 19,
    color: Palette.parchment,
  },
  blankHint: {
    fontFamily: Fonts.body,
    fontSize: 20,
    fontStyle: 'italic',
    color: Palette.goldSoft,
    marginTop: 16,
  },
  revealBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#BFE3FF',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  revealText: {
    flex: 1,
    fontFamily: Fonts.displayBlack,
    fontSize: 22,
    color: '#0B1E33',
  },
  timerCard: {
    backgroundColor: 'rgba(5,7,14,0.72)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Palette.cardBorder,
    padding: 14,
    alignItems: 'center',
  },
  timerNumber: {
    fontFamily: Fonts.displayBlack,
    fontSize: 72,
    lineHeight: 76,
    color: Palette.gold,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  timerUrgent: { color: '#F66' },
  timerLabel: {
    fontFamily: Fonts.display,
    fontSize: 12,
    letterSpacing: 4,
    color: Palette.parchmentDim,
    marginBottom: 10,
  },
  timerTrack: {
    width: '100%',
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    overflow: 'hidden',
  },
  timerFill: { height: '100%', borderRadius: 7 },
  winnersCard: {
    backgroundColor: 'rgba(5,7,14,0.72)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Palette.cardBorder,
    padding: 14,
    alignItems: 'center',
  },
  winnersTitle: {
    fontFamily: Fonts.display,
    fontSize: 11,
    letterSpacing: 2,
    color: Palette.goldSoft,
  },
  winnersCount: {
    fontFamily: Fonts.displayBlack,
    fontSize: 30,
    color: Palette.parchment,
    marginVertical: 4,
  },
  dots: { flexDirection: 'row', gap: 7, marginTop: 4 },
  dot: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
  },
  dotFilled: {
    backgroundColor: Palette.gold,
    shadowColor: Palette.gold,
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  miniStandings: {
    backgroundColor: 'rgba(5,7,14,0.72)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Palette.cardBorder,
    padding: 12,
    gap: 6,
  },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniName: {
    flex: 1,
    fontFamily: Fonts.display,
    fontSize: 14,
    color: Palette.parchment,
  },
  miniPts: { fontFamily: Fonts.displayBlack, fontSize: 17 },
});
