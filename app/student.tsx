import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import ThemedBackground from '../components/ThemedBackground';
import HousePicker from '../components/HousePicker';
import { useHouseTheme } from '../context/HouseThemeContext';
import {
  EMPTY_QUIZ,
  getLiveStatus,
  getRemainingSeconds,
  QuizPublicState,
  SubmissionResult,
  submitStudentAnswer,
  subscribeQuizState,
} from '../services/quizSync';
import { COLORS, HouseId, HOUSES, isHouseId } from '../styles/theme';
import { isFirebaseConfigured } from '../services/firebaseConfig';

type StudentProfile = { name: string; house: HouseId };
const PROFILE_KEY = '@libertad-ste/student-profile';
const submissionKey = (questionId: string) => `@libertad-ste/submitted/${questionId}`;

export default function StudentScreen() {
  const { selectedHouse, selectedTheme, setSelectedHouse } = useHouseTheme();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [houseDraft, setHouseDraft] = useState<HouseId>(selectedHouse);
  const [profileError, setProfileError] = useState('');

  const [quiz, setQuiz] = useState<QuizPublicState>(EMPTY_QUIZ);
  const [now, setNow] = useState(Date.now());
  const [answerDraft, setAnswerDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lockedQuestionId, setLockedQuestionId] = useState('');
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [serviceError, setServiceError] = useState('');
  const theme = profile ? HOUSES[profile.house] : selectedTheme;
  const remaining = getRemainingSeconds(quiz.timer, now);
  const status = getLiveStatus(quiz, now);
  const acceptsAnswers = Boolean(profile && quiz.questionId && status === 'BUZZERS_OPEN' && quiz.timer.isRunning && remaining > 0);
  const alreadyAnswered = Boolean(quiz.questionId && lockedQuestionId === quiz.questionId);
  const isAnsweringDisabled = !acceptsAnswers || alreadyAnswered || submitting;

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(PROFILE_KEY)
      .then((value) => {
        if (!mounted || !value) return;
        const parsed = JSON.parse(value) as Partial<StudentProfile>;
        if (typeof parsed.name === 'string' && parsed.name.trim() && isHouseId(parsed.house)) {
          const restored = { name: parsed.name.trim(), house: parsed.house };
          setProfile(restored);
          setNameDraft(restored.name);
          setHouseDraft(restored.house);
          void setSelectedHouse(restored.house);
        }
      })
      .catch(() => undefined)
      .finally(() => { if (mounted) setProfileReady(true); });
    return () => { mounted = false; };
  }, [setSelectedHouse]);

  useEffect(() => {
    const unsubscribe = subscribeQuizState(setQuiz, (error) => setServiceError(error.message));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!quiz.timer.isRunning || remaining <= 0) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [quiz.timer.isRunning, quiz.timer.endsAt, remaining]);

  useEffect(() => {
    setAnswerDraft('');
    setSubmissionResult(null);
    setLockedQuestionId('');
    if (!quiz.questionId) return undefined;
    let active = true;
    AsyncStorage.getItem(submissionKey(quiz.questionId))
      .then((stored) => {
        if (!active || !stored) return;
        try {
          const result = JSON.parse(stored) as SubmissionResult;
          setSubmissionResult(result);
          setLockedQuestionId(quiz.questionId);
        } catch {
          void AsyncStorage.removeItem(submissionKey(quiz.questionId));
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [quiz.questionId]);

  async function saveProfile() {
    const name = nameDraft.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 48) {
      setProfileError('Enter a name between 2 and 48 characters.');
      return;
    }
    const nextProfile: StudentProfile = { name, house: houseDraft };
    try {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
      setProfile(nextProfile);
      setEditingProfile(false);
      setProfileError('');
      await setSelectedHouse(houseDraft);
    } catch {
      setProfileError('Your profile could not be saved on this device. Please try again.');
    }
  }

  async function submitAnswer(answer: string) {
    if (!profile || !quiz.questionId || isAnsweringDisabled) return;
    const trimmed = answer.trim();
    if (!trimmed) {
      setServiceError('Choose or enter an answer before submitting.');
      return;
    }
    setSubmitting(true);
    setServiceError('');
    try {
      const result = await submitStudentAnswer({
        questionId: quiz.questionId,
        name: profile.name,
        house: profile.house,
        answer: trimmed,
      });
      setSubmissionResult(result);
      if (result.locked) {
        setLockedQuestionId(quiz.questionId);
        try {
          await AsyncStorage.setItem(submissionKey(quiz.questionId), JSON.stringify(result));
        } catch {
          // Server-side one-submission enforcement remains authoritative if storage is unavailable.
        }
      } else if (result.code === 'TIME_UP' || result.code === 'BUZZERS_CLOSED') {
        setServiceError(result.message);
      }
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : 'Your answer could not be sent. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!profileReady) {
    return (
      <ThemedBackground house={selectedHouse} imageOpacity={0.43} overlayOpacity={0.96}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingStage}><ActivityIndicator color={selectedTheme.accent} /><Text style={styles.loadingText}>Opening the student portal…</Text></View>
        </SafeAreaView>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground house={theme.id} imageOpacity={0.49} overlayOpacity={0.95}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
              <Ionicons name="arrow-back" size={17} color="#F1E8D6" />
            </Pressable>
            <View style={styles.brandCopy}>
              <Text style={styles.brandEyebrow}>LIBERTAD · STE</Text>
              <Text style={styles.brandTitle}>Student portal</Text>
            </View>
            {profile ? (
              <Pressable onPress={() => { setNameDraft(profile.name); setHouseDraft(profile.house); setEditingProfile((current) => !current); setServiceError(''); }} style={styles.profileButton} accessibilityRole="button" accessibilityLabel="Edit student profile">
                <Ionicons name="person-outline" size={15} color={theme.accent} />
                <Text style={[styles.profileButtonText, { color: theme.accent }]}>{profile.name.split(' ')[0].toUpperCase()}</Text>
              </Pressable>
            ) : <View style={{ width: 68 }} />}
          </View>

          {!profile || editingProfile ? (
            <View style={styles.formStage}>
              <LinearGradient colors={['rgba(39,33,27,0.95)', 'rgba(14,14,18,0.97)']} style={[styles.profileCard, { borderColor: `${theme.accent}53` }]}>
                <View style={[styles.profileSeal, { borderColor: `${theme.accent}60`, backgroundColor: `${theme.accent}14` }]}>
                  <Ionicons name="person-add-outline" size={21} color={theme.accent} />
                </View>
                <Text style={styles.formEyebrow}>{profile ? 'UPDATE YOUR DETAILS' : 'JOIN THE HOUSES'}</Text>
                <Text style={styles.formTitle}>{profile ? 'Your profile' : 'Take your place'}</Text>
                <Text style={styles.formCopy}>Choose the house whose colours and spirit will follow you through the STE event.</Text>
                <Text style={styles.label}>YOUR NAME</Text>
                <TextInput
                  value={nameDraft}
                  onChangeText={(value) => { setNameDraft(value); setProfileError(''); }}
                  placeholder="First and last name"
                  placeholderTextColor="rgba(243,235,218,0.35)"
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={48}
                  returnKeyType="done"
                  onSubmitEditing={() => undefined}
                  style={styles.input}
                  selectionColor={theme.accent}
                />
                <Text style={[styles.label, { marginTop: 17, marginBottom: 9 }]}>YOUR HOUSE</Text>
                <HousePicker value={houseDraft} onChange={setHouseDraft} />
                {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}
                <Pressable onPress={saveProfile} style={[styles.primaryButton, { backgroundColor: HOUSES[houseDraft].accent }]}>
                  <Ionicons name="arrow-forward-circle-outline" size={18} color="#18130E" />
                  <Text style={styles.primaryButtonText}>{profile ? 'SAVE PROFILE' : 'ENTER THE ARENA'}</Text>
                </Pressable>
                <Text style={styles.privacyNote}>Your profile is saved on this device. Only your name, house, and submitted answer are sent when you play.</Text>
              </LinearGradient>
            </View>
          ) : (
            <View style={styles.gameStage}>
              {!isFirebaseConfigured ? (
                <View style={styles.setupBanner}><Ionicons name="information-circle-outline" color={COLORS.gold} size={16} /><Text style={styles.setupText}>Live questions require the event Firebase configuration.</Text></View>
              ) : serviceError ? (
                <View style={styles.errorBanner}><Ionicons name="cloud-offline-outline" color="#F08A83" size={16} /><Text style={styles.bannerText}>{serviceError}</Text></View>
              ) : null}

              <LinearGradient colors={['rgba(43,36,29,0.93)', 'rgba(15,15,19,0.96)']} style={[styles.challengeCard, { borderColor: `${theme.accent}47` }]}>
                <View style={styles.challengeTop}>
                  <View style={[styles.houseBadge, { borderColor: `${theme.accent}63`, backgroundColor: `${theme.accent}13` }]}>
                    <Ionicons name={theme.icon as never} size={15} color={theme.accent} />
                    <Text style={[styles.houseBadgeText, { color: theme.accent }]}>{profile.house}</Text>
                  </View>
                  <View style={styles.challengeMeta}>
                    <Text style={styles.challengeEyebrow}>LIVE QUIZBALL {quiz.questionNumber ? `· QUESTION ${quiz.questionNumber}` : ''}</Text>
                    <Text style={styles.questionType}>{quiz.type === 'BLANK/SHORT_ANSWER' ? 'SHORT ANSWER' : 'MULTIPLE CHOICE'}</Text>
                  </View>
                  <View style={styles.pointsBadge}>
                    <Text style={[styles.pointsNumber, { color: theme.highlight }]}>{quiz.pointValue || '—'}</Text>
                    <Text style={styles.pointsLabel}>PTS</Text>
                  </View>
                </View>

                <View style={styles.challengeDivider} />
                <View style={styles.timerAndCounter}>
                  <View style={[styles.statusChip, status === 'BUZZERS_OPEN' ? styles.openStatus : null]}>
                    <View style={[styles.statusDot, { backgroundColor: status === 'BUZZERS_OPEN' ? COLORS.success : 'rgba(244,235,215,0.43)' }]} />
                    <Text style={[styles.statusText, status === 'BUZZERS_OPEN' && { color: COLORS.success }]}>{status.replaceAll('_', ' ')}</Text>
                  </View>
                  <Text style={styles.counterText}><Ionicons name="checkmark-done-outline" size={13} color={theme.accent} />  {quiz.correctAnswersReceived} / {quiz.correctAnswersLimit} correct answers</Text>
                  {quiz.timer.duration > 0 ? <Text style={[styles.countdownText, { color: remaining <= 5 && remaining > 0 ? '#F18378' : theme.highlight }]}>{remaining}s</Text> : null}
                </View>

                <Text style={styles.questionText}>{quiz.questionId ? quiz.text : 'The next question is being prepared.'}</Text>
                {quiz.status === 'ANSWER_REVEALED' && quiz.revealedAnswer ? (
                  <View style={[styles.revealBanner, { borderColor: `${theme.accent}68` }]}><Text style={[styles.revealLabel, { color: theme.accent }]}>OFFICIAL ANSWER</Text><Text style={styles.revealText}>{quiz.revealedAnswer}</Text></View>
                ) : null}

                {alreadyAnswered ? (
                  <View style={[styles.waitingCard, { borderColor: `${theme.accent}40` }]}>
                    <ActivityIndicator color={submissionResult?.accepted ? COLORS.success : theme.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.waitingTitle}>{submissionResult?.accepted ? 'Answer received' : 'Response recorded'}</Text>
                      <Text style={styles.waitingCopy}>{submissionResult?.message ?? 'Your response is recorded. Keep an eye on the live board.'}</Text>
                    </View>
                    <Ionicons name="hourglass-outline" size={18} color={theme.accent} />
                  </View>
                ) : quiz.type === 'MULTIPLE_CHOICE' ? (
                  <View style={styles.answerOptions}>
                    {quiz.options.slice(0, 4).map((option, index) => (
                      <Pressable
                        key={`${quiz.questionId}-${index}`}
                        accessibilityRole="button"
                        disabled={isAnsweringDisabled}
                        onPress={() => void submitAnswer(option)}
                        style={({ pressed }) => [styles.answerButton, { borderColor: `${theme.accent}46` }, pressed && styles.answerPressed, isAnsweringDisabled && styles.answerDisabled]}
                      >
                        <View style={[styles.optionLetter, { borderColor: `${theme.accent}69`, backgroundColor: `${theme.accent}13` }]}><Text style={[styles.optionLetterText, { color: theme.accent }]}>{String.fromCharCode(65 + index)}</Text></View>
                        <Text style={styles.optionCopy}>{option}</Text>
                        {submitting ? <ActivityIndicator size="small" color={theme.accent} /> : <Ionicons name="chevron-forward" size={15} color="rgba(245,237,221,0.35)" />}
                      </Pressable>
                    ))}
                    {quiz.options.length === 0 ? <Text style={styles.noOptions}>The officer is preparing answer choices.</Text> : null}
                  </View>
                ) : (
                  <View style={styles.shortAnswerArea}>
                    <TextInput
                      value={answerDraft}
                      onChangeText={setAnswerDraft}
                      placeholder="Type your answer…"
                      placeholderTextColor="rgba(243,235,218,0.33)"
                      editable={!isAnsweringDisabled}
                      returnKeyType="send"
                      onSubmitEditing={() => void submitAnswer(answerDraft)}
                      style={[styles.input, styles.answerInput, { borderColor: `${theme.accent}48` }]}
                      selectionColor={theme.accent}
                      maxLength={500}
                    />
                    <Pressable onPress={() => void submitAnswer(answerDraft)} disabled={isAnsweringDisabled} style={[styles.sendButton, { backgroundColor: theme.accent }, isAnsweringDisabled && styles.answerDisabled]}>
                      {submitting ? <ActivityIndicator color="#17130D" /> : <Ionicons name="paper-plane-outline" size={17} color="#17130D" />}
                      <Text style={styles.sendText}>{submitting ? 'SENDING' : 'SUBMIT ANSWER'}</Text>
                    </Pressable>
                  </View>
                )}
                {!acceptsAnswers && !alreadyAnswered && quiz.questionId ? <Text style={styles.closedHint}>{status === 'READY' || status === 'IDLE' ? 'The officer has not opened the buzzers yet.' : status === 'PAUSED' ? 'The round is paused. Wait for the officer to resume.' : 'This round is closed. Look for the next question.'}</Text> : null}
                {submitting ? <Text style={styles.sendingHint}>Sending your response securely…</Text> : null}
              </LinearGradient>

              <View style={styles.studentFoot}>
                <Text style={styles.studentFootText}>PLAY FAIR · THINK CLEAR · REPRESENT YOUR HOUSE</Text>
                <Pressable onPress={() => { setEditingProfile(true); setNameDraft(profile.name); setHouseDraft(profile.house); }}><Text style={[styles.changeProfileText, { color: theme.accent }]}>EDIT PROFILE</Text></Pressable>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: 'rgba(244,235,215,0.55)', fontSize: 12 },
  topBar: { minHeight: 57, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 10 },
  backButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  brandCopy: { flex: 1 },
  brandEyebrow: { color: 'rgba(246,238,222,0.42)', fontSize: 8, letterSpacing: 1.4, fontWeight: '800' },
  brandTitle: { color: '#F2EBDD', fontFamily: 'serif', fontSize: 16, fontWeight: '700', marginTop: 2 },
  profileButton: { maxWidth: 110, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 16, paddingHorizontal: 9, paddingVertical: 7 },
  profileButtonText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.65 },
  formStage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  profileCard: { width: '100%', maxWidth: 500, borderRadius: 20, borderWidth: 1, padding: 20 },
  profileSeal: { width: 43, height: 43, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  formEyebrow: { color: COLORS.gold, fontSize: 8, fontWeight: '900', letterSpacing: 1.7 },
  formTitle: { color: '#F3EBDD', fontFamily: 'serif', fontSize: 26, fontWeight: '700', marginTop: 4 },
  formCopy: { color: 'rgba(244,235,215,0.58)', fontSize: 11, lineHeight: 17, marginTop: 5, marginBottom: 17 },
  label: { color: 'rgba(246,238,222,0.57)', fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginBottom: 6 },
  input: { minHeight: 44, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 9, color: '#F5EEDF', backgroundColor: 'rgba(5,5,8,0.43)', paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  errorText: { color: '#F08A83', fontSize: 10, marginTop: 10 },
  primaryButton: { minHeight: 45, borderRadius: 9, marginTop: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButtonText: { color: '#17130D', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  privacyNote: { color: 'rgba(244,235,215,0.35)', fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 12 },
  gameStage: { flex: 1, width: '100%', maxWidth: 700, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 9, paddingBottom: 9 },
  setupBanner: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: 'rgba(216,181,106,0.26)', borderRadius: 9, backgroundColor: 'rgba(216,181,106,0.09)', padding: 9, marginBottom: 9 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: 'rgba(240,138,131,0.25)', borderRadius: 9, backgroundColor: 'rgba(200,74,69,0.1)', padding: 9, marginBottom: 9 },
  bannerText: { flex: 1, color: 'rgba(246,238,222,0.73)', fontSize: 10, lineHeight: 15 },
  setupText: { flex: 1, color: 'rgba(246,238,222,0.72)', fontSize: 10, lineHeight: 15 },
  challengeCard: { flex: 1, borderWidth: 1, borderRadius: 19, padding: 18, overflow: 'hidden' },
  challengeTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  houseBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 18, paddingHorizontal: 8, paddingVertical: 6 },
  houseBadgeText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.55 },
  challengeMeta: { flex: 1 },
  challengeEyebrow: { color: 'rgba(232,195,106,0.69)', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  questionType: { color: 'rgba(244,235,215,0.42)', fontSize: 7, fontWeight: '800', letterSpacing: 1.05, marginTop: 3 },
  pointsBadge: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(216,181,106,0.36)', alignItems: 'center', justifyContent: 'center' },
  pointsNumber: { fontSize: 15, fontWeight: '900' },
  pointsLabel: { color: 'rgba(244,235,215,0.4)', fontSize: 6, letterSpacing: 0.7 },
  challengeDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.09)', marginVertical: 13 },
  timerAndCounter: { flexDirection: 'row', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 7, paddingVertical: 5 },
  openStatus: { borderColor: 'rgba(125,213,170,0.42)', backgroundColor: 'rgba(125,213,170,0.1)' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: 'rgba(244,235,215,0.53)', fontSize: 7, fontWeight: '900', letterSpacing: 0.6 },
  counterText: { color: 'rgba(244,235,215,0.56)', fontSize: 9, flex: 1 },
  countdownText: { fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] },
  questionText: { color: '#F7EFDF', fontFamily: 'serif', fontSize: 24, lineHeight: 31, fontWeight: '700', marginTop: 17, marginBottom: 15 },
  revealBanner: { borderWidth: 1, borderRadius: 9, backgroundColor: 'rgba(232,195,106,0.08)', padding: 9, marginTop: -4, marginBottom: 12 },
  revealLabel: { fontSize: 7, fontWeight: '900', letterSpacing: 1.2 },
  revealText: { color: '#F8F0E0', fontFamily: 'serif', fontSize: 17, fontWeight: '700', marginTop: 3 },
  answerOptions: { gap: 8 },
  answerButton: { minHeight: 51, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, backgroundColor: 'rgba(7,7,9,0.44)' },
  answerPressed: { backgroundColor: 'rgba(255,255,255,0.08)', transform: [{ scale: 0.99 }] },
  answerDisabled: { opacity: 0.44 },
  optionLetter: { width: 25, height: 25, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  optionLetterText: { fontSize: 9, fontWeight: '900' },
  optionCopy: { color: '#F2EADB', fontSize: 12, lineHeight: 17, flex: 1 },
  noOptions: { color: 'rgba(244,235,215,0.43)', fontSize: 11, padding: 12, textAlign: 'center' },
  shortAnswerArea: { gap: 9 },
  answerInput: { minHeight: 50, fontSize: 14 },
  sendButton: { minHeight: 43, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sendText: { color: '#17130D', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  waitingCard: { minHeight: 73, borderWidth: 1, borderRadius: 11, backgroundColor: 'rgba(9,9,12,0.52)', flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12 },
  waitingTitle: { color: '#F4EBDD', fontFamily: 'serif', fontSize: 15, fontWeight: '700' },
  waitingCopy: { color: 'rgba(244,235,215,0.55)', fontSize: 10, lineHeight: 15, marginTop: 3 },
  closedHint: { color: 'rgba(244,235,215,0.4)', fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 11 },
  sendingHint: { color: 'rgba(244,235,215,0.4)', textAlign: 'center', fontSize: 9, marginTop: 8 },
  studentFoot: { minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  studentFootText: { color: 'rgba(244,235,215,0.33)', fontSize: 7, letterSpacing: 0.85, fontWeight: '800' },
  changeProfileText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
});
