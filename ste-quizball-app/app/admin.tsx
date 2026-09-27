import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  AppButton,
  ConnectionBadge,
  FormField,
  HouseSigil,
  NoticeStrip,
  OrnateButton,
  OrnatePanel,
  OrnateRule,
  PinGate,
  SegmentedControl,
  StatusBanner,
  ThemedBackground,
} from '@/components';
import { useAppTheme } from '@/context/ThemeProvider';
import { useQuizSync } from '@/hooks/useQuizSync';
import { emptyQuestion, makeOptions, normalizeAnswer } from '@/services/answerLogic';
import {
  adjustHousePoints,
  clearQuestion,
  closeQuestion,
  getDegradedNotice,
  pauseTimer,
  publishQuestion,
  readQuestionCounter,
  resetHousePoints,
  resetTimer,
  revealAnswer,
  startTimer,
} from '@/services/quizSync';
import {
  deleteBulletinPost,
  setBulletinPinned,
  publishBulletinPost,
  subscribeToBulletin,
} from '@/services/bulletinSync';
import { localBackend } from '@/services/localBackend';
import type {
  ActiveQuestion,
  BulletinCategory,
  BulletinHouse,
  BulletinPost,
  QuestionType,
  SecureAnswer,
} from '@/services/types';
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
 *  OFFICER CONTROL PANEL
 *
 *  PIN-protected. Tab 1 pushes questions and drives the buzzer clock,
 *  Tab 2 publishes the weekly bulletin, Tab 3 settles the scoreboard.
 *  The correct answer is written to a separate, officer-only node and is
 *  never included in the payload students receive.
 * ─────────────────────────────────────────────────────────────────────────────
 */

type Tab = 'quiz' | 'bulletin' | 'tally';

const TABS: ReadonlyArray<{ value: Tab; label: string; icon: 'flash' | 'megaphone' | 'trophy' }> = [
  { value: 'quiz', label: 'QUIZBALL', icon: 'flash' },
  { value: 'bulletin', label: 'BULLETIN', icon: 'megaphone' },
  { value: 'tally', label: 'TALLY', icon: 'trophy' },
];

const CATEGORIES: ReadonlyArray<{ value: BulletinCategory; label: string }> = [
  { value: 'EVENT', label: 'EVENT' },
  { value: 'ANNOUNCEMENT', label: 'NOTICE' },
  { value: 'REMINDER', label: 'REMINDER' },
  { value: 'RESULT', label: 'RESULT' },
];

const HOUSE_TARGETS: ReadonlyArray<{ value: BulletinHouse; label: string }> = [
  { value: 'ALL', label: 'ALL' },
  { value: 'ZEUS', label: 'ZEUS' },
  { value: 'POSEIDON', label: 'POSEIDON' },
  { value: 'ATHENA', label: 'ATHENA' },
  { value: 'APHRODITE', label: 'APHRODITE' },
];

function todayIso(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function AdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { house, officerSession, unlockOfficer, lockOfficer } = useAppTheme();
  const quiz = useQuizSync();

  const [tab, setTab] = useState<Tab>('quiz');
  const [pinOpen, setPinOpen] = useState(!officerSession);
  const [posts, setPosts] = useState<BulletinPost[]>([]);

  useEffect(() => subscribeToBulletin(setPosts), []);
  useEffect(() => {
    if (officerSession) setPinOpen(false);
  }, [officerSession]);

  if (pinOpen) {
    return (
      <ThemedBackground house="athena" intensity="ambient">
        <View style={styles.lockedBackdrop}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            style={styles.backRow}
          >
            <Ionicons name="chevron-back" size={16} color={ink.ash} />
            <Text style={styles.backText}>GALLERY</Text>
          </Pressable>
        </View>
        <PinGate
          visible={pinOpen}
          onUnlock={() => {
            unlockOfficer();
            setPinOpen(false);
          }}
          onCancel={() => router.back()}
        />
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground house={house} intensity="dim">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxxl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── header ──────────────────────────────────────────────────── */}
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back to the gallery"
              style={styles.backRow}
            >
              <Ionicons name="chevron-back" size={16} color={ink.ash} />
              <Text style={styles.backText}>GALLERY</Text>
            </Pressable>

            <View style={styles.headerTitle}>
              <HouseSigil house="athena" size={22} color={ink.goldBright} />
              <Text style={styles.title}>OFFICER CONSOLE</Text>
            </View>

            <View style={styles.headerActions}>
              <ConnectionBadge
                connection={quiz.connection}
                onToggleDemoLink={() => quiz.setDemoOnline(!quiz.connection.online)}
                compact
              />
              <Pressable
                onPress={() => {
                  lockOfficer();
                  setPinOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Seal the panel"
                style={styles.lockButton}
              >
                <Ionicons name="lock-closed" size={14} color={ink.ash} />
              </Pressable>
            </View>
          </View>

          {getDegradedNotice() ? (
            <View style={{ marginBottom: spacing.md }}>
              <NoticeStrip message={getDegradedNotice() as string} />
            </View>
          ) : null}

          <SegmentedControl options={TABS} value={tab} onChange={setTab} />

          <View style={{ marginTop: spacing.lg }}>
            {tab === 'quiz' ? <QuizTab /> : null}
            {tab === 'bulletin' ? (
              <BulletinTab posts={posts} onPublish={setPosts} />
            ) : null}
            {tab === 'tally' ? <TallyTab /> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedBackground>
  );
}

/* ════════════════════════════════════════════════════ TAB 1 — QUIZBALL ══ */

function QuizTab() {
  const quiz = useQuizSync();
  const { house, theme } = useAppTheme();
  const live = quiz.question;

  const [type, setType] = useState<QuestionType>('MULTIPLE_CHOICE');
  const [index, setIndex] = useState<number>(1);
  const [text, setText] = useState('');
  const [optionLabels, setOptionLabels] = useState<string[]>(['', '', '', '']);
  const [answer, setAnswer] = useState('');
  const [alternates, setAlternates] = useState('');
  const [correctOption, setCorrectOption] = useState('A');
  const [pointValue, setPointValue] = useState(10);
  const [secret, setSecret] = useState(true);
  const [errors, setErrors] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);

  /* Follow the live question so an officer never pushes a stale board. */
  useEffect(() => {
    if (!live) {
      void readQuestionCounter().then(setIndex);
      return;
    }
    setIndex(live.index + 1);
    setType(live.type);
    setText('');
    setOptionLabels(live.options.map((o) => o.label));
    setAnswer('');
    setAlternates('');
    setCorrectOption('A');
  }, [live?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const options = useMemo(() => makeOptions(optionLabels), [optionLabels]);

  const validation = useMemo(() => {
    if (!text.trim()) return 'The question text is still blank.';
    if (type === 'MULTIPLE_CHOICE') {
      if (options.length < 2) return 'At least two options are required.';
      if (!options.some((o) => o.id === correctOption)) {
        return `Option ${correctOption} is empty — choose a filled option as correct.`;
      }
    } else if (!normalizeAnswer(answer)) {
      return 'The hidden answer cannot be empty.';
    }
    return null;
  }, [answer, correctOption, options, text, type]);

  const push = useCallback(async () => {
    if (validation) {
      setErrors(validation);
      return;
    }
    setErrors(null);
    setPushing(true);

    const draft: ActiveQuestion = {
      ...emptyQuestion(type, index),
      id: `q_${Date.now().toString(36)}`,
      text: text.trim(),
      options: type === 'MULTIPLE_CHOICE' ? options : [],
      pointValue,
      timerSeconds: type === 'SHORT_ANSWER' ? 60 : 30,
    };
    const secure: SecureAnswer = {
      questionId: draft.id,
      answer:
        type === 'MULTIPLE_CHOICE'
          ? correctOption
          : normalizeAnswer(answer),
      alternates:
        type === 'SHORT_ANSWER'
          ? alternates
              .split(',')
              .map((a) => normalizeAnswer(a))
              .filter(Boolean)
          : [],
      optionId: type === 'MULTIPLE_CHOICE' ? correctOption : null,
    };

    try {
      await publishQuestion(draft, secure);
    } catch (error) {
      setErrors(
        error instanceof Error
          ? `Push failed: ${error.message}`
          : 'Push failed — check the database rules.',
      );
    } finally {
      setPushing(false);
    }
  }, [alternates, answer, correctOption, index, options, pointValue, text, type, validation]);

  const canControl = !!live;

  return (
    <View style={{ gap: spacing.md }}>
      {/* live state ------------------------------------------------------ */}
      <OrnatePanel tone="sunken" eyebrow="ON THE BOARD" title="LIVE STATE" icon="flash">
        {live ? (
          <>
            <StatusBanner status={quiz.status} size="sm" />
            <Text style={styles.liveText} numberOfLines={3}>
              Q{live.index} · {live.text}
            </Text>
            <View style={styles.liveMeta}>
              <Text style={styles.liveMetaText}>
                {live.type === 'MULTIPLE_CHOICE'
                  ? 'MULTIPLE CHOICE'
                  : 'BLANK / SHORT ANSWER'}
              </Text>
              <Text style={styles.liveMetaText}>{live.pointValue} PTS</Text>
              <Text style={styles.liveMetaText}>
                {quiz.correctCount}/{quiz.maxResponders} CORRECT
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.liveText}>The display is dark.</Text>
        )}
      </OrnatePanel>

      {/* question builder ------------------------------------------------ */}
      <OrnatePanel eyebrow="BUILD" title="NEW QUESTION" icon="sparkles">
        <View style={{ gap: spacing.md }}>
          <SegmentedControl
            options={[
              { value: 'MULTIPLE_CHOICE' as const, label: 'MULTIPLE CHOICE', icon: 'list' as const },
              { value: 'SHORT_ANSWER' as const, label: 'BLANK / SHORT', icon: 'create' as const },
            ]}
            value={type}
            onChange={(next) => {
              setType(next);
              if (next === 'MULTIPLE_CHOICE' && optionLabels.length !== 4) {
                setOptionLabels(['', '', '', '']);
              }
            }}
          />

          <View style={styles.rowTwo}>
            <View style={{ flex: 1 }}>
              <FormField
                label="Question number"
                value={String(index)}
                onChangeText={(v) => setIndex(Math.max(1, parseInt(v.replace(/\D/g, '') || '1', 10)))}
                keyboardType="number-pad"
                hint="Auto-increments after each push"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>POINT VALUE</Text>
              <View style={styles.stepper}>
                <OrnateButton
                  label="−"
                  onPress={() => setPointValue((p) => Math.max(1, p - 5))}
                  style={{ flex: 1 }}
                  accessibilityLabel="Decrease point value"
                />
                <Text style={styles.stepperValue}>{pointValue}</Text>
                <OrnateButton
                  label="+"
                  onPress={() => setPointValue((p) => Math.min(200, p + 5))}
                  style={{ flex: 1 }}
                  accessibilityLabel="Increase point value"
                />
              </View>
            </View>
          </View>

          <FormField
            label="Question text"
            value={text}
            onChangeText={setText}
            placeholder="Which law relates pressure to the velocity of a fluid?"
            multiline
          />

          {type === 'MULTIPLE_CHOICE' ? (
            <>
              <Text style={styles.label}>OPTIONS — TAP THE LETTER TO MARK IT CORRECT</Text>
              {optionLabels.map((label, i) => {
                const id = String.fromCharCode(65 + i);
                const isCorrect = id === correctOption;
                return (
                  <View key={id} style={styles.optionRow}>
                    <Pressable
                      onPress={() => setCorrectOption(id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isCorrect }}
                      accessibilityLabel={`Mark option ${id} as the correct answer`}
                      style={[
                        styles.optionBadge,
                        isCorrect
                          ? {
                              borderColor: theme.primary,
                              backgroundColor: alpha(theme.primary, 0.25),
                            }
                          : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionBadgeText,
                          { color: isCorrect ? theme.accent : ink.ash },
                        ]}
                      >
                        {isCorrect ? '★' : id}
                      </Text>
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <FormField
                        label={`Option ${id}`}
                        value={label}
                        onChangeText={(v) => {
                          const next = [...optionLabels];
                          next[i] = v;
                          setOptionLabels(next);
                        }}
                        placeholder={`Choice ${id}`}
                      />
                    </View>
                  </View>
                );
              })}
            </>
          ) : (
            <>
              <FormField
                label="Hidden correct answer"
                value={answer}
                onChangeText={setAnswer}
                placeholder="bernoulli"
                autoCapitalize="none"
                autoCorrect={false}
                hint="Stored on an officer-only node — never sent to students."
                trailing={
                  <Pressable
                    onPress={() => setSecret((s) => !s)}
                    accessibilityRole="button"
                    accessibilityLabel={secret ? 'Hide answer' : 'Show answer'}
                  >
                    <Ionicons
                      name={secret ? 'eye-off' : 'eye'}
                      size={15}
                      color={ink.ash}
                    />
                  </Pressable>
                }
              />
              <FormField
                label="Accepted alternates (comma separated)"
                value={alternates}
                onChangeText={setAlternates}
                placeholder="pascal's law, pascals law"
                autoCapitalize="none"
                autoCorrect={false}
                hint="Answers are normalised (trimmed, lowercased) before comparison."
              />
            </>
          )}

          {type === 'SHORT_ANSWER' && secret && answer ? (
            <View style={[styles.secretPreview, { borderColor: theme.line }]}>
              <Text style={[styles.secretText, { color: theme.accent }]}>
                WILL ACCEPT: {normalizeAnswer(answer).toUpperCase()}
              </Text>
            </View>
          ) : null}

          {errors ? <Text style={styles.error}>{errors}</Text> : null}

          <AppButton
            label="PUSH TO DISPLAY"
            icon="cloud-upload"
            house={house}
            loading={pushing}
            onPress={() => void push()}
          />
        </View>
      </OrnatePanel>

      {/* timer + status -------------------------------------------------- */}
      <OrnatePanel eyebrow="CLOCK" title="BUZZER CONTROL" icon="timer">
        <Text style={styles.label}>PRESET DURATION</Text>
        <View style={styles.chipRow}>
          {[10, 30, 60].map((s) => (
            <OrnateButton
              key={s}
              label={`${s}s`}
              style={{ flex: 1 }}
              active={live?.timerSeconds === s}
              onPress={() => void startTimer(s)}
              disabled={!canControl}
            />
          ))}
        </View>

        <View style={styles.chipRow}>
          <OrnateButton
            label="OPEN BUZZERS"
            icon="flash"
            tone="verdigris"
            style={{ flex: 1 }}
            active={quiz.status === 'BUZZERS_OPEN'}
            disabled={!canControl}
            onPress={() => void startTimer(live?.timerSeconds)}
          />
          <OrnateButton
            label="PAUSE"
            icon="pause"
            style={{ flex: 1 }}
            disabled={!canControl || quiz.status !== 'BUZZERS_OPEN'}
            onPress={() => void pauseTimer()}
          />
          <OrnateButton
            label="RESET"
            icon="refresh"
            style={{ flex: 1 }}
            disabled={!canControl}
            onPress={() => void resetTimer()}
          />
        </View>

        <OrnateRule style={{ marginVertical: spacing.sm }} />

        <View style={styles.chipRow}>
          <OrnateButton
            label="REVEAL"
            icon="sparkles"
            style={{ flex: 1 }}
            disabled={!canControl}
            onPress={() => void revealAnswer()}
          />
          <OrnateButton
            label="CLOSE"
            icon="lock-closed"
            style={{ flex: 1 }}
            disabled={!canControl}
            onPress={() => void closeQuestion()}
          />
          <OrnateButton
            label="CLEAR"
            icon="trash"
            tone="crimson"
            style={{ flex: 1 }}
            onPress={() =>
              confirm('Clear the board?', 'The display returns to the idle crest.', () =>
                void clearQuestion(),
              )
            }
          />
        </View>
        <Text style={styles.hint}>
          The clock is enforced on every device: once the deadline passes, the
          transaction refuses late answers even before the officer presses TIME
          UP.
        </Text>
      </OrnatePanel>
    </View>
  );
}

/* ═════════════════════════════════════════════════ TAB 2 — BULLETIN ══ */

function BulletinTab({
  posts,
  onPublish,
}: {
  posts: BulletinPost[];
  onPublish: (posts: BulletinPost[]) => void;
}) {
  const { house, theme } = useAppTheme();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<BulletinHouse>('ALL');
  const [category, setCategory] = useState<BulletinCategory>('EVENT');
  const [eventDate, setEventDate] = useState(todayIso());
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publish = useCallback(async () => {
    if (!title.trim() || !body.trim()) {
      setError('A bulletin needs both a title and a body.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await publishBulletinPost({
        title: title.trim(),
        body: body.trim(),
        house: target,
        category,
        eventDate: eventDate.trim() || todayIso(),
        pinned,
        createdBy: 'Officer Console',
      });
      setTitle('');
      setBody('');
      setPinned(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed.');
    } finally {
      setBusy(false);
    }
  }, [body, category, eventDate, pinned, target, title]);

  return (
    <View style={{ gap: spacing.md }}>
      <OrnatePanel eyebrow="PUBLISH" title="WEEKLY BULLETIN" icon="flower">
        <View style={{ gap: spacing.md }}>
          <FormField
            label="Headline"
            value={title}
            onChangeText={setTitle}
            placeholder="Olympiad of Houses — Day Two Schedule"
          />
          <FormField
            label="Body"
            value={body}
            onChangeText={setBody}
            placeholder="Report to the fabrication lab by 7:30 AM in full regalia…"
            multiline
          />
          <FormField
            label="Event date (yyyy-mm-dd)"
            value={eventDate}
            onChangeText={setEventDate}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.label}>AUDIENCE</Text>
          <View style={styles.chipRow}>
            {HOUSE_TARGETS.map((h) => (
              <OrnateButton
                key={h.value}
                label={h.label}
                style={{ flex: 1 }}
                active={target === h.value}
                onPress={() => setTarget(h.value)}
              />
            ))}
          </View>

          <Text style={styles.label}>CATEGORY</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => (
              <OrnateButton
                key={c.value}
                label={c.label}
                style={{ flex: 1 }}
                active={category === c.value}
                onPress={() => setCategory(c.value)}
              />
            ))}
          </View>

          <Pressable
            onPress={() => setPinned((p) => !p)}
            accessibilityRole="switch"
            accessibilityState={{ checked: pinned }}
            style={styles.switchRow}
          >
            <Ionicons
              name={pinned ? 'pin' : 'pin-outline'}
              size={15}
              color={pinned ? theme.accent : ink.ash}
            />
            <Text style={[styles.switchText, pinned && { color: theme.accent }]}>
              Pin to the top of every house
            </Text>
            <View
              style={[
                styles.switchTrack,
                pinned && { backgroundColor: alpha(theme.primary, 0.35) },
              ]}
            >
              <View
                style={[
                  styles.switchKnob,
                  pinned && { transform: [{ translateX: 18 }] },
                ]}
              />
            </View>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <AppButton
            label="PUBLISH TO THE BOARD"
            icon="newspaper"
            house={house}
            loading={busy}
            onPress={() => void publish()}
          />
        </View>
      </OrnatePanel>

      <OrnatePanel eyebrow="MANAGE" title={`PUBLISHED (${posts.length})`} icon="list">
        {posts.length === 0 ? (
          <Text style={styles.hint}>Nothing published yet.</Text>
        ) : (
          posts.map((post) => (
            <View key={post.id} style={styles.postRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.postTitle} numberOfLines={1}>
                  {post.title}
                </Text>
                <Text style={styles.postMeta}>
                  {post.house} · {post.category} ·{' '}
                  {new Date(post.createdAt).toLocaleDateString('en-PH')}
                </Text>
              </View>
              <Pressable
                onPress={() => void setBulletinPinned(post.id, !post.pinned)}
                accessibilityRole="button"
                accessibilityLabel={post.pinned ? 'Unpin bulletin' : 'Pin bulletin'}
                style={styles.iconButton}
              >
                <Ionicons
                  name={post.pinned ? 'pin' : 'pin-outline'}
                  size={15}
                  color={post.pinned ? ink.goldBright : ink.ash}
                />
              </Pressable>
              <Pressable
                onPress={() =>
                  confirm(
                    'Delete this bulletin?',
                    post.title,
                    () => void deleteBulletinPost(post.id),
                  )
                }
                accessibilityRole="button"
                accessibilityLabel="Delete bulletin"
                style={styles.iconButton}
              >
                <Ionicons name="trash-outline" size={15} color="#E2807A" />
              </Pressable>
            </View>
          ))
        )}
      </OrnatePanel>
    </View>
  );
}

/* ═════════════════════════════════════════════════════ TAB 3 — TALLY ══ */

function TallyTab() {
  const quiz = useQuizSync();
  const { theme } = useAppTheme();
  const [delta, setDelta] = useState('10');
  const amount = parseInt(delta.replace(/\D/g, '') || '0', 10) || 0;

  return (
    <View style={{ gap: spacing.md }}>
      <OrnatePanel eyebrow="MANUAL" title="POINT ADJUSTMENTS" icon="trophy">
        <FormField
          label="Adjustment amount"
          value={delta}
          onChangeText={setDelta}
          keyboardType="number-pad"
          hint="Use a negative number to deduct, e.g. -15"
        />
        <View style={{ height: spacing.md }} />
        {HOUSE_ORDER.map((id) => {
          const t = houseTheme(id);
          return (
            <View key={id} style={styles.adjustRow}>
              <HouseSigil house={id} size={16} color={t.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.adjustName, { color: t.accent }]}>
                  {t.name.toUpperCase()}
                </Text>
                <Text style={styles.adjustValue}>{quiz.points[id] ?? 0} pts</Text>
              </View>
              <OrnateButton
                label={`−${amount}`}
                tone="crimson"
                disabled={amount <= 0}
                onPress={() => void adjustHousePoints(id, -amount)}
                accessibilityLabel={`Deduct ${amount} points from ${t.name}`}
              />
              <OrnateButton
                label={`+${amount}`}
                tone="verdigris"
                disabled={amount <= 0}
                onPress={() => void adjustHousePoints(id, amount)}
                accessibilityLabel={`Add ${amount} points to ${t.name}`}
              />
            </View>
          );
        })}
        <View style={{ height: spacing.md }} />
        <OrnateButton
          label="RESET THE WHOLE SCOREBOARD TO ZERO"
          icon="refresh"
          tone="crimson"
          onPress={() =>
            confirm('Reset all house points?', 'Every tally returns to zero.', () =>
              void resetHousePoints(),
            )
          }
          style={{ paddingVertical: 12 }}
        />
      </OrnatePanel>

      <OrnatePanel eyebrow="MAINTENANCE" title="BACKEND" icon="server">
        <NoticeStrip
          tone="info"
          icon="information-circle"
          message={`Transport: ${quiz.connection.mode === 'firebase' ? 'Firebase Realtime Database + Firestore' : 'Offline classroom mirror'}. Scoring runs in a ${
            quiz.connection.submissionMode === 'cloud-function' ? 'Cloud Function transaction' : 'Realtime Database transaction'
          }.`}
        />
        {quiz.connection.mode === 'demo' ? (
          <>
            <View style={{ height: spacing.md }} />
            <OrnateButton
              label="RESTORE THE DEMO LEDGER"
          icon="color-wand"
              onPress={() =>
                confirm(
                  'Restore demo data?',
                  'Scores, the sample question and the bulletin are reset.',
                  () => void localBackend.resetToSeed(),
                )
              }
              style={{ paddingVertical: 12, borderColor: alpha(theme.primary, 0.4) }}
            />
          </>
        ) : null}
      </OrnatePanel>
    </View>
  );
}

/* ------------------------------------------------------------------ utils */

function confirm(
  title: string,
  message: string,
  onConfirm: () => void,
): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Confirm', style: 'destructive', onPress: onConfirm },
  ]);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg },
  lockedBackdrop: { paddingTop: 60, paddingHorizontal: spacing.lg },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: {
    fontFamily: typography.label,
    color: ink.ash,
    fontSize: 10,
    letterSpacing: 3,
  },
  header: { gap: spacing.sm, marginBottom: spacing.lg },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: {
    fontFamily: typography.display,
    color: ink.vellum,
    fontSize: 19,
    letterSpacing: 3.6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lockButton: {
    padding: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
  },

  liveText: {
    fontFamily: typography.body,
    color: ink.bone,
    fontSize: 15,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  liveMeta: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap' },
  liveMetaText: {
    fontFamily: typography.label,
    color: ink.ash,
    fontSize: 9.5,
    letterSpacing: 1.6,
  },

  label: {
    fontFamily: typography.label,
    color: ink.bone,
    fontSize: 10,
    letterSpacing: 2.2,
    marginBottom: 6,
  },
  rowTwo: { flexDirection: 'row', gap: spacing.md },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperValue: {
    fontFamily: typography.numeral,
    color: ink.vellum,
    fontSize: 20,
    minWidth: 44,
    textAlign: 'center',
  },
  optionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  optionBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  optionBadgeText: {
    fontFamily: typography.display,
    fontSize: 13,
  },
  secretPreview: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  secretText: {
    fontFamily: typography.label,
    fontSize: 11,
    letterSpacing: 1.6,
  },
  error: {
    fontFamily: typography.body,
    color: '#E2807A',
    fontSize: 13,
  },
  hint: {
    fontFamily: typography.script,
    color: ink.slate,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: spacing.md,
  },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  switchText: {
    flex: 1,
    fontFamily: typography.body,
    color: ink.bone,
    fontSize: 14,
  },
  switchTrack: {
    width: 42,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 3,
    justifyContent: 'center',
  },
  switchKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: ink.bone,
  },

  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.12)',
  },
  postTitle: {
    fontFamily: typography.bodySemibold,
    color: ink.vellum,
    fontSize: 14.5,
  },
  postMeta: {
    fontFamily: typography.label,
    color: ink.slate,
    fontSize: 9.5,
    letterSpacing: 1.2,
  },
  iconButton: { padding: 6 },

  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  adjustName: {
    fontFamily: typography.display,
    fontSize: 13,
    letterSpacing: 1.6,
  },
  adjustValue: {
    fontFamily: typography.body,
    color: ink.ash,
    fontSize: 12,
  },
});
