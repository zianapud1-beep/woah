import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import ThemedBackground from '../components/ThemedBackground';
import HouseStandings from '../components/HouseStandings';
import { useHouseTheme } from '../context/HouseThemeContext';
import {
  EMPTY_QUIZ,
  EMPTY_STANDINGS,
  getLiveStatus,
  getRemainingSeconds,
  QuizPublicState,
  Standings,
  subscribeQuizState,
  subscribeStandings,
} from '../services/quizSync';
import { COLORS } from '../styles/theme';
import { isFirebaseConfigured } from '../services/firebaseConfig';

const STATUS_COPY: Record<string, { label: string; color: string }> = {
  BUZZERS_OPEN: { label: 'BUZZERS OPEN', color: '#82E0AC' },
  TIME_UP: { label: 'TIME UP', color: '#F18378' },
  ANSWER_REVEALED: { label: 'ANSWER REVEALED', color: '#E8C36A' },
  PAUSED: { label: 'ROUND PAUSED', color: '#D3B4F4' },
  READY: { label: 'READY FOR THE ROUND', color: '#D6C49B' },
  IDLE: { label: 'AWAITING THE NEXT CHALLENGE', color: '#D6C49B' },
};

export default function DisplayScreen() {
  const { selectedHouse, selectedTheme } = useHouseTheme();
  const { width } = useWindowDimensions();
  const [quiz, setQuiz] = useState<QuizPublicState>(EMPTY_QUIZ);
  const [standings, setStandings] = useState<Standings>(EMPTY_STANDINGS);
  const [now, setNow] = useState(Date.now());
  const pulse = useRef(new Animated.Value(1)).current;
  const remaining = getRemainingSeconds(quiz.timer, now);
  const status = getLiveStatus(quiz, now);
  const statusStyle = STATUS_COPY[status] ?? STATUS_COPY.IDLE;
  const compact = width < 900;
  const hasQuestion = Boolean(quiz.questionId);

  useEffect(() => {
    const offQuiz = subscribeQuizState(setQuiz);
    const offStandings = subscribeStandings(setStandings);
    return () => {
      offQuiz();
      offStandings();
    };
  }, []);

  useEffect(() => {
    if (!quiz.timer.isRunning || remaining <= 0) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [quiz.timer.isRunning, quiz.timer.endsAt, remaining]);

  useEffect(() => {
    if (remaining > 0 && remaining <= 5 && status === 'BUZZERS_OPEN') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.08, duration: 430, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 430, useNativeDriver: true }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    }
    pulse.setValue(1);
  }, [remaining, status, pulse]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    let active = true;
    let previousLock: ScreenOrientation.OrientationLock | null = null;
    ScreenOrientation.getOrientationLockAsync()
      .then((lock) => {
        if (!active) return;
        previousLock = lock;
        return ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (previousLock !== null) void ScreenOrientation.lockAsync(previousLock).catch(() => undefined);
    };
  }, []);

  const timerColor = remaining <= 5 && remaining > 0 ? '#F18378' : selectedTheme.highlight;

  return (
    <ThemedBackground house={selectedHouse} imageOpacity={0.34} overlayOpacity={0.96}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.stage}>
          <View style={styles.header}>
            <View style={styles.brand}>
              <View style={[styles.brandSeal, { borderColor: `${selectedTheme.accent}72` }]}>
                <Ionicons name="sparkles" size={16} color={selectedTheme.accent} />
              </View>
              <View>
                <Text style={styles.kicker}>LIBERTAD NATIONAL HIGH SCHOOL</Text>
                <Text style={styles.brandTitle}>STE <Text style={{ color: selectedTheme.accent }}>QUIZBALL</Text></Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.syncBadge}>
                <View style={[styles.liveDot, { backgroundColor: isFirebaseConfigured ? COLORS.success : '#D3A959' }]} />
                <Text style={styles.syncText}>{isFirebaseConfigured ? 'LIVE EVENT' : 'DEMO VIEW'}</Text>
              </View>
              <Pressable onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="Return to dashboard" style={styles.homeButton}>
                <Ionicons name="home-outline" size={17} color="#F4EBDD" />
              </Pressable>
            </View>
          </View>

          <View style={styles.main}>
            <View style={[styles.scoreColumn, compact && styles.scoreColumnCompact]}>
              <View style={styles.panelHeading}>
                <Text style={styles.panelEyebrow}>THE LIVE LEDGER</Text>
                <Text style={styles.panelTitle}>House scores</Text>
              </View>
              <HouseStandings scores={standings} compact />
            </View>

            <LinearGradient colors={['rgba(42,36,29,0.94)', 'rgba(12,12,16,0.96)']} style={styles.questionPanel}>
              <View pointerEvents="none" style={[styles.questionOrnament, { borderColor: `${selectedTheme.accent}20` }]} />
              <View style={styles.questionHeader}>
                <View>
                  <Text style={styles.questionEyebrow}>CHALLENGE {quiz.questionNumber > 0 ? `NO. ${String(quiz.questionNumber).padStart(2, '0')}` : '· UPCOMING'}</Text>
                  <Text style={styles.questionHeading}>The arena is yours</Text>
                </View>
                <View style={styles.pointBadge}>
                  <Text style={[styles.pointNumber, { color: selectedTheme.highlight }]}>{quiz.pointValue || '—'}</Text>
                  <Text style={styles.pointLabel}>POINTS</Text>
                </View>
              </View>

              <View style={styles.statusRow}>
                <View style={[styles.statusPill, { backgroundColor: `${statusStyle.color}18`, borderColor: `${statusStyle.color}62` }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusStyle.color }]} />
                  <Text style={[styles.statusText, { color: statusStyle.color }]}>{statusStyle.label}</Text>
                </View>
                <View style={styles.answerCount}>
                  <Ionicons name="checkmark-done-outline" size={14} color={selectedTheme.accent} />
                  <Text style={styles.answerCountText}>CORRECT ANSWERS RECEIVED</Text>
                  <Text style={[styles.answerNumber, { color: selectedTheme.highlight }]}>{quiz.correctAnswersReceived} <Text style={styles.answerLimit}>/ {quiz.correctAnswersLimit}</Text></Text>
                </View>
              </View>

              <View style={styles.questionBody}>
                <View style={styles.questionCopy}>
                  <Text style={styles.questionLabel}>{hasQuestion ? 'QUESTION' : 'STAND BY'}</Text>
                  <Text style={[styles.questionText, compact && styles.questionTextCompact]} numberOfLines={4} adjustsFontSizeToFit>
                    {hasQuestion ? quiz.text : 'Your next STE challenge will appear here.'}
                  </Text>
                  {quiz.type === 'MULTIPLE_CHOICE' && quiz.options.length > 0 && (
                    <View style={styles.optionGrid}>
                      {quiz.options.slice(0, 4).map((option, index) => (
                        <View key={`${index}-${option}`} style={[styles.optionCard, { borderColor: `${selectedTheme.accent}32` }]}>
                          <Text style={[styles.optionLetter, { color: selectedTheme.accent }]}>{String.fromCharCode(65 + index)}</Text>
                          <Text style={styles.optionText} numberOfLines={2}>{option}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {status === 'ANSWER_REVEALED' && quiz.revealedAnswer ? (
                    <View style={[styles.revealCard, { borderColor: `${selectedTheme.accent}73` }]}>
                      <Text style={[styles.revealLabel, { color: selectedTheme.accent }]}>THE CORRECT ANSWER</Text>
                      <Text style={styles.revealAnswer}>{quiz.revealedAnswer}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.timerColumn}>
                  <Animated.View style={[styles.timerDisc, { borderColor: `${timerColor}9C`, transform: [{ scale: pulse }] }]}>
                    <LinearGradient colors={['rgba(15,14,16,0.96)', 'rgba(40,33,28,0.9)']} style={styles.timerInner}>
                      <Text style={[styles.timerNumber, { color: timerColor }]}>{quiz.timer.duration ? remaining : '—'}</Text>
                      <Text style={styles.timerUnit}>{quiz.timer.duration ? 'SECONDS' : 'TIMER'}</Text>
                    </LinearGradient>
                  </Animated.View>
                  <View style={styles.timerRule} />
                  <Text style={styles.roundLabel}>{quiz.type === 'BLANK/SHORT_ANSWER' ? 'SHORT ANSWER' : 'MULTIPLE CHOICE'}</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
          <View style={styles.footer}>
            <Text style={styles.footerLeft}>SCIENCE · TECHNOLOGY · ENGINEERING</Text>
            <Text style={styles.footerRight}>KNOWLEDGE IS THE CROWN OF EVERY HOUSE</Text>
          </View>
        </View>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  stage: { flex: 1, paddingHorizontal: 24, paddingTop: 5, paddingBottom: 12, width: '100%', maxWidth: 1600, alignSelf: 'center' },
  header: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandSeal: { height: 36, width: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: 'rgba(246,238,222,0.5)', fontSize: 8, letterSpacing: 1.5, fontWeight: '800' },
  brandTitle: { color: '#F6EFDF', fontSize: 17, fontFamily: 'serif', fontWeight: '700', letterSpacing: 1.15, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  syncBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingVertical: 7, paddingHorizontal: 11 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  syncText: { color: '#EAE2D1', fontSize: 8, fontWeight: '800', letterSpacing: 1.05 },
  homeButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,8,11,0.4)' },
  main: { flex: 1, minHeight: 0, flexDirection: 'row', gap: 16 },
  scoreColumn: { width: '27%', minWidth: 230, maxWidth: 365, justifyContent: 'center' },
  scoreColumnCompact: { width: '29%', minWidth: 210 },
  panelHeading: { marginBottom: 10 },
  panelEyebrow: { color: 'rgba(232,195,106,0.72)', fontSize: 8, letterSpacing: 1.7, fontWeight: '800' },
  panelTitle: { color: '#F3ECDD', fontFamily: 'serif', fontSize: 21, fontWeight: '700', marginTop: 2 },
  questionPanel: { flex: 1, minWidth: 0, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(216,181,106,0.36)', paddingHorizontal: 22, paddingVertical: 17, overflow: 'hidden', justifyContent: 'space-between' },
  questionOrnament: { position: 'absolute', width: 360, height: 360, borderRadius: 180, borderWidth: 1, right: -130, bottom: -208 },
  questionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  questionEyebrow: { color: 'rgba(233,196,108,0.77)', fontSize: 8, fontWeight: '800', letterSpacing: 1.6 },
  questionHeading: { color: '#F4EBDD', fontSize: 21, fontFamily: 'serif', fontWeight: '700', marginTop: 3 },
  pointBadge: { width: 57, height: 57, borderRadius: 29, borderWidth: 1, borderColor: 'rgba(216,181,106,0.36)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(216,181,106,0.08)' },
  pointNumber: { fontSize: 19, fontWeight: '800', fontVariant: ['tabular-nums'] },
  pointLabel: { color: 'rgba(244,235,215,0.53)', fontSize: 6, fontWeight: '800', letterSpacing: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, marginBottom: 7 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 18, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  statusDot: { height: 7, width: 7, borderRadius: 4 },
  statusText: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  answerCount: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' },
  answerCountText: { color: 'rgba(246,238,222,0.55)', fontSize: 7, letterSpacing: 0.75, fontWeight: '800' },
  answerNumber: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  answerLimit: { color: 'rgba(246,238,222,0.47)', fontSize: 10, fontWeight: '500' },
  questionBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 0 },
  questionCopy: { flex: 1, justifyContent: 'center', minWidth: 0 },
  questionLabel: { color: 'rgba(246,238,222,0.38)', fontSize: 8, letterSpacing: 1.5, fontWeight: '800', marginBottom: 7 },
  questionText: { color: '#F8F1E3', fontSize: 32, lineHeight: 39, fontFamily: 'serif', fontWeight: '700', maxWidth: 850 },
  questionTextCompact: { fontSize: 24, lineHeight: 30 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 },
  optionCard: { flex: 1, minWidth: '44%', borderWidth: 1, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(7,7,9,0.40)' },
  optionLetter: { width: 17, height: 17, textAlign: 'center', textAlignVertical: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 9, fontSize: 9, fontWeight: '900', overflow: 'hidden' },
  optionText: { color: 'rgba(246,238,222,0.83)', flex: 1, fontSize: 11, lineHeight: 15 },
  revealCard: { borderWidth: 1, borderRadius: 10, backgroundColor: 'rgba(232,195,106,0.08)', paddingHorizontal: 12, paddingVertical: 8, marginTop: 11 },
  revealLabel: { fontSize: 7, letterSpacing: 1.4, fontWeight: '900' },
  revealAnswer: { color: '#FFF2D2', fontFamily: 'serif', fontSize: 18, fontWeight: '700', marginTop: 3 },
  timerColumn: { alignItems: 'center', justifyContent: 'center', width: 116 },
  timerDisc: { width: 98, height: 98, borderRadius: 49, borderWidth: 2, padding: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(6,6,8,0.55)' },
  timerInner: { flex: 1, width: '100%', borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  timerNumber: { fontSize: 33, fontWeight: '700', fontVariant: ['tabular-nums'], fontFamily: 'serif' },
  timerUnit: { color: 'rgba(246,238,222,0.52)', fontSize: 7, letterSpacing: 1.5, fontWeight: '800', marginTop: -1 },
  timerRule: { width: 25, height: 1, backgroundColor: 'rgba(216,181,106,0.56)', marginTop: 10 },
  roundLabel: { color: 'rgba(246,238,222,0.48)', fontSize: 7, fontWeight: '800', letterSpacing: 0.7, marginTop: 6, textAlign: 'center' },
  footer: { height: 23, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 7 },
  footerLeft: { color: 'rgba(244,235,215,0.32)', fontSize: 7, fontWeight: '800', letterSpacing: 1.4 },
  footerRight: { color: 'rgba(244,235,215,0.32)', fontSize: 7, fontWeight: '800', letterSpacing: 1.4 },
});
