import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import {
  AppButton,
  HousePicker,
  HouseSigil,
  NoticeStrip,
  OrnatePanel,
  OrnateRule,
  ResponderPips,
  StatusBanner,
  ThemedBackground,
} from '@/components';
import { useAppTheme } from '@/context/ThemeProvider';
import { useQuizSync, useSubmissionGuard } from '@/hooks/useQuizSync';
import {
  ensureDeviceId,
  loadStudentProfile,
  saveStudentProfile,
  type StudentProfile,
} from '@/services/preferences';
import { submitAnswer } from '@/services/quizSync';
import type { HouseId } from '@/services/types';
import { alpha, houseTheme, ink, radii, spacing, typography } from '@/styles/theme';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  STUDENT PORTAL — the buzzer.
 *
 *  Entry captures the learner's name and house (remembered on the device),
 *  then holds a single live question. Answers are written through one atomic
 *  Firebase transaction that enforces the first-10 cutoff.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export default function StudentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { house, selectHouse, theme } = useAppTheme();
  const quiz = useQuizSync();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [checking, setChecking] = useState(true);
  const [name, setName] = useState('');
  const [choice, setChoice] = useState<HouseId>(house);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const guard = useSubmissionGuard(quiz.question?.id);
  const question = quiz.question;
  const buzzing = quiz.status === 'BUZZERS_OPEN';

  useEffect(() => {
    void (async () => {
      const stored = await loadStudentProfile();
      if (stored) {
        setProfile(stored);
        selectHouse(stored.house);
      }
      setChecking(false);
    })();
  }, [selectHouse]);

  const enter = useCallback(async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Write your full name as it appears on your ID.');
      return;
    }
    const saved = await saveStudentProfile({ name: trimmed, house: choice });
    setProfile(saved);
    selectHouse(saved.house);
    setError(null);
  }, [choice, name, selectHouse]);

  const buzz = useCallback(
    async (answer: string) => {
      if (!profile || !question) return;
      const value = answer.trim();
      if (!value) {
        setError('An empty answer cannot be sealed.');
        return;
      }
      if (!buzzing) return;

      setError(null);
      guard.begin();
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      const result = await submitAnswer({
        studentId: profile.id || (await ensureDeviceId()),
        name: profile.name,
        house: profile.house,
        answer: value,
      });

      guard.settle(result, value);
      setText('');
      if (result.status === 'CORRECT_ACCEPTED' && Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    [buzzing, guard, profile, question],
  );

  const identity = (
    <Pressable
      onPress={() => {
        setProfile(null);
        setName('');
        guard.reset();
      }}
      accessibilityRole="button"
      accessibilityLabel="Change my name and house"
      style={styles.identity}
    >
      <View style={[styles.identitySigil, { borderColor: theme.line }]}>
        <HouseSigil house={choice} size={18} color={theme.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.identityName, { color: theme.accent }]} numberOfLines={1}>
          {profile?.name ?? 'Anonymous'}
        </Text>
        <Text style={styles.identityHouse}>
          {houseTheme(choice).name} House · tap to change
        </Text>
      </View>
      <Ionicons name="create-outline" size={16} color={ink.ash} />
    </Pressable>
  );

  /* ── entry card ─────────────────────────────────────────────────────── */
  if (!profile) {
    return (
      <ThemedBackground house={choice} intensity="ambient">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={[
              styles.entryContent,
              { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xxl },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              style={styles.backRow}
            >
              <Ionicons name="chevron-back" size={16} color={ink.ash} />
              <Text style={styles.backText}>GALLERY</Text>
            </Pressable>

            <View style={styles.entryHeader}>
              <HouseSigil house={choice} size={44} color={theme.accent} engraved />
              <Text style={styles.entryTitle}>THE BUZZER</Text>
              <Text style={styles.entrySub}>
                Libertad National High School · Science, Technology &amp; Engineering
              </Text>
            </View>

            <OrnateRule style={{ marginBottom: spacing.lg }} />

            <OrnatePanel tone="raised" house={choice} style={styles.entryPanel}>
              <Text style={styles.fieldLabel}>YOUR NAME</Text>
              <TextInput
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setError(null);
                }}
                placeholder="e.g. Juan Dela Cruz"
                placeholderTextColor={ink.slate}
                selectionColor={theme.primary}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => void enter()}
                style={styles.input}
                accessibilityLabel="Your name"
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={{ height: spacing.lg }} />
              <Text style={styles.fieldLabel}>YOUR HOUSE</Text>
              <HousePicker value={choice} onChange={setChoice} variant="entry" />

              <View style={{ height: spacing.lg }} />
              <AppButton
                label="ENTER THE ARENA"
                icon="flash"
                house={choice}
                onPress={() => void enter()}
                disabled={checking}
              />
              <Text style={styles.entryFootnote}>
                Your name and house stay on this device until you buzz in.
              </Text>
            </OrnatePanel>

            {quiz.question && buzzing ? (
              <View style={{ marginTop: spacing.lg }}>
                <NoticeStrip
                  tone="info"
                  icon="radio"
                  message={`Question ${quiz.question.index} is live now — you can still join before the buzzer closes.`}
                />
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </ThemedBackground>
    );
  }

  /* ── live portal ────────────────────────────────────────────────────── */
  const result = guard.phase === 'done' ? guard : null;

  return (
    <ThemedBackground house={profile.house} intensity="dim">
      <ScrollView
        contentContainerStyle={[
          styles.portalContent,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          style={styles.backRow}
        >
          <Ionicons name="chevron-back" size={16} color={ink.ash} />
          <Text style={styles.backText}>GALLERY</Text>
        </Pressable>

        {identity}

        <View style={{ marginTop: spacing.lg }}>
          <StatusBanner
            status={quiz.status}
            size="lg"
            house={profile.house}
            caption={
              question
                ? `Question ${question.index} · ${question.pointValue} points · ${quiz.correctCount}/${quiz.maxResponders} already banked`
                : undefined
            }
          />
        </View>

        {!question ? (
          <IdleCard theme={theme} />
        ) : (
          <View style={styles.questionPanel}>
            <View style={styles.questionHead}>
              <Text style={styles.questionLabel}>QUESTION {question.index}</Text>
              <View style={[styles.pointPill, { borderColor: alpha(theme.primary, 0.6) }]}>
                <Text style={[styles.pointPillText, { color: theme.accent }]}>
                  {question.pointValue} PTS
                </Text>
              </View>
            </View>

            <Text style={styles.questionText}>{question.text}</Text>

            {guard.phase === 'sending' ? (
              <WaitingCard theme={theme} />
            ) : result ? (
              <ResultCard
                theme={theme}
                status={result.status}
                message={result.message}
                points={result.points}
                answer={result.answer}
                revealed={question.revealedAnswer}
                revealedOptionId={question.revealedOptionId}
                onRetry={guard.reset}
              />
            ) : question.type === 'MULTIPLE_CHOICE' ? (
              <View style={styles.options}>
                {question.options.map((opt) => (
                  <Pressable
                    key={opt.id}
                    disabled={!buzzing}
                    onPress={() => void buzz(opt.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Answer ${opt.id}: ${opt.label}`}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        borderColor: alpha(theme.primary, 0.45),
                        backgroundColor: pressed
                          ? alpha(theme.primary, 0.25)
                          : 'rgba(6,9,15,0.75)',
                      },
                      !buzzing && { opacity: 0.45 },
                    ]}
                  >
                    <View style={[styles.optionKey, { borderColor: theme.line }]}>
                      <Text style={[styles.optionKeyText, { color: theme.accent }]}>
                        {opt.id}
                      </Text>
                    </View>
                    <Text style={styles.optionLabel}>{opt.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={alpha(theme.accent, 0.5)} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.shortWrap}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  editable={buzzing}
                  placeholder="Type your answer…"
                  placeholderTextColor={ink.slate}
                  selectionColor={theme.primary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={() => void buzz(text)}
                  returnKeyType="send"
                  style={[styles.input, { borderColor: alpha(theme.primary, 0.45) }]}
                  accessibilityLabel="Your answer"
                />
                <AppButton
                  label="BUZZ IN"
                  icon="send"
                  house={profile.house}
                  disabled={!buzzing || !text.trim()}
                  onPress={() => void buzz(text)}
                />
              </View>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.pipRow}>
              <ResponderPips
                count={quiz.correctCount}
                max={quiz.maxResponders}
                accent={theme.primary}
              />
              <Text style={styles.pipLabel}>FIRST {quiz.maxResponders} SCORE</Text>
            </View>
          </View>
        )}

        <View style={styles.standingsCard}>
          <Text style={styles.standingsTitle}>HOUSE TALLY</Text>
          <View style={styles.standingsRow}>
            {(['zeus', 'poseidon', 'athena', 'aphrodite'] as HouseId[]).map((id) => {
              const t = houseTheme(id);
              const isMine = id === profile.house;
              return (
                <View
                  key={id}
                  style={[
                    styles.standingsCol,
                    isMine ? { borderColor: t.line } : null,
                  ]}
                >
                  <HouseSigil house={id} size={14} color={t.accent} />
                  <Text style={[styles.standingsName, { color: t.accent }]}>
                    {t.name.toUpperCase()}
                  </Text>
                  <Text style={styles.standingsValue}>{quiz.points[id] ?? 0}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </ThemedBackground>
  );
}

/* ------------------------------------------------------------ sub-views */

function IdleCard({ theme }: { theme: ReturnType<typeof houseTheme> }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 4200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.idleCard}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <HouseSigil house="athena" size={40} color={alpha(theme.accent, 0.6)} />
      </Animated.View>
      <Text style={styles.idleTitle}>STAND BY</Text>
      <Text style={styles.idleBody}>
        No question is on the board. Keep this device awake — the next question
        arrives instantly.
      </Text>
    </View>
  );
}

function WaitingCard({ theme }: { theme: ReturnType<typeof houseTheme> }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });

  return (
    <View style={styles.waiting}>
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <HouseSigil house="athena" size={56} color={theme.accent} />
      </Animated.View>
      <Text style={styles.waitingTitle}>SEALING YOUR ANSWER</Text>
      <ActivityIndicator color={theme.accent} style={{ marginTop: spacing.md }} />
      <Text style={styles.waitingBody}>
        Writing to the realtime ledger… hold still.
      </Text>
    </View>
  );
}

function ResultCard({
  theme,
  status,
  message,
  points,
  answer,
  revealed,
  revealedOptionId,
  onRetry,
}: {
  theme: ReturnType<typeof houseTheme>;
  status: string;
  message: string;
  points: number;
  answer: string;
  revealed: string | null;
  revealedOptionId: string | null;
  onRetry: () => void;
}) {
  const won = status === 'CORRECT_ACCEPTED';
  const tone = won ? '#7BE495' : status === 'FULL' ? '#F0B429' : '#E2807A';

  return (
    <LinearGradient
      colors={[alpha(tone, 0.24), 'rgba(6,9,15,0.9)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.result, { borderColor: alpha(tone, 0.5) }]}
    >
      <Ionicons
        name={won ? 'trophy' : 'information-circle'}
        size={30}
        color={tone}
      />
      <Text style={[styles.resultTitle, { color: tone }]}>
        {won ? `+${points} POINTS` : status === 'FULL' ? 'THE FIRST TEN ARE IN' : 'NOT QUITE'}
      </Text>
      <Text style={styles.resultMessage}>{message}</Text>
      <Text style={styles.resultAnswer} numberOfLines={1}>
        Your answer: {answer.toUpperCase()}
      </Text>
      {revealed ? (
        <Text style={[styles.resultAnswer, { color: tone }]} numberOfLines={2}>
          Correct: {revealed.toUpperCase()}
        </Text>
      ) : revealedOptionId ? (
        <Text style={[styles.resultAnswer, { color: tone }]}>
          Correct: OPTION {revealedOptionId}
        </Text>
      ) : null}

      {won ? (
        <View style={[styles.houseCredit, { borderColor: theme.line }]}>
          <HouseSigil house={theme.id} size={16} color={theme.accent} />
          <Text style={[styles.houseCreditText, { color: theme.accent }]}>
            {theme.name} gains {points} points
          </Text>
        </View>
      ) : (
        <AppButton
          label="SEAL ANOTHER? (ONLY IF ASKED)"
          icon="refresh"
          variant="ghost"
          house={theme.id}
          onPress={onRetry}
          style={{ marginTop: spacing.md }}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  entryContent: { paddingHorizontal: spacing.lg },
  portalContent: { paddingHorizontal: spacing.lg },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  backText: {
    fontFamily: typography.label,
    color: ink.ash,
    fontSize: 10,
    letterSpacing: 3,
  },

  entryHeader: { alignItems: 'center', gap: 6 },
  entryTitle: {
    fontFamily: typography.displayBlack,
    color: ink.vellum,
    fontSize: 30,
    letterSpacing: 7,
  },
  entrySub: {
    fontFamily: typography.script,
    color: ink.bone,
    fontSize: 13,
    textAlign: 'center',
  },
  entryPanel: { paddingTop: spacing.lg },
  entryFootnote: {
    fontFamily: typography.script,
    color: ink.slate,
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  fieldLabel: {
    fontFamily: typography.label,
    color: ink.bone,
    fontSize: 10,
    letterSpacing: 2.4,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(3,5,10,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: ink.vellum,
    fontFamily: typography.body,
    fontSize: 16,
  },
  error: {
    fontFamily: typography.body,
    color: '#E2807A',
    fontSize: 13,
    marginTop: 6,
  },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    backgroundColor: 'rgba(6,8,14,0.6)',
  },
  identitySigil: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityName: {
    fontFamily: typography.display,
    fontSize: 15,
    letterSpacing: 1.4,
  },
  identityHouse: {
    fontFamily: typography.label,
    color: ink.ash,
    fontSize: 10,
    letterSpacing: 1.4,
  },

  questionPanel: { marginTop: spacing.lg, gap: spacing.md },
  questionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  questionLabel: {
    fontFamily: typography.label,
    color: ink.ash,
    fontSize: 11,
    letterSpacing: 3,
  },
  pointPill: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  pointPillText: {
    fontFamily: typography.display,
    fontSize: 11,
    letterSpacing: 2,
  },
  questionText: {
    fontFamily: typography.bodySemibold,
    color: ink.vellum,
    fontSize: 21,
    lineHeight: 29,
  },
  options: { gap: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  optionKey: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionKeyText: { fontFamily: typography.display, fontSize: 15 },
  optionLabel: {
    flex: 1,
    color: ink.vellum,
    fontFamily: typography.body,
    fontSize: 16,
    lineHeight: 21,
  },
  shortWrap: { gap: spacing.md },

  pipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  pipLabel: {
    fontFamily: typography.label,
    color: ink.slate,
    fontSize: 9,
    letterSpacing: 2,
  },

  idleCard: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    backgroundColor: 'rgba(6,8,14,0.6)',
  },
  idleTitle: {
    fontFamily: typography.display,
    color: ink.vellum,
    fontSize: 18,
    letterSpacing: 4,
  },
  idleBody: {
    fontFamily: typography.body,
    color: ink.ash,
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
  },

  waiting: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    backgroundColor: 'rgba(4,6,12,0.7)',
  },
  waitingTitle: {
    fontFamily: typography.display,
    color: ink.vellum,
    fontSize: 15,
    letterSpacing: 3,
    marginTop: spacing.sm,
  },
  waitingBody: {
    fontFamily: typography.script,
    color: ink.ash,
    fontSize: 13,
  },

  result: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  resultTitle: {
    fontFamily: typography.display,
    fontSize: 20,
    letterSpacing: 3,
  },
  resultMessage: {
    fontFamily: typography.body,
    color: ink.bone,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  resultAnswer: {
    fontFamily: typography.label,
    color: ink.ash,
    fontSize: 11,
    letterSpacing: 1.6,
  },
  houseCredit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    marginTop: spacing.sm,
  },
  houseCreditText: {
    fontFamily: typography.label,
    fontSize: 11,
    letterSpacing: 1.4,
  },

  standingsCard: { marginTop: spacing.lg, gap: spacing.sm },
  standingsTitle: {
    fontFamily: typography.label,
    color: ink.ash,
    fontSize: 10,
    letterSpacing: 3.4,
  },
  standingsRow: { flexDirection: 'row', gap: spacing.sm },
  standingsCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.14)',
    backgroundColor: 'rgba(6,8,14,0.65)',
  },
  standingsName: {
    fontFamily: typography.display,
    fontSize: 9.5,
    letterSpacing: 1.2,
  },
  standingsValue: {
    fontFamily: typography.numeral,
    color: ink.vellum,
    fontSize: 17,
  },
});
