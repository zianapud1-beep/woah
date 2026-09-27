import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as KeepAwake from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CountdownRing,
  HouseScoreStrip,
  OrnateRule,
  ResponderPips,
  StatusBanner,
  ThemedBackground,
} from '@/components';
import { useAppTheme } from '@/context/ThemeProvider';
import { useQuizSync } from '@/hooks/useQuizSync';
import { alpha, ink, radii, spacing, typography } from '@/styles/theme';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  QUIZBALL DISPLAY — the projector.
 *
 *  Locked to landscape, high contrast, and driven entirely by Realtime
 *  Database `onValue` pushes. Renders the live question, point value, the
 *  "first 10 correct" counter, the countdown ring and the status banner, with
 *  the running house tally pinned along the bottom.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export default function DisplayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { house, theme } = useAppTheme();
  const quiz = useQuizSync();
  const { width, height } = useWindowDimensions();
  const [chromeVisible, setChromeVisible] = useState(true);

  const landscape = width > height;
  const scale = Math.min(width / 1280, height / 720);

  /* Keep the projector awake and locked in landscape. */
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(
      () => undefined,
    );
    return () => {
      void ScreenOrientation.unlockAsync().catch(() => undefined);
    };
  }, []);

  useKeepAwake();

  const question = quiz.question;
  const urgent =
    quiz.status === 'BUZZERS_OPEN' && quiz.countdown.seconds <= 5 && !quiz.countdown.expired;

  const revealed =
    quiz.status === 'ANSWER_REVEALED' && question
      ? question.type === 'MULTIPLE_CHOICE'
        ? question.revealedOptionId
        : question.revealedAnswer
      : null;

  const flash = useMemo(
    () => new Animated.Value(0),
    [],
  );
  useEffect(() => {
    if (quiz.status !== 'ANSWER_REVEALED') {
      flash.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flash, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(flash, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flash, quiz.status]);

  const flashOpacity = flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] });

  return (
    <ThemedBackground
      house={house}
      intensity="dim"
      animate={!landscape}
      grain={false}
    >
      <StatusBar hidden={!chromeVisible} />
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.primary, opacity: flashOpacity },
        ]}
      />

      <View style={styles.flex}>
        {/* ── top rail ─────────────────────────────────────────────────── */}
        <View style={[styles.topRail, { paddingTop: insets.top + 6 }]}>
          <View style={styles.crest}>
            <Ionicons name="flash" size={16 * Math.max(1, scale)} color={theme.accent} />
          </View>
          <Text style={styles.brand}>STE QUIZBALL</Text>
          <View style={styles.topRule} />
          <Text style={styles.houseTag}>{theme.name.toUpperCase()} HALL</Text>
          <Text style={styles.weekTag}>WEEK OF SCIENCE</Text>
          <Pressable
            onPress={() => setChromeVisible((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Toggle the display chrome"
            style={styles.chromeToggle}
          >
            <Ionicons
              name={chromeVisible ? 'eye-off' : 'eye'}
              size={15}
              color={ink.ash}
            />
          </Pressable>
        </View>

        {/* ── stage ───────────────────────────────────────────────────── */}
        <View style={styles.stage}>
          <View style={styles.leftColumn}>
            <View style={styles.questionNumberRow}>
              <Text style={styles.questionLabel}>QUESTION</Text>
              <Text style={styles.questionNumber}>
                {question ? String(question.index).padStart(2, '0') : '--'}
              </Text>
              {question ? (
                <View
                  style={[
                    styles.pointBadge,
                    { borderColor: alpha(theme.primary, 0.7) },
                  ]}
                >
                  <Text style={[styles.pointValue, { color: theme.accent }]}>
                    {question.pointValue}
                  </Text>
                  <Text style={styles.pointLabel}>PTS</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.questionText} numberOfLines={4} adjustsFontSizeToFit>
              {question
                ? question.text
                : 'The board is dark. The officer is preparing the first question.'}
            </Text>

            {question?.type === 'MULTIPLE_CHOICE' ? (
              <View style={styles.optionsGrid}>
                {question.options.map((opt) => {
                  const isRight = revealed === opt.id;
                  const isWrong = revealed != null && !isRight;
                  return (
                    <View
                      key={opt.id}
                      style={[
                        styles.option,
                        isRight && {
                          borderColor: '#7BE495',
                          backgroundColor: 'rgba(123,228,149,0.16)',
                        },
                        isWrong && { opacity: 0.45 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionKey,
                          { color: isRight ? '#7BE495' : theme.accent },
                        ]}
                      >
                        {opt.id}
                      </Text>
                      <Text style={styles.optionLabel} numberOfLines={2}>
                        {opt.label}
                      </Text>
                      {isRight ? (
                        <Ionicons name="checkmark-circle" size={20} color="#7BE495" />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : question ? (
              <View style={styles.shortAnswer}>
                <Text style={styles.shortLabel}>SHORT ANSWER</Text>
                {revealed ? (
                  <Text style={styles.shortValue}>{String(revealed)}</Text>
                ) : (
                  <Text style={styles.shortHint}>Answers written on the board</Text>
                )}
              </View>
            ) : null}
          </View>

          {/* ── right rail: timer + counter ────────────────────────────── */}
          <View style={styles.rightColumn}>
            <StatusBanner status={quiz.status} size="xl" house={house} />

            <View style={styles.timerWrap}>
              <CountdownRing
                seconds={
                  quiz.status === 'BUZZERS_OPEN' || quiz.status === 'PAUSED'
                    ? quiz.countdown.seconds
                    : question?.timerSeconds ?? 0
                }
                progress={
                  quiz.status === 'BUZZERS_OPEN' ? quiz.countdown.progress : 0
                }
                size={220 * Math.max(0.8, Math.min(1.2, scale))}
                house={house}
                urgent={urgent}
              />
            </View>

            <View style={styles.counterPanel}>
              <Text style={styles.counterLabel}>CORRECT ANSWERS RECEIVED</Text>
              <View style={styles.counterRow}>
                <Text style={[styles.counterValue, { color: theme.accent }]}>
                  {quiz.correctCount}
                </Text>
                <Text style={styles.counterTotal}>
                  / {quiz.maxResponders}
                </Text>
              </View>
              <ResponderPips
                count={quiz.correctCount}
                max={quiz.maxResponders}
                accent={theme.primary}
              />
              <Text style={styles.counterFootnote}>
                First {quiz.maxResponders} correct buzzers score.
              </Text>
            </View>
          </View>
        </View>

        {/* ── bottom rail ─────────────────────────────────────────────── */}
        {chromeVisible ? (
          <View style={{ paddingBottom: insets.bottom }}>
            <HouseScoreStrip points={quiz.points} leader={quiz.leader} />
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>
                {question
                  ? `${question.type === 'MULTIPLE_CHOICE' ? 'MULTIPLE CHOICE' : 'BLANK / SHORT ANSWER'} · ${quiz.status.replace('_', ' ')}`
                  : 'LIBERTAD NATIONAL HIGH SCHOOL · STE DEPARTMENT'}
              </Text>
              <OrnateRule style={styles.footerRule} />
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Leave the display"
                style={styles.exit}
              >
                <Ionicons name="exit-outline" size={12} color={ink.ash} />
                <Text style={styles.exitText}>EXIT</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </ThemedBackground>
  );
}

/** `expo-keep-awake` with a no-op web fallback. */
function useKeepAwake() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    KeepAwake.activateKeepAwakeAsync('quizball-display').catch(() => undefined);
    return () => {
      void KeepAwake.deactivateKeepAwake('quizball-display');
    };
  }, []);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  crest: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: alpha(ink.gold, 0.5),
    backgroundColor: 'rgba(6,8,14,0.7)',
  },
  brand: {
    fontFamily: typography.displayBlack,
    color: ink.vellum,
    fontSize: 18,
    letterSpacing: 5,
  },
  topRule: {
    flex: 1,
    height: 1,
    backgroundColor: alpha(ink.gold, 0.3),
  },
  houseTag: {
    fontFamily: typography.label,
    color: ink.goldBright,
    fontSize: 12,
    letterSpacing: 3,
  },
  weekTag: {
    fontFamily: typography.label,
    color: ink.ash,
    fontSize: 9,
    letterSpacing: 2.4,
  },
  chromeToggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: alpha(ink.gold, 0.35),
    backgroundColor: 'rgba(6,8,14,0.6)',
  },

  stage: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  leftColumn: { flex: 1.6, justifyContent: 'center', gap: spacing.lg },
  questionNumberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  questionLabel: {
    fontFamily: typography.label,
    color: ink.ash,
    fontSize: 11,
    letterSpacing: 4,
  },
  questionNumber: {
    fontFamily: typography.numeral,
    fontSize: 34,
    color: ink.goldBright,
    letterSpacing: 1,
  },
  pointBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: 'rgba(6,8,14,0.7)',
  },
  pointValue: { fontFamily: typography.numeral, fontSize: 18 },
  pointLabel: {
    fontFamily: typography.label,
    color: ink.ash,
    fontSize: 8,
    letterSpacing: 2,
  },
  questionText: {
    fontFamily: typography.bodySemibold,
    color: '#FBF6E9',
    fontSize: 30,
    lineHeight: 40,
  },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '48%',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: alpha(ink.gold, 0.35),
    backgroundColor: 'rgba(8,11,18,0.72)',
  },
  optionKey: {
    fontFamily: typography.display,
    fontSize: 20,
    width: 26,
  },
  optionLabel: {
    flex: 1,
    color: ink.vellum,
    fontFamily: typography.body,
    fontSize: 16,
    lineHeight: 21,
  },
  shortAnswer: {
    alignItems: 'center',
    gap: 6,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: alpha(ink.gold, 0.3),
    backgroundColor: 'rgba(8,11,18,0.7)',
  },
  shortLabel: {
    fontFamily: typography.label,
    color: ink.ash,
    fontSize: 10,
    letterSpacing: 4,
  },
  shortValue: {
    fontFamily: typography.display,
    color: '#7BE495',
    fontSize: 26,
    letterSpacing: 1,
  },
  shortHint: {
    fontFamily: typography.script,
    color: ink.bone,
    fontSize: 15,
  },

  rightColumn: {
    width: 330,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  timerWrap: { alignItems: 'center', justifyContent: 'center' },
  counterPanel: {
    alignItems: 'center',
    gap: 6,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: alpha(ink.gold, 0.3),
    backgroundColor: 'rgba(5,7,13,0.78)',
    width: '100%',
  },
  counterLabel: {
    fontFamily: typography.label,
    color: ink.ash,
    fontSize: 10,
    letterSpacing: 3,
    textAlign: 'center',
  },
  counterRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  counterValue: { fontFamily: typography.numeral, fontSize: 46, lineHeight: 52 },
  counterTotal: {
    fontFamily: typography.display,
    color: ink.ash,
    fontSize: 20,
  },
  counterFootnote: {
    fontFamily: typography.script,
    color: ink.slate,
    fontSize: 11.5,
    textAlign: 'center',
  },

  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  footerText: {
    fontFamily: typography.label,
    color: ink.ash,
    fontSize: 9,
    letterSpacing: 2.4,
  },
  footerRule: { flex: 1 },
  exit: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  exitText: {
    fontFamily: typography.label,
    color: ink.ash,
    fontSize: 10,
    letterSpacing: 2.4,
  },
});
