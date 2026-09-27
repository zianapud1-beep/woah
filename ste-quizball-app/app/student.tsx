import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ThemedBackground from '../components/ThemedBackground';
import HouseStandings from '../components/HouseStandings';
import {
  HOUSE_IDS,
  HOUSES,
  Fonts,
  Palette,
} from '../styles/theme';
import type { HouseId } from '../styles/theme';
import {
  LiveState,
  StudentProfile,
  defaultLiveState,
} from '../services/types';
import { subscribeToLiveState, submitAnswer } from '../services/quizSync';
import type { SubmitResult } from '../services/quizSync';

const PROFILE_KEY = 'ste_student_profile';
const LETTERS = ['A', 'B', 'C', 'D'];

const STATUS_LABEL: Record<LiveState['status'], { label: string; color: string }> = {
  IDLE: { label: 'STAND BY', color: '#9A917E' },
  BUZZERS_OPEN: { label: '● BUZZERS OPEN', color: '#2ECC71' },
  PAUSED: { label: '❚❚ PAUSED', color: '#F5C542' },
  TIME_UP: { label: 'TIME UP', color: '#E74C3C' },
  ANSWER_REVEALED: { label: 'ANSWER REVEALED', color: '#5DADE2' },
};

export default function StudentScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [houseInput, setHouseInput] = useState<HouseId>('zeus');
  const [formError, setFormError] = useState('');

  const [live, setLive] = useState<LiveState>(() => defaultLiveState());
  const [now, setNow] = useState(() => Date.now());
  const [answer, setAnswer] = useState('');
  const [mcqChoice, setMcqChoice] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const p = JSON.parse(raw) as StudentProfile;
            if (p?.name && HOUSES[p.house]) {
              setProfile(p);
              setNameInput(p.name);
              setHouseInput(p.house);
            }
          } catch {
            /* corrupted profile — start fresh */
          }
        }
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  useEffect(() => subscribeToLiveState(setLive), []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // Fresh question → fresh answer sheet.
  useEffect(() => {
    setAnswer('');
    setMcqChoice(null);
    setResult(null);
    setSubmitting(false);
  }, [live.questionNumber]);

  async function saveProfile() {
    const name = nameInput.trim();
    if (name.length < 2) {
      setFormError('Enter your full name (2+ characters).');
      return;
    }
    const p: StudentProfile = { name, house: houseInput };
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    setProfile(p);
    setEditing(false);
    setFormError('');
  }

  const myResponder = profile
    ? Object.values(live.responders || {}).find(
        (r) => r.name.trim().toLowerCase() === profile.name.trim().toLowerCase()
      )
    : undefined;

  const success: { position: number; points: number } | null = result?.ok
    ? { position: result.position || 0, points: result.points || 0 }
    : myResponder
      ? { position: myResponder.position, points: live.pointValue }
      : null;

  const canAnswer =
    !!profile &&
    live.questionNumber > 0 &&
    live.status === 'BUZZERS_OPEN' &&
    !success;

  const remaining =
    live.status === 'BUZZERS_OPEN' && live.timerEndsAt > 0
      ? Math.max(0, Math.ceil((live.timerEndsAt - now) / 1000))
      : live.status === 'PAUSED'
        ? live.pausedRemaining
        : 0;
  const timerTotal = Math.max(1, live.timerDuration || 1);
  const timerPct =
    live.status === 'BUZZERS_OPEN' || live.status === 'PAUSED'
      ? remaining / timerTotal
      : 0;

  async function handleMCQ(i: number) {
    if (!profile || submitting || !canAnswer) return;
    setMcqChoice(i);
    setSubmitting(true);
    const res = await submitAnswer({
      name: profile.name,
      house: profile.house,
      answer: live.options[i] || '',
    });
    setResult(res);
    setSubmitting(false);
  }

  async function handleBlank() {
    if (!profile || submitting || !canAnswer) return;
    if (!answer.trim()) {
      setResult({
        ok: false,
        code: 'ERROR',
        message: 'Write your answer first, hero.',
      });
      return;
    }
    setSubmitting(true);
    const res = await submitAnswer({
      name: profile.name,
      house: profile.house,
      answer,
    });
    setResult(res);
    setSubmitting(false);
  }

  const status = STATUS_LABEL[live.status];

  if (!ready) {
    return (
      <ThemedBackground>
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={Palette.gold} />
        </View>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={22} color={Palette.gold} />
            </TouchableOpacity>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>ANSWER PORTAL</Text>
              <Text style={styles.headerSub}>First 10 correct win glory</Text>
            </View>
            <Ionicons name="phone-portrait" size={26} color={Palette.gold} />
          </View>

          {!profile || editing ? (
            /* ---------------- identity card ---------------- */
            <View style={styles.card}>
              <Ionicons
                name="person-circle-outline"
                size={52}
                color={Palette.gold}
                style={styles.centerIcon}
              />
              <Text style={styles.cardTitle}>DECLARE YOURSELF, HERO</Text>
              <Text style={styles.hint}>
                Your name is etched into the winners circle — spell it exactly
                as your house knows you.
              </Text>
              <Text style={styles.fieldLabel}>FULL NAME</Text>
              <TextInput
                value={nameInput}
                onChangeText={(t) => {
                  setNameInput(t);
                  setFormError('');
                }}
                placeholder="e.g. Maria Santos"
                placeholderTextColor={Palette.muted}
                autoCapitalize="words"
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>YOUR HOUSE</Text>
              <View style={styles.houseGrid}>
                {HOUSE_IDS.map((h: HouseId) => {
                  const t = HOUSES[h];
                  const active = houseInput === h;
                  return (
                    <TouchableOpacity
                      key={h}
                      style={[
                        styles.housePick,
                        active && { borderColor: t.colors.accent },
                      ]}
                      onPress={() => setHouseInput(h)}
                      activeOpacity={0.85}
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
                          size={22}
                          color={t.colors.accent}
                        />
                      </View>
                      <Text
                        style={[
                          styles.housePickName,
                          active && { color: t.colors.accent },
                        ]}
                      >
                        {t.name.toUpperCase()}
                      </Text>
                      <Text style={styles.housePickDomain} numberOfLines={1}>
                        {t.epithet}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {formError ? (
                <Text style={styles.formError}>{formError}</Text>
              ) : null}
              <TouchableOpacity
                onPress={saveProfile}
                style={styles.goldBtn}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#F3D97B', '#D4AF37', '#8A6D1F']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.goldInner}
                >
                  <Ionicons name="enter-outline" size={18} color="#1A1405" />
                  <Text style={styles.goldText}>ENTER THE ARENA</Text>
                </LinearGradient>
              </TouchableOpacity>
              {editing && profile ? (
                <TouchableOpacity
                  onPress={() => {
                    setEditing(false);
                    setNameInput(profile.name);
                    setHouseInput(profile.house);
                    setFormError('');
                  }}
                  style={styles.ghostBtn}
                >
                  <Text style={styles.ghostText}>CANCEL</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            /* ---------------- live portal ---------------- */
            <View>
              <View style={styles.profileBar}>
                <View
                  style={[
                    styles.profileOrb,
                    {
                      borderColor: HOUSES[profile.house].colors.accent,
                      backgroundColor: HOUSES[profile.house].colors.primary,
                    },
                  ]}
                >
                  <Ionicons
                    name={HOUSES[profile.house].icon as never}
                    size={18}
                    color={HOUSES[profile.house].colors.accent}
                  />
                </View>
                <View style={styles.profileText}>
                  <Text style={styles.profileName} numberOfLines={1}>
                    {profile.name}
                  </Text>
                  <Text
                    style={[
                      styles.profileHouse,
                      { color: HOUSES[profile.house].colors.accent },
                    ]}
                  >
                    HOUSE {HOUSES[profile.house].name.toUpperCase()}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setEditing(true)}
                  hitSlop={10}
                >
                  <Ionicons
                    name="pencil-outline"
                    size={20}
                    color={Palette.goldSoft}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.card}>
                <View style={styles.qMetaRow}>
                  <Text style={styles.qNumber}>
                    {live.questionNumber > 0
                      ? `QUESTION ${live.questionNumber}`
                      : 'STAND BY'}
                  </Text>
                  <View
                    style={[styles.statusPill, { borderColor: status.color }]}
                  >
                    <Text
                      style={[styles.statusPillText, { color: status.color }]}
                    >
                      {status.label}
                    </Text>
                  </View>
                </View>

                {live.questionNumber > 0 ? (
                  <View>
                    <View style={styles.qMetaRow}>
                      <Text style={styles.typeTag}>
                        {live.type === 'MULTIPLE_CHOICE'
                          ? '◉ MULTIPLE CHOICE'
                          : '✒ SHORT ANSWER'}
                      </Text>
                      <Text style={styles.ptsTag}>
                        {live.pointValue} PTS EACH
                      </Text>
                    </View>
                    <Text style={styles.qText}>{live.text}</Text>

                    {(live.status === 'BUZZERS_OPEN' ||
                      live.status === 'PAUSED') && (
                      <View style={styles.timerWrap}>
                        <View style={styles.timerRow}>
                          <Ionicons
                            name="timer-outline"
                            size={18}
                            color={Palette.goldSoft}
                          />
                          <Text style={styles.timerText}>
                            {remaining}s remaining
                          </Text>
                          <Text style={styles.winnersMini}>
                            ✓ {live.correctCount}/{live.maxWinners || 10}
                          </Text>
                        </View>
                        <View style={styles.timerTrack}>
                          <View
                            style={[
                              styles.timerFill,
                              { width: `${Math.round(timerPct * 100)}%` },
                            ]}
                          />
                        </View>
                      </View>
                    )}

                    {success ? (
                      <View style={styles.lockedBox}>
                        <Ionicons
                          name="trophy"
                          size={44}
                          color={Palette.gold}
                        />
                        <Text style={styles.lockedTitle}>
                          WINNER #{success.position}!
                        </Text>
                        <Text style={styles.lockedSub}>
                          +{success.points} pts for House{' '}
                          {HOUSES[profile.house].name}
                        </Text>
                        <View style={styles.waitingRow}>
                          <Ionicons
                            name="hourglass-outline"
                            size={16}
                            color={Palette.goldSoft}
                          />
                          <Text style={styles.waitingText}>
                            Answer locked in — await the reveal…
                          </Text>
                        </View>
                      </View>
                    ) : live.status === 'BUZZERS_OPEN' ? (
                      <View>
                        {live.type === 'MULTIPLE_CHOICE' ? (
                          <View style={styles.mcqList}>
                            {live.options.map((opt, i) => (
                              <TouchableOpacity
                                key={i}
                                style={[
                                  styles.mcqBtn,
                                  mcqChoice === i && styles.mcqBtnPicked,
                                ]}
                                onPress={() => handleMCQ(i)}
                                disabled={submitting}
                                activeOpacity={0.85}
                              >
                                <View style={styles.letterBadge}>
                                  <Text style={styles.letterText}>
                                    {LETTERS[i]}
                                  </Text>
                                </View>
                                <Text style={styles.mcqText}>{opt}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        ) : (
                          <View>
                            <TextInput
                              value={answer}
                              onChangeText={setAnswer}
                              placeholder="Type your answer…"
                              placeholderTextColor={Palette.muted}
                              autoCapitalize="none"
                              autoCorrect={false}
                              onSubmitEditing={handleBlank}
                              style={styles.input}
                            />
                            <TouchableOpacity
                              onPress={handleBlank}
                              style={styles.goldBtn}
                              disabled={submitting}
                              activeOpacity={0.85}
                            >
                              <LinearGradient
                                colors={['#F3D97B', '#D4AF37', '#8A6D1F']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.goldInner}
                              >
                                {submitting ? (
                                  <ActivityIndicator
                                    size="small"
                                    color="#1A1405"
                                  />
                                ) : (
                                  <Ionicons
                                    name="send"
                                    size={16}
                                    color="#1A1405"
                                  />
                                )}
                                <Text style={styles.goldText}>
                                  {submitting
                                    ? 'SENDING…'
                                    : 'SUBMIT ANSWER'}
                                </Text>
                              </LinearGradient>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ) : live.status === 'PAUSED' ? (
                      <View style={styles.infoBox}>
                        <Ionicons
                          name="pause-circle-outline"
                          size={30}
                          color={Palette.goldSoft}
                        />
                        <Text style={styles.infoText}>
                          Buzzers paused — hold your answer, hero.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.infoBox}>
                        <Ionicons
                          name="flag-outline"
                          size={30}
                          color={Palette.muted}
                        />
                        <Text style={styles.infoText}>
                          {result && !result.ok
                            ? result.message
                            : 'Buzzers are closed for this question.'}
                        </Text>
                      </View>
                    )}

                    {result && !result.ok && !success ? (
                      <View
                        style={[
                          styles.resultBox,
                          result.code === 'WRONG'
                            ? styles.resultRetry
                            : styles.resultMiss,
                        ]}
                      >
                        <Ionicons
                          name={
                            result.code === 'WRONG'
                              ? 'refresh-circle-outline'
                              : 'information-circle-outline'
                          }
                          size={22}
                          color={
                            result.code === 'WRONG' ? '#F5C542' : '#F5A3A3'
                          }
                        />
                        <Text style={styles.resultText}>{result.message}</Text>
                      </View>
                    ) : null}

                    {live.status === 'ANSWER_REVEALED' && live.revealAnswer ? (
                      <View style={styles.revealBox}>
                        <Text style={styles.revealLabel}>THE TRUTH</Text>
                        <Text style={styles.revealText}>
                          {live.revealAnswer}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.infoBox}>
                    <Ionicons
                      name="hourglass-outline"
                      size={30}
                      color={Palette.goldSoft}
                    />
                    <Text style={styles.infoText}>
                      No active question — stand by, hero. The officers will
                      sound the horns.
                    </Text>
                  </View>
                )}
              </View>

              <HouseStandings standings={live.standings} />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 12,
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
  headerText: { flex: 1 },
  headerTitle: {
    fontFamily: Fonts.displayBlack,
    fontSize: 21,
    letterSpacing: 2,
    color: Palette.gold,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  headerSub: {
    fontFamily: Fonts.body,
    fontSize: 15,
    fontStyle: 'italic',
    color: Palette.parchment,
  },
  card: {
    backgroundColor: Palette.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Palette.cardBorder,
    padding: 16,
    marginBottom: 14,
    gap: 10,
  },
  centerIcon: { textAlign: 'center' },
  cardTitle: {
    fontFamily: Fonts.display,
    fontSize: 16,
    letterSpacing: 2,
    color: Palette.gold,
    textAlign: 'center',
  },
  hint: {
    fontFamily: Fonts.body,
    fontSize: 15,
    fontStyle: 'italic',
    color: Palette.muted,
    textAlign: 'center',
  },
  fieldLabel: {
    fontFamily: Fonts.display,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Palette.goldSoft,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: Fonts.bodySemi,
    fontSize: 17,
    color: Palette.parchment,
  },
  houseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  housePick: {
    width: '48%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.2)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: 5,
  },
  houseOrb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  housePickName: {
    fontFamily: Fonts.display,
    fontSize: 12,
    letterSpacing: 1,
    color: Palette.parchment,
  },
  housePickDomain: { fontFamily: Fonts.body, fontSize: 12, color: Palette.muted },
  formError: {
    fontFamily: Fonts.bodySemi,
    fontSize: 15,
    color: '#F5A3A3',
    textAlign: 'center',
  },
  goldBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  goldInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
  },
  goldText: {
    fontFamily: Fonts.display,
    fontSize: 13,
    letterSpacing: 1.5,
    color: '#1A1405',
  },
  ghostBtn: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.4)',
    paddingVertical: 11,
  },
  ghostText: {
    fontFamily: Fonts.display,
    fontSize: 12,
    letterSpacing: 1.5,
    color: Palette.goldSoft,
  },
  profileBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Palette.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Palette.cardBorder,
    padding: 12,
    marginBottom: 12,
  },
  profileOrb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  profileText: { flex: 1 },
  profileName: {
    fontFamily: Fonts.display,
    fontSize: 16,
    color: Palette.parchment,
  },
  profileHouse: { fontFamily: Fonts.display, fontSize: 10, letterSpacing: 1.5 },
  qMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  qNumber: {
    fontFamily: Fonts.display,
    fontSize: 13,
    letterSpacing: 2,
    color: Palette.goldSoft,
  },
  statusPill: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  statusPillText: {
    fontFamily: Fonts.display,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  typeTag: {
    fontFamily: Fonts.display,
    fontSize: 10,
    letterSpacing: 1,
    color: Palette.muted,
  },
  ptsTag: {
    fontFamily: Fonts.displayBlack,
    fontSize: 13,
    color: Palette.gold,
  },
  qText: {
    fontFamily: Fonts.display,
    fontSize: 22,
    lineHeight: 30,
    color: Palette.parchment,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  timerWrap: { gap: 6 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  timerText: {
    flex: 1,
    fontFamily: Fonts.display,
    fontSize: 15,
    color: Palette.goldSoft,
  },
  winnersMini: { fontFamily: Fonts.display, fontSize: 13, color: '#7DEAA8' },
  timerTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: Palette.gold,
  },
  mcqList: { gap: 9, marginTop: 4 },
  mcqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.4)',
    borderRadius: 12,
    padding: 13,
  },
  mcqBtnPicked: { borderColor: Palette.gold, backgroundColor: 'rgba(0,0,0,0.6)' },
  letterBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: {
    fontFamily: Fonts.displayBlack,
    fontSize: 17,
    color: '#1A1405',
  },
  mcqText: { flex: 1, fontFamily: Fonts.bodySemi, fontSize: 18, color: '#F3EAD3' },
  lockedBox: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderWidth: 1.5,
    borderColor: Palette.gold,
    borderRadius: 14,
    padding: 18,
  },
  lockedTitle: {
    fontFamily: Fonts.displayBlack,
    fontSize: 26,
    letterSpacing: 1,
    color: Palette.gold,
  },
  lockedSub: { fontFamily: Fonts.bodySemi, fontSize: 17, color: '#F3EAD3' },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  waitingText: {
    fontFamily: Fonts.body,
    fontSize: 15,
    fontStyle: 'italic',
    color: Palette.goldSoft,
  },
  infoBox: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    borderRadius: 12,
    padding: 18,
  },
  infoText: {
    fontFamily: Fonts.body,
    fontSize: 16,
    fontStyle: 'italic',
    color: Palette.parchment,
    textAlign: 'center',
  },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
  },
  resultRetry: {
    backgroundColor: 'rgba(245,197,66,0.10)',
    borderColor: 'rgba(245,197,66,0.55)',
  },
  resultMiss: {
    backgroundColor: 'rgba(231,76,60,0.10)',
    borderColor: 'rgba(231,76,60,0.5)',
  },
  resultText: { flex: 1, fontFamily: Fonts.bodySemi, fontSize: 16, color: '#F3EAD3' },
  revealBox: {
    backgroundColor: '#BFE3FF',
    borderRadius: 12,
    padding: 13,
    gap: 3,
  },
  revealLabel: {
    fontFamily: Fonts.display,
    fontSize: 10,
    letterSpacing: 2,
    color: '#2C5F8A',
  },
  revealText: {
    fontFamily: Fonts.displayBlack,
    fontSize: 19,
    color: '#0B1E33',
  },
});
