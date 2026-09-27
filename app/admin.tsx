import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import ThemedBackground from '../components/ThemedBackground';
import { useHouseTheme } from '../context/HouseThemeContext';
import {
  controlQuizTimer,
  EMPTY_QUIZ,
  EMPTY_STANDINGS,
  getLiveStatus,
  getRemainingSeconds,
  lockOfficerSession,
  publishQuestion,
  QuizPublicState,
  QuizQuestionType,
  revealQuizAnswer,
  restoreOfficerSession,
  setHousePoints,
  Standings,
  subscribeQuizState,
  subscribeStandings,
  unlockOfficerSession,
} from '../services/quizSync';
import { Bulletin, createBulletin, deleteBulletin, subscribeBulletins } from '../services/bulletinSync';
import { COLORS, HOUSE_LIST, HouseFilter } from '../styles/theme';

function Field({ label, children, hint }: React.PropsWithChildren<{ label: string; hint?: string }>) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  busy,
  disabled,
  quiet,
  accent,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  quiet?: boolean;
  accent?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        quiet && styles.quietButton,
        accent ? { borderColor: `${accent}76`, backgroundColor: `${accent}18` } : null,
        (disabled || busy) && styles.disabledButton,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={accent ?? COLORS.gold} /> : <Ionicons name={icon} size={15} color={accent ?? COLORS.gold} />}
      <Text style={[styles.actionText, accent ? { color: accent } : null]}>{label}</Text>
    </Pressable>
  );
}

export default function AdminScreen() {
  const { selectedHouse, selectedTheme } = useHouseTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const stackedLayout = viewportWidth < 820;
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pin, setPin] = useState('');
  const [tab, setTab] = useState<'QUIZBALL' | 'BULLETIN'>('QUIZBALL');
  const [busyKey, setBusyKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [quiz, setQuiz] = useState<QuizPublicState>(EMPTY_QUIZ);
  const [now, setNow] = useState(Date.now());
  const [standings, setStandings] = useState<Standings>(EMPTY_STANDINGS);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [pointDrafts, setPointDrafts] = useState<Record<string, string>>({ ZEUS: '0', POSEIDON: '0', ATHENA: '0', APHRODITE: '0' });

  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<QuizQuestionType>('MULTIPLE_CHOICE');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [pointValue, setPointValue] = useState('10');

  const [bulletinTitle, setBulletinTitle] = useState('');
  const [bulletinBody, setBulletinBody] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [audience, setAudience] = useState<HouseFilter>('ALL');
  const currentStatus = getLiveStatus(quiz, now);
  const currentRemaining = getRemainingSeconds(quiz.timer, now);

  useEffect(() => {
    let mounted = true;
    restoreOfficerSession()
      .then((hasAccess) => { if (mounted) setUnlocked(hasAccess); })
      .catch(() => undefined)
      .finally(() => { if (mounted) setChecking(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const reportError = (serviceError: Error) => setError(serviceError.message || 'Live service is unavailable.');
    const offQuiz = subscribeQuizState(setQuiz, reportError);
    const offScores = subscribeStandings(setStandings, reportError);
    const offBulletins = subscribeBulletins(setBulletins, reportError);
    return () => { offQuiz(); offScores(); offBulletins(); };
  }, []);

  useEffect(() => {
    if (!quiz.timer.isRunning || currentRemaining <= 0) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [quiz.timer.isRunning, quiz.timer.endsAt, currentRemaining]);

  useEffect(() => {
    setPointDrafts({
      ZEUS: String(standings.ZEUS),
      POSEIDON: String(standings.POSEIDON),
      ATHENA: String(standings.ATHENA),
      APHRODITE: String(standings.APHRODITE),
    });
  }, [standings]);

  const latestBulletins = useMemo(() => bulletins.slice(0, 4), [bulletins]);

  async function withBusy(key: string, job: () => Promise<unknown>, successText: string) {
    setBusyKey(key);
    setError('');
    setMessage('');
    try {
      await job();
      setMessage(successText);
    } catch (serviceError) {
      setError(serviceError instanceof Error ? serviceError.message : 'The action could not be completed.');
    } finally {
      setBusyKey('');
    }
  }

  async function handleUnlock() {
    if (!pin.trim()) {
      setError('Enter the officer PIN to continue.');
      return;
    }
    setBusyKey('unlock');
    setError('');
    try {
      await unlockOfficerSession(pin.trim());
      setUnlocked(true);
      setPin('');
      setMessage('Officer session unlocked.');
    } catch (serviceError) {
      setError(serviceError instanceof Error ? serviceError.message : 'Officer access could not be verified.');
    } finally {
      setBusyKey('');
    }
  }

  async function handleLock() {
    setBusyKey('lock');
    setError('');
    setMessage('');
    try {
      await lockOfficerSession();
      setUnlocked(false);
      setMessage('Officer session locked.');
    } catch (serviceError) {
      setError(serviceError instanceof Error ? serviceError.message : 'The officer session could not be locked.');
    } finally {
      setBusyKey('');
    }
  }

  function handlePublishQuestion() {
    const parsedPoints = Number(pointValue);
    const trimmedOptions = options.map((option) => option.trim());
    if (questionType === 'MULTIPLE_CHOICE' && trimmedOptions.some((option) => !option)) {
      setError('Complete all four answer options before publishing.');
      return;
    }
    if (questionType === 'MULTIPLE_CHOICE' && new Set(trimmedOptions.map((option) => option.toLowerCase())).size !== 4) {
      setError('Each answer option must be different.');
      return;
    }
    if (questionType === 'MULTIPLE_CHOICE' && !trimmedOptions.some((option) => option.toLowerCase() === correctAnswer.trim().toLowerCase())) {
      setError('The correct answer must exactly match one of the four options.');
      return;
    }
    if (!Number.isInteger(parsedPoints) || parsedPoints < 1 || parsedPoints > 1000) {
      setError('Point value must be a whole number from 1 to 1,000.');
      return;
    }
    void withBusy('publish-question', async () => {
      await publishQuestion({
        text: questionText.trim(),
        type: questionType,
        options: questionType === 'MULTIPLE_CHOICE' ? trimmedOptions : [],
        correctAnswer: correctAnswer.trim(),
        pointValue: parsedPoints,
      });
      setQuestionText('');
      setOptions(['', '', '', '']);
      setCorrectAnswer('');
      setPointValue('10');
    }, 'Question published privately and synchronized to the event.');
  }

  function handlePublishBulletin() {
    if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate.trim())) {
      setError('Use the date format YYYY-MM-DD, or leave the date blank.');
      return;
    }
    void withBusy('publish-bulletin', async () => {
      await createBulletin({ title: bulletinTitle, body: bulletinBody, audience, eventDate });
      setBulletinTitle('');
      setBulletinBody('');
      setEventDate('');
    }, 'Your weekly bulletin is published.');
  }

  if (!unlocked) {
    return (
      <ThemedBackground house={selectedHouse} imageOpacity={0.52} overlayOpacity={0.95}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.lockHeader}>
            <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
              <Ionicons name="arrow-back" size={17} color="#EEE5D3" />
            </Pressable>
            <Text style={styles.lockHeaderText}>LIBERTAD · OFFICER CONSOLE</Text>
          </View>
          <View style={styles.lockStage}>
            <LinearGradient colors={['rgba(39,33,27,0.96)', 'rgba(13,13,17,0.98)']} style={[styles.lockCard, { borderColor: `${selectedTheme.accent}54` }]}>
              <View style={[styles.lockIcon, { borderColor: `${selectedTheme.accent}66`, backgroundColor: `${selectedTheme.accent}14` }]}>
                <Ionicons name="key-outline" size={23} color={selectedTheme.accent} />
              </View>
              <Text style={styles.lockEyebrow}>OFFICER ACCESS</Text>
              <Text style={styles.lockTitle}>Enter the council</Text>
              <Text style={styles.lockCopy}>Quizball controls and bulletin publishing are reserved for authorized STE officers.</Text>
              <TextInput
                value={pin}
                onChangeText={(value) => { setPin(value); setError(''); }}
                onSubmitEditing={handleUnlock}
                returnKeyType="go"
                autoCapitalize="characters"
                autoCorrect={false}
                secureTextEntry
                placeholder="Officer PIN"
                placeholderTextColor="rgba(243,235,218,0.35)"
                selectionColor={selectedTheme.accent}
                style={styles.input}
                accessibilityLabel="Officer PIN"
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {!error && message ? <Text style={styles.successText}>{message}</Text> : null}
              <Pressable onPress={handleUnlock} disabled={busyKey === 'unlock' || checking} style={[styles.primaryButton, { backgroundColor: selectedTheme.accent }, (busyKey === 'unlock' || checking) && styles.disabledButton]}>
                {busyKey === 'unlock' || checking ? <ActivityIndicator color="#19150E" /> : <Ionicons name="lock-open-outline" size={17} color="#19150E" />}
                <Text style={styles.primaryButtonText}>{checking ? 'CHECKING SESSION' : busyKey === 'unlock' ? 'VERIFYING' : 'UNLOCK CONSOLE'}</Text>
              </Pressable>
              <Text style={styles.lockFootnote}>Access is verified securely by the event server.</Text>
            </LinearGradient>
          </View>
        </SafeAreaView>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground house={selectedHouse} imageOpacity={0.45} overlayOpacity={0.96}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.adminHeader}>
            <View style={styles.adminBrand}>
              <View style={[styles.adminSeal, { borderColor: `${selectedTheme.accent}80` }]}><Ionicons name="settings-outline" size={17} color={selectedTheme.accent} /></View>
              <View>
                <Text style={styles.adminEyebrow}>LIBERTAD · STE</Text>
                <Text style={styles.adminTitle}>Officer console</Text>
              </View>
            </View>
            <ActionButton label="LOCK" icon="lock-closed-outline" onPress={handleLock} busy={busyKey === 'lock'} quiet />
          </View>

          <View style={styles.tabRow}>
            {(['QUIZBALL', 'BULLETIN'] as const).map((item) => (
              <Pressable key={item} onPress={() => { setTab(item); setError(''); setMessage(''); }} style={[styles.tabButton, tab === item && { borderColor: `${selectedTheme.accent}82`, backgroundColor: `${selectedTheme.accent}19` }]}>
                <Ionicons name={item === 'QUIZBALL' ? 'help-circle-outline' : 'newspaper-outline'} size={15} color={tab === item ? selectedTheme.accent : 'rgba(244,235,215,0.48)'} />
                <Text style={[styles.tabText, tab === item && { color: selectedTheme.accent }]}>{item === 'QUIZBALL' ? 'QUIZBALL MANAGER' : 'BULLETIN MANAGER'}</Text>
              </Pressable>
            ))}
          </View>

          {error ? <View style={styles.feedbackError}><Ionicons name="alert-circle-outline" size={16} color="#F08A83" /><Text style={styles.feedbackText}>{error}</Text></View> : null}
          {!error && message ? <View style={styles.feedbackSuccess}><Ionicons name="checkmark-circle-outline" size={16} color={COLORS.success} /><Text style={styles.feedbackText}>{message}</Text></View> : null}

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {tab === 'QUIZBALL' ? (
              <>
                <LinearGradient colors={['rgba(37,32,27,0.94)', 'rgba(15,15,19,0.96)']} style={[styles.currentRound, { borderColor: `${selectedTheme.accent}38` }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionEyebrow}>CURRENT ROUND {quiz.questionNumber ? `· QUESTION ${quiz.questionNumber}` : ''}</Text>
                    <Text style={styles.currentText} numberOfLines={2}>{quiz.questionId ? quiz.text : 'No question has been published.'}</Text>
                  </View>
                  <View style={[styles.roundStatus, { borderColor: `${selectedTheme.accent}45` }]}>
                    <Text style={[styles.roundStatusText, { color: selectedTheme.accent }]}>{currentStatus.replaceAll('_', ' ')}</Text>
                    <Text style={styles.roundStatusSmall}>{quiz.timer.duration ? `${currentRemaining}s LEFT · ` : ''}{quiz.correctAnswersReceived}/{quiz.correctAnswersLimit} CORRECT</Text>
                  </View>
                </LinearGradient>

                <View style={[styles.adminGrid, stackedLayout && styles.adminGridStacked]}>
                  <View style={[styles.mainAdminColumn, stackedLayout && styles.fullWidthColumn]}>
                    <LinearGradient colors={['rgba(33,31,30,0.91)', 'rgba(16,16,20,0.95)']} style={styles.panel}>
                      <View style={styles.panelTitleRow}>
                        <View>
                          <Text style={styles.sectionEyebrow}>COMPOSE A CHALLENGE</Text>
                          <Text style={styles.panelTitle}>Question editor</Text>
                        </View>
                        <Ionicons name="create-outline" size={19} color={selectedTheme.accent} />
                      </View>

                      <View style={styles.segmentRow}>
                        {(['MULTIPLE_CHOICE', 'BLANK/SHORT_ANSWER'] as const).map((type) => {
                          const active = type === questionType;
                          return (
                            <Pressable key={type} onPress={() => setQuestionType(type)} style={[styles.segment, active && { borderColor: `${selectedTheme.accent}75`, backgroundColor: `${selectedTheme.accent}15` }]}>
                              <Text style={[styles.segmentText, active && { color: selectedTheme.accent }]}>{type === 'MULTIPLE_CHOICE' ? 'MULTIPLE CHOICE' : 'BLANK / SHORT ANSWER'}</Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      <Field label="QUESTION TEXT">
                        <TextInput value={questionText} onChangeText={setQuestionText} placeholder="Write the question for the four houses…" placeholderTextColor="rgba(243,235,218,0.32)" multiline textAlignVertical="top" maxLength={1000} style={[styles.input, styles.multiline]} />
                      </Field>

                      {questionType === 'MULTIPLE_CHOICE' ? (
                        <View style={styles.optionsGrid}>
                          {options.map((option, index) => (
                            <Field key={index} label={`OPTION ${String.fromCharCode(65 + index)}`}>
                              <TextInput
                                value={option}
                                onChangeText={(value) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))}
                                placeholder={`Answer ${String.fromCharCode(65 + index)}`}
                                placeholderTextColor="rgba(243,235,218,0.32)"
                                maxLength={250}
                                style={styles.input}
                              />
                            </Field>
                          ))}
                        </View>
                      ) : null}

                      <View style={styles.fieldRow}>
                        <View style={{ flex: 1 }}>
                          <Field label="CORRECT ANSWER · PRIVATE" hint="Never sent to student clients">
                            <TextInput value={correctAnswer} onChangeText={setCorrectAnswer} placeholder="Enter the official answer" placeholderTextColor="rgba(243,235,218,0.32)" secureTextEntry autoCapitalize="sentences" maxLength={300} style={styles.input} />
                          </Field>
                        </View>
                        <View style={styles.pointsField}>
                          <Field label="POINT VALUE">
                            <TextInput value={pointValue} onChangeText={setPointValue} keyboardType="number-pad" maxLength={4} style={styles.input} />
                          </Field>
                        </View>
                      </View>

                      <ActionButton label="PUBLISH QUESTION" icon="paper-plane-outline" onPress={handlePublishQuestion} busy={busyKey === 'publish-question'} accent={selectedTheme.accent} />
                    </LinearGradient>

                    <LinearGradient colors={['rgba(33,31,30,0.91)', 'rgba(16,16,20,0.95)']} style={styles.panel}>
                      <View style={styles.panelTitleRow}>
                        <View>
                          <Text style={styles.sectionEyebrow}>CONTROL THE ARENA</Text>
                          <Text style={styles.panelTitle}>Timer & reveal</Text>
                        </View>
                        <Ionicons name="timer-outline" size={19} color={selectedTheme.accent} />
                      </View>
                      <View style={styles.timerControls}>
                        {([10, 30, 60] as const).map((seconds) => (
                          <ActionButton key={seconds} label={`START ${seconds}s`} icon="play-outline" onPress={() => void withBusy(`timer-${seconds}`, () => controlQuizTimer('start', seconds), `${seconds}-second buzzer opened.`)} busy={busyKey === `timer-${seconds}`} disabled={!quiz.questionId} />
                        ))}
                        <ActionButton label="PAUSE" icon="pause-outline" onPress={() => void withBusy('pause', () => controlQuizTimer('pause'), 'The timer is paused.')} busy={busyKey === 'pause'} disabled={!quiz.questionId} quiet />
                        <ActionButton label="RESET" icon="refresh-outline" onPress={() => void withBusy('reset', () => controlQuizTimer('reset'), 'Timer reset.')} busy={busyKey === 'reset'} disabled={!quiz.questionId} quiet />
                      </View>
                      <View style={styles.revealRow}>
                        <Text style={styles.revealHelp}>Reveal only when judging is complete; the answer then becomes public.</Text>
                        <ActionButton label="REVEAL ANSWER" icon="eye-outline" onPress={() => void withBusy('reveal', revealQuizAnswer, 'The answer is now visible on the live display.')} busy={busyKey === 'reveal'} disabled={!quiz.questionId} accent={selectedTheme.accent} />
                      </View>
                    </LinearGradient>
                  </View>

                  <View style={[styles.scoreAdminColumn, stackedLayout && styles.fullWidthColumn]}>
                    <LinearGradient colors={['rgba(33,31,30,0.91)', 'rgba(16,16,20,0.95)']} style={styles.panel}>
                      <View style={styles.panelTitleRow}>
                        <View>
                          <Text style={styles.sectionEyebrow}>LIVE LEDGER</Text>
                          <Text style={styles.panelTitle}>Manual scores</Text>
                        </View>
                        <Ionicons name="trophy-outline" size={19} color={selectedTheme.accent} />
                      </View>
                      <Text style={styles.panelDescription}>Set a house total. The score board updates instantly for every screen.</Text>
                      {HOUSE_LIST.map((house) => (
                        <View key={house.id} style={[styles.scoreRow, { borderColor: `${house.accent}29` }]}>
                          <View style={[styles.scoreHouseMark, { borderColor: `${house.accent}60`, backgroundColor: `${house.accent}12` }]}>
                            <Text style={[styles.scoreHouseInitial, { color: house.accent }]}>{house.name.slice(0, 1)}</Text>
                          </View>
                          <View style={styles.scoreHouseCopy}>
                            <Text style={styles.scoreHouseName}>{house.name.toUpperCase()}</Text>
                            <Text style={styles.scoreCurrent}>{standings[house.id].toLocaleString()} POINTS</Text>
                          </View>
                          <TextInput
                            value={pointDrafts[house.id]}
                            onChangeText={(value) => setPointDrafts((current) => ({ ...current, [house.id]: value.replace(/[^0-9]/g, '') }))}
                            keyboardType="number-pad"
                            accessibilityLabel={`${house.name} total points`}
                            style={styles.scoreInput}
                          />
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Save ${house.name} points`}
                            onPress={() => {
                              const points = Number(pointDrafts[house.id]);
                              if (!Number.isInteger(points) || points > 1000000) { setError('Enter a whole-number score from 0 to 1,000,000.'); return; }
                              void withBusy(`score-${house.id}`, () => setHousePoints(house.id, points), `${house.name} score updated.`);
                            }}
                            style={[styles.saveScore, { backgroundColor: `${house.accent}1A`, borderColor: `${house.accent}54` }]}
                          >
                            {busyKey === `score-${house.id}` ? <ActivityIndicator size="small" color={house.accent} /> : <Ionicons name="checkmark" size={16} color={house.accent} />}
                          </Pressable>
                        </View>
                      ))}
                    </LinearGradient>
                  </View>
                </View>
              </>
            ) : (
              <View style={[styles.bulletinLayout, stackedLayout && styles.adminGridStacked]}>
                <LinearGradient colors={['rgba(33,31,30,0.91)', 'rgba(16,16,20,0.95)']} style={[styles.panel, styles.bulletinForm, stackedLayout && styles.fullWidthColumn]}>
                  <View style={styles.panelTitleRow}>
                    <View>
                      <Text style={styles.sectionEyebrow}>THE WEEKLY DISPATCH</Text>
                      <Text style={styles.panelTitle}>Publish an event</Text>
                    </View>
                    <Ionicons name="newspaper-outline" size={19} color={selectedTheme.accent} />
                  </View>
                  <Text style={styles.panelDescription}>Send official dates and announcements to the Libertad STE bulletin board.</Text>
                  <Field label="ANNOUNCEMENT TITLE">
                    <TextInput value={bulletinTitle} onChangeText={setBulletinTitle} placeholder="e.g. Quizball opening ceremony" placeholderTextColor="rgba(243,235,218,0.32)" maxLength={120} style={styles.input} />
                  </Field>
                  <Field label="DETAILS">
                    <TextInput value={bulletinBody} onChangeText={setBulletinBody} placeholder="Share the details students need to know…" placeholderTextColor="rgba(243,235,218,0.32)" multiline textAlignVertical="top" maxLength={2000} style={[styles.input, styles.multiline, { minHeight: 130 }]} />
                  </Field>
                  <Field label="EVENT DATE" hint="OPTIONAL · YYYY-MM-DD">
                    <TextInput value={eventDate} onChangeText={setEventDate} placeholder="2026-10-12" placeholderTextColor="rgba(243,235,218,0.32)" keyboardType="numbers-and-punctuation" maxLength={10} style={styles.input} />
                  </Field>
                  <Field label="AUDIENCE">
                    <View style={styles.audienceRow}>
                      {(['ALL', ...HOUSE_LIST.map((house) => house.id)] as HouseFilter[]).map((item) => {
                        const active = audience === item;
                        const itemTheme = item === 'ALL' ? selectedTheme : HOUSE_LIST.find((house) => house.id === item)!;
                        return (
                          <Pressable key={item} onPress={() => setAudience(item)} style={[styles.audienceChip, active && { backgroundColor: `${itemTheme.accent}19`, borderColor: `${itemTheme.accent}78` }]}>
                            <Text style={[styles.audienceText, active && { color: itemTheme.accent }]}>{item}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </Field>
                  <ActionButton label="PUBLISH TO BULLETIN" icon="paper-plane-outline" onPress={handlePublishBulletin} busy={busyKey === 'publish-bulletin'} accent={selectedTheme.accent} />
                </LinearGradient>

                <LinearGradient colors={['rgba(33,31,30,0.91)', 'rgba(16,16,20,0.95)']} style={[styles.panel, styles.latestPanel, stackedLayout && styles.fullWidthColumn]}>
                  <View style={styles.panelTitleRow}>
                    <View>
                      <Text style={styles.sectionEyebrow}>RECENT POSTS</Text>
                      <Text style={styles.panelTitle}>Published notices</Text>
                    </View>
                    <Text style={styles.recentCount}>{bulletins.length}</Text>
                  </View>
                  {latestBulletins.length === 0 ? <Text style={styles.panelDescription}>No notices have been published yet.</Text> : latestBulletins.map((item) => (
                    <View key={item.id} style={styles.recentBulletin}>
                      <View style={styles.recentText}>
                        <Text style={styles.recentTitle} numberOfLines={2}>{item.title}</Text>
                        <Text style={styles.recentMeta}>{item.audience} · {item.eventDate || 'NO DATE'}</Text>
                      </View>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${item.title}`} onPress={() => void withBusy(`delete-${item.id}`, () => deleteBulletin(item.id), 'Bulletin deleted.')} style={styles.deleteButton}>
                        {busyKey === `delete-${item.id}` ? <ActivityIndicator size="small" color="#EF8982" /> : <Ionicons name="trash-outline" size={16} color="#EF8982" />}
                      </Pressable>
                    </View>
                  ))}
                </LinearGradient>
              </View>
            )}
            <View style={styles.adminFooter}><Text style={styles.footerCopy}>LIBERTAD · STE OFFICER ACCESS</Text></View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  lockHeader: { paddingHorizontal: 18, height: 48, flexDirection: 'row', alignItems: 'center', gap: 11 },
  backButton: { width: 33, height: 33, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  lockHeaderText: { color: 'rgba(246,238,222,0.65)', fontSize: 9, fontWeight: '800', letterSpacing: 1.35 },
  lockStage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 18 },
  lockCard: { width: '100%', maxWidth: 430, borderRadius: 22, borderWidth: 1, padding: 24, alignItems: 'center' },
  lockIcon: { height: 52, width: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  lockEyebrow: { color: COLORS.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1.7 },
  lockTitle: { color: '#F6EFDF', fontSize: 27, fontFamily: 'serif', fontWeight: '700', marginTop: 6 },
  lockCopy: { color: 'rgba(246,238,222,0.58)', fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 315, marginTop: 7, marginBottom: 19 },
  input: { minHeight: 44, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 9, color: '#F5EEDF', backgroundColor: 'rgba(5,5,8,0.42)', paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  primaryButton: { minHeight: 46, borderRadius: 9, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 12 },
  primaryButtonText: { color: '#17130D', fontWeight: '900', fontSize: 10, letterSpacing: 1.15 },
  lockFootnote: { color: 'rgba(246,238,222,0.33)', fontSize: 9, marginTop: 15 },
  errorText: { color: '#F08A83', fontSize: 10, lineHeight: 15, alignSelf: 'flex-start', marginTop: 8 },
  successText: { color: COLORS.success, fontSize: 10, lineHeight: 15, alignSelf: 'flex-start', marginTop: 8 },
  adminHeader: { height: 59, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adminBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  adminSeal: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  adminEyebrow: { color: 'rgba(246,238,222,0.44)', fontSize: 8, fontWeight: '800', letterSpacing: 1.35 },
  adminTitle: { color: '#F3EADB', fontFamily: 'serif', fontSize: 17, fontWeight: '700', marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingBottom: 10 },
  tabButton: { minHeight: 39, flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, backgroundColor: 'rgba(8,8,11,0.34)' },
  tabText: { color: 'rgba(244,235,215,0.52)', fontWeight: '800', fontSize: 8, letterSpacing: 0.95 },
  feedbackError: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 18, marginBottom: 8, backgroundColor: 'rgba(200,74,69,0.12)', borderWidth: 1, borderColor: 'rgba(240,138,131,0.30)', borderRadius: 9, padding: 9 },
  feedbackSuccess: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 18, marginBottom: 8, backgroundColor: 'rgba(101,191,145,0.10)', borderWidth: 1, borderColor: 'rgba(125,213,170,0.27)', borderRadius: 9, padding: 9 },
  feedbackText: { flex: 1, color: 'rgba(246,238,222,0.82)', fontSize: 11, lineHeight: 16 },
  content: { paddingHorizontal: 18, paddingBottom: 35, maxWidth: 1200, width: '100%', alignSelf: 'center' },
  currentRound: { borderRadius: 13, borderWidth: 1, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 11 },
  sectionEyebrow: { color: 'rgba(232,195,106,0.73)', fontSize: 8, fontWeight: '800', letterSpacing: 1.35 },
  currentText: { color: '#F1E8D8', fontFamily: 'serif', fontSize: 15, fontWeight: '700', marginTop: 5 },
  roundStatus: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7, alignItems: 'center' },
  roundStatusText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  roundStatusSmall: { color: 'rgba(245,237,221,0.45)', fontSize: 7, letterSpacing: 0.75, marginTop: 3 },
  adminGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  adminGridStacked: { flexDirection: 'column' },
  fullWidthColumn: { flex: 0, width: '100%', minWidth: 0 },
  mainAdminColumn: { flex: 1.5, minWidth: 0 },
  scoreAdminColumn: { flex: 1, minWidth: 285 },
  panel: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)', borderRadius: 15, padding: 14, marginBottom: 11 },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  panelTitle: { color: '#F2EADB', fontFamily: 'serif', fontSize: 19, fontWeight: '700', marginTop: 3 },
  panelDescription: { color: 'rgba(244,235,215,0.54)', fontSize: 11, lineHeight: 17, marginTop: -5, marginBottom: 12 },
  segmentRow: { flexDirection: 'row', gap: 7, marginBottom: 13 },
  segment: { flex: 1, minHeight: 36, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 7 },
  segmentText: { color: 'rgba(245,237,221,0.48)', fontSize: 7, fontWeight: '800', letterSpacing: 0.6, textAlign: 'center' },
  field: { marginBottom: 12 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, gap: 6 },
  fieldLabel: { color: 'rgba(246,238,222,0.58)', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  fieldHint: { color: 'rgba(246,238,222,0.32)', fontSize: 7, letterSpacing: 0.4 },
  multiline: { minHeight: 82, paddingTop: 11, lineHeight: 19 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  pointsField: { width: 102 },
  actionButton: { minHeight: 39, borderWidth: 1, borderColor: 'rgba(216,181,106,0.39)', borderRadius: 8, backgroundColor: 'rgba(216,181,106,0.08)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 10, marginTop: 2 },
  quietButton: { backgroundColor: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.13)' },
  actionText: { color: '#EBD8AE', fontSize: 8, fontWeight: '900', letterSpacing: 0.75 },
  disabledButton: { opacity: 0.38 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
  timerControls: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  revealRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', marginTop: 13, paddingTop: 12 },
  revealHelp: { color: 'rgba(244,235,215,0.44)', flex: 1, fontSize: 9, lineHeight: 14 },
  scoreRow: { borderWidth: 1, borderRadius: 9, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7 },
  scoreHouseMark: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scoreHouseInitial: { fontFamily: 'serif', fontSize: 16, fontWeight: '700' },
  scoreHouseCopy: { flex: 1 },
  scoreHouseName: { color: '#F3EBDC', fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
  scoreCurrent: { color: 'rgba(243,235,218,0.39)', fontSize: 7, marginTop: 3, letterSpacing: 0.65 },
  scoreInput: { width: 70, minHeight: 36, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 7, color: '#F5EEDF', backgroundColor: 'rgba(5,5,8,0.42)', textAlign: 'center', paddingHorizontal: 4, fontSize: 12 },
  saveScore: { height: 32, width: 32, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bulletinLayout: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  bulletinForm: { flex: 1.35, minWidth: 0 },
  latestPanel: { flex: 0.85, minWidth: 255 },
  audienceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  audienceChip: { borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', paddingVertical: 7, paddingHorizontal: 9, backgroundColor: 'rgba(8,8,11,0.32)' },
  audienceText: { color: 'rgba(245,237,221,0.52)', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  recentCount: { color: COLORS.gold, fontSize: 17, fontWeight: '800' },
  recentBulletin: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.09)', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11 },
  recentText: { flex: 1 },
  recentTitle: { color: '#F3EBDC', fontFamily: 'serif', fontSize: 14, fontWeight: '700', lineHeight: 18 },
  recentMeta: { color: 'rgba(243,235,218,0.4)', fontSize: 7, letterSpacing: 0.85, marginTop: 4 },
  deleteButton: { width: 32, height: 32, borderWidth: 1, borderColor: 'rgba(239,137,130,0.27)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  adminFooter: { alignItems: 'center', paddingVertical: 14 },
  footerCopy: { color: 'rgba(244,235,215,0.3)', fontSize: 8, letterSpacing: 1.4, fontWeight: '700' },
});
