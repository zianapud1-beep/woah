import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import ThemedBackground from '../components/ThemedBackground';
import BulletinCard from '../components/BulletinCard';
import {
  Fonts,
  Palette,
  HOUSE_IDS,
  HOUSES,
  OFFICER_PIN,
} from '../styles/theme';
import type { HouseId } from '../styles/theme';
import {
  Bulletin,
  BulletinHouse,
  LiveState,
  QuestionType,
  defaultLiveState,
} from '../services/types';
import {
  subscribeToLiveState,
  publishQuestion,
  openBuzzers,
  pauseQuiz,
  resumeQuiz,
  markTimeUp,
  revealQuizAnswer,
  clearQuestion,
  adjustPoints,
  resetSeason,
} from '../services/quizSync';
import {
  subscribeToBulletins,
  createBulletin,
  removeBulletin,
} from '../services/bulletinSync';

const LETTERS = ['A', 'B', 'C', 'D'];
const BULLETIN_HOUSES: BulletinHouse[] = [
  'ALL',
  'ZEUS',
  'POSEIDON',
  'ATHENA',
  'APHRODITE',
];

function GoldButton({
  title,
  onPress,
  icon,
  flex,
}: {
  title: string;
  onPress: () => void;
  icon?: string;
  flex?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.goldBtn, flex && { flex: 1 }]}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={['#F3D97B', '#D4AF37', '#8A6D1F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.goldInner}
      >
        {icon ? (
          <Ionicons name={icon as never} size={16} color="#1A1405" />
        ) : null}
        <Text style={styles.goldText}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function GhostButton({
  title,
  onPress,
  icon,
  flex,
  tint,
}: {
  title: string;
  onPress: () => void;
  icon?: string;
  flex?: boolean;
  tint?: string;
}) {
  const color = tint || Palette.goldSoft;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.ghostBtn, flex && { flex: 1 }, { borderColor: color }]}
      activeOpacity={0.85}
    >
      {icon ? <Ionicons name={icon as never} size={16} color={color} /> : null}
      <Text style={[styles.ghostText, { color }]}>{title}</Text>
    </TouchableOpacity>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [tab, setTab] = useState<'quiz' | 'bulletin'>('quiz');
  const [live, setLive] = useState<LiveState>(() => defaultLiveState());
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [armed, setArmed] = useState<string | null>(null);

  // quiz form
  const [qText, setQText] = useState('');
  const [qType, setQType] = useState<QuestionType>('MULTIPLE_CHOICE');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [blankAnswer, setBlankAnswer] = useState('');
  const [pointValue, setPointValue] = useState('10');
  const [revealText, setRevealText] = useState('');
  const [step, setStep] = useState(5);

  // bulletin form
  const [bTitle, setBTitle] = useState('');
  const [bBody, setBBody] = useState('');
  const [bHouse, setBHouse] = useState<BulletinHouse>('ALL');
  const [bDate, setBDate] = useState('');
  const [bLocation, setBLocation] = useState('');

  useEffect(() => subscribeToLiveState(setLive), []);
  useEffect(() => subscribeToBulletins(setBulletins), []);

  function flash(kind: 'ok' | 'err', text: string) {
    setMsg({ kind, text });
    setTimeout(() => setMsg((m) => (m && m.text === text ? null : m)), 4500);
  }

  function armedPress(id: string, fn: () => void) {
    if (armed === id) {
      setArmed(null);
      fn();
    } else {
      setArmed(id);
      setTimeout(
        () => setArmed((a) => (a === id ? null : a)),
        4000
      );
    }
  }

  function tryUnlock() {
    if (pin === OFFICER_PIN) {
      setUnlocked(true);
      setPin('');
      setPinError('');
    } else {
      setPinError('Wrong seal. Officers only, hero.');
    }
  }

  async function handlePublish() {
    const correct =
      qType === 'MULTIPLE_CHOICE' ? options[correctIdx] : blankAnswer;
    const res = await publishQuestion({
      text: qText,
      type: qType,
      options,
      correctAnswer: correct,
      pointValue: parseInt(pointValue, 10) || 10,
    });
    flash(res.ok ? 'ok' : 'err', res.message);
    if (res.ok) {
      setRevealText((correct || '').trim());
      setQText('');
      setOptions(['', '', '', '']);
      setBlankAnswer('');
      setCorrectIdx(0);
    }
  }

  async function handleBulletinPublish() {
    try {
      await createBulletin({
        title: bTitle,
        body: bBody,
        house: bHouse,
        eventDate: bDate.trim(),
        location: bLocation.trim(),
        author: 'STE Officers',
      });
      flash('ok', 'Proclamation published to the bulletin board.');
      setBTitle('');
      setBBody('');
      setBDate('');
      setBLocation('');
      setBHouse('ALL');
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Publish failed.');
    }
  }

  const responders = Object.values(live.responders || {}).sort(
    (a, b) => a.position - b.position
  );

  return (
    <ThemedBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {/* PIN gate */}
        <Modal
          visible={!unlocked}
          transparent
          animationType="fade"
          onRequestClose={() => router.back()}
        >
          <View style={styles.modalScrim}>
            <View style={styles.pinCard}>
              <Ionicons
                name="shield-checkmark"
                size={44}
                color={Palette.gold}
              />
              <Text style={styles.pinTitle}>OFFICER ACCESS</Text>
              <Text style={styles.pinSub}>
                Speak the seal of the STE council
              </Text>
              <TextInput
                value={pin}
                onChangeText={(t) => {
                  setPin(t);
                  setPinError('');
                }}
                onSubmitEditing={tryUnlock}
                secureTextEntry
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="Enter officer seal"
                placeholderTextColor={Palette.muted}
                style={styles.input}
              />
              {pinError ? (
                <Text style={styles.pinError}>{pinError}</Text>
              ) : null}
              <GoldButton title="UNSEAL PANEL" onPress={tryUnlock} icon="key" />
              <GhostButton
                title="BACK TO HALL"
                onPress={() => router.back()}
                icon="arrow-back"
              />
            </View>
          </View>
        </Modal>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backBtn}
                hitSlop={8}
              >
                <Ionicons name="arrow-back" size={22} color={Palette.gold} />
              </TouchableOpacity>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>OFFICER SANCTUM</Text>
                <Text style={styles.headerSub}>Quizball & Bulletin Command</Text>
              </View>
              <Ionicons name="shield" size={28} color={Palette.gold} />
            </View>

            {/* tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, tab === 'quiz' && styles.tabActive]}
                onPress={() => setTab('quiz')}
              >
                <Ionicons
                  name="flash"
                  size={16}
                  color={tab === 'quiz' ? '#1A1405' : Palette.goldSoft}
                />
                <Text
                  style={[
                    styles.tabText,
                    tab === 'quiz' && styles.tabTextActive,
                  ]}
                >
                  QUIZBALL
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, tab === 'bulletin' && styles.tabActive]}
                onPress={() => setTab('bulletin')}
              >
                <Ionicons
                  name="megaphone"
                  size={16}
                  color={tab === 'bulletin' ? '#1A1405' : Palette.goldSoft}
                />
                <Text
                  style={[
                    styles.tabText,
                    tab === 'bulletin' && styles.tabTextActive,
                  ]}
                >
                  BULLETIN
                </Text>
              </TouchableOpacity>
            </View>

            {msg ? (
              <View
                style={[
                  styles.msg,
                  msg.kind === 'ok' ? styles.msgOk : styles.msgErr,
                ]}
              >
                <Ionicons
                  name={msg.kind === 'ok' ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={msg.kind === 'ok' ? '#7DEAA8' : '#F5A3A3'}
                />
                <Text style={styles.msgText}>{msg.text}</Text>
              </View>
            ) : null}

            {tab === 'quiz' ? (
              <View>
                {/* live status */}
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>LIVE STATUS</Text>
                  <View style={styles.statusRow}>
                    <Text style={styles.qNum}>
                      {live.questionNumber > 0
                        ? `Q${live.questionNumber}`
                        : '—'}
                    </Text>
                    <Text style={styles.statusPill}>{live.status}</Text>
                    <Text style={styles.countPill}>
                      ✓ {live.correctCount}/{live.maxWinners || 10}
                    </Text>
                  </View>
                  <Text style={styles.preview} numberOfLines={3}>
                    {live.text || 'No question published yet.'}
                  </Text>
                </View>

                {/* compose */}
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>COMPOSE QUESTION</Text>
                  <Text style={styles.fieldLabel}>Question type</Text>
                  <View style={styles.typeRow}>
                    {(
                      ['MULTIPLE_CHOICE', 'BLANK'] as QuestionType[]
                    ).map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.typeBtn,
                          qType === t && styles.typeBtnActive,
                        ]}
                        onPress={() => setQType(t)}
                      >
                        <Text
                          style={[
                            styles.typeText,
                            qType === t && styles.typeTextActive,
                          ]}
                        >
                          {t === 'MULTIPLE_CHOICE'
                            ? '◉ MULTIPLE CHOICE'
                            : '✒ BLANK / SHORT'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>Question text</Text>
                  <TextInput
                    value={qText}
                    onChangeText={setQText}
                    multiline
                    placeholder="e.g. Which particle carries the electromagnetic force?"
                    placeholderTextColor={Palette.muted}
                    style={[styles.input, styles.multiline]}
                  />

                  {qType === 'MULTIPLE_CHOICE' ? (
                    <View>
                      <Text style={styles.fieldLabel}>
                        Options — tap a letter to mark the hidden answer
                      </Text>
                      {options.map((opt, i) => (
                        <View key={i} style={styles.optionRow}>
                          <TouchableOpacity
                            style={[
                              styles.letterBtn,
                              correctIdx === i && styles.letterBtnActive,
                            ]}
                            onPress={() => setCorrectIdx(i)}
                          >
                            <Text
                              style={[
                                styles.letterBtnText,
                                correctIdx === i &&
                                  styles.letterBtnTextActive,
                              ]}
                            >
                              {LETTERS[i]}
                            </Text>
                          </TouchableOpacity>
                          <TextInput
                            value={opt}
                            onChangeText={(t) =>
                              setOptions((o) =>
                                o.map((v, j) => (j === i ? t : v))
                              )
                            }
                            placeholder={`Option ${LETTERS[i]}`}
                            placeholderTextColor={Palette.muted}
                            style={[styles.input, styles.optionInput]}
                          />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View>
                      <Text style={styles.fieldLabel}>
                        Hidden correct answer (never shown to players)
                      </Text>
                      <TextInput
                        value={blankAnswer}
                        onChangeText={setBlankAnswer}
                        placeholder="e.g. photon"
                        placeholderTextColor={Palette.muted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={styles.input}
                      />
                    </View>
                  )}

                  <Text style={styles.fieldLabel}>
                    Point value (per winner)
                  </Text>
                  <TextInput
                    value={pointValue}
                    onChangeText={setPointValue}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                  <GoldButton
                    title="PUBLISH QUESTION"
                    icon="send"
                    onPress={handlePublish}
                  />
                  <Text style={styles.hint}>
                    Publishing stores only a one-way hash of the answer —
                    students can never read the plaintext from app state.
                  </Text>
                </View>

                {/* timer + flow controls */}
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>BUZZER & TIMER CONTROL</Text>
                  <View style={styles.btnRow}>
                    <GoldButton
                      title="10s"
                      flex
                      onPress={() => openBuzzers(10).catch(() => {})}
                    />
                    <GoldButton
                      title="30s"
                      flex
                      onPress={() => openBuzzers(30).catch(() => {})}
                    />
                    <GoldButton
                      title="60s"
                      flex
                      onPress={() => openBuzzers(60).catch(() => {})}
                    />
                  </View>
                  <View style={styles.btnRow}>
                    {live.status === 'PAUSED' ? (
                      <GhostButton
                        title="RESUME"
                        icon="play"
                        flex
                        onPress={() => resumeQuiz().catch(() => {})}
                      />
                    ) : (
                      <GhostButton
                        title="PAUSE"
                        icon="pause"
                        flex
                        onPress={() => pauseQuiz().catch(() => {})}
                      />
                    )}
                    <GhostButton
                      title="TIME UP"
                      icon="timer-off-outline"
                      flex
                      onPress={() => markTimeUp().catch(() => {})}
                    />
                  </View>
                  <Text style={styles.fieldLabel}>Reveal answer text</Text>
                  <TextInput
                    value={revealText}
                    onChangeText={setRevealText}
                    placeholder="Answer shown on reveal"
                    placeholderTextColor={Palette.muted}
                    style={styles.input}
                  />
                  <View style={styles.btnRow}>
                    <GhostButton
                      title="REVEAL"
                      icon="eye"
                      flex
                      tint="#5DADE2"
                      onPress={() => {
                        revealQuizAnswer(revealText).catch(() => {});
                        flash('ok', 'Answer revealed on all screens.');
                      }}
                    />
                    <GhostButton
                      title={
                        armed === 'clear' ? 'TAP TO CONFIRM' : 'END & CLEAR'
                      }
                      icon="checkmark-done"
                      flex
                      tint={armed === 'clear' ? '#E74C3C' : Palette.goldSoft}
                      onPress={() =>
                        armedPress('clear', () => {
                          clearQuestion().catch(() => {});
                          setRevealText('');
                          flash('ok', 'Question ended and cleared.');
                        })
                      }
                    />
                  </View>
                </View>

                {/* winners */}
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>
                    WINNERS CIRCLE ({responders.length}/{live.maxWinners || 10})
                  </Text>
                  {responders.length === 0 ? (
                    <Text style={styles.hint}>
                      No correct answers yet — the arena awaits its heroes.
                    </Text>
                  ) : (
                    responders.map((r) => (
                      <View key={`${r.position}-${r.name}`} style={styles.winRow}>
                        <Text style={styles.winPos}>#{r.position}</Text>
                        <Text style={styles.winName} numberOfLines={1}>
                          {r.name}
                        </Text>
                        <Text
                          style={[
                            styles.winHouse,
                            {
                              color:
                                HOUSES[r.house]?.colors.accent ||
                                Palette.goldSoft,
                            },
                          ]}
                        >
                          {HOUSES[r.house]?.name.toUpperCase() || r.house}
                        </Text>
                      </View>
                    ))
                  )}
                </View>

                {/* standings adjust */}
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>MANUAL POINT ADJUST</Text>
                  <View style={styles.stepRow}>
                    <Text style={styles.fieldLabel}>Step:</Text>
                    {[1, 5, 10, 25].map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.stepBtn,
                          step === s && styles.stepBtnActive,
                        ]}
                        onPress={() => setStep(s)}
                      >
                        <Text
                          style={[
                            styles.stepText,
                            step === s && styles.stepTextActive,
                          ]}
                        >
                          {s}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {HOUSE_IDS.map((h: HouseId) => (
                    <View key={h} style={styles.adjRow}>
                      <Ionicons
                        name={HOUSES[h].icon as never}
                        size={18}
                        color={HOUSES[h].colors.accent}
                      />
                      <Text style={styles.adjName}>{HOUSES[h].name}</Text>
                      <Text
                        style={[
                          styles.adjPts,
                          { color: HOUSES[h].colors.goldSoft },
                        ]}
                      >
                        {live.standings[h] || 0}
                      </Text>
                      <TouchableOpacity
                        style={styles.adjBtn}
                        onPress={() => adjustPoints(h, -step).catch(() => {})}
                      >
                        <Ionicons name="remove" size={18} color="#F5A3A3" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.adjBtn}
                        onPress={() => adjustPoints(h, step).catch(() => {})}
                      >
                        <Ionicons name="add" size={18} color="#7DEAA8" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <GhostButton
                    title={
                      armed === 'reset'
                        ? 'TAP AGAIN TO RESET SEASON'
                        : 'RESET ENTIRE SEASON'
                    }
                    icon="warning-outline"
                    tint="#E74C3C"
                    onPress={() =>
                      armedPress('reset', () => {
                        resetSeason().catch(() => {});
                        flash('ok', 'Season reset. All houses start at zero.');
                      })
                    }
                  />
                </View>
              </View>
            ) : (
              <View>
                {/* bulletin composer */}
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>NEW PROCLAMATION</Text>
                  <Text style={styles.fieldLabel}>Title</Text>
                  <TextInput
                    value={bTitle}
                    onChangeText={setBTitle}
                    placeholder="e.g. Robotics Rumble Finals"
                    placeholderTextColor={Palette.muted}
                    style={styles.input}
                  />
                  <Text style={styles.fieldLabel}>Details</Text>
                  <TextInput
                    value={bBody}
                    onChangeText={setBBody}
                    multiline
                    placeholder="What, when, who should come…"
                    placeholderTextColor={Palette.muted}
                    style={[styles.input, styles.multiline]}
                  />
                  <Text style={styles.fieldLabel}>House tag</Text>
                  <View style={styles.chipRow}>
                    {BULLETIN_HOUSES.map((hb) => (
                      <TouchableOpacity
                        key={hb}
                        style={[
                          styles.chip,
                          bHouse === hb && styles.chipActive,
                        ]}
                        onPress={() => setBHouse(hb)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            bHouse === hb && styles.chipTextActive,
                          ]}
                        >
                          {hb}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.fieldLabel}>Event date / time</Text>
                  <TextInput
                    value={bDate}
                    onChangeText={setBDate}
                    placeholder="e.g. Fri • Oct 10 • 8:00 AM"
                    placeholderTextColor={Palette.muted}
                    style={styles.input}
                  />
                  <Text style={styles.fieldLabel}>Location</Text>
                  <TextInput
                    value={bLocation}
                    onChangeText={setBLocation}
                    placeholder="e.g. Science Garden"
                    placeholderTextColor={Palette.muted}
                    style={styles.input}
                  />
                  <GoldButton
                    title="PUBLISH TO BOARD"
                    icon="megaphone"
                    onPress={handleBulletinPublish}
                  />
                </View>

                {/* existing */}
                <Text style={styles.sectionTitle}>
                  PUBLISHED ({bulletins.length})
                </Text>
                {bulletins.map((b) => (
                  <BulletinCard
                    key={b.id}
                    item={b}
                    onDelete={(id) => {
                      removeBulletin(id).catch(() => {});
                      flash('ok', 'Proclamation removed.');
                    }}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
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
  tabs: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  tabActive: { backgroundColor: Palette.gold, borderColor: Palette.gold },
  tabText: {
    fontFamily: Fonts.display,
    fontSize: 12,
    letterSpacing: 1.5,
    color: Palette.goldSoft,
  },
  tabTextActive: { color: '#1A1405' },
  msg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 11,
    marginBottom: 12,
  },
  msgOk: {
    backgroundColor: 'rgba(46,196,113,0.12)',
    borderColor: 'rgba(46,196,113,0.5)',
  },
  msgErr: {
    backgroundColor: 'rgba(231,76,60,0.12)',
    borderColor: 'rgba(231,76,60,0.5)',
  },
  msgText: { flex: 1, fontFamily: Fonts.bodySemi, fontSize: 15, color: '#F3EAD3' },
  card: {
    backgroundColor: Palette.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Palette.cardBorder,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  cardLabel: {
    fontFamily: Fonts.display,
    fontSize: 12,
    letterSpacing: 2.5,
    color: Palette.gold,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.25)',
    paddingBottom: 8,
  },
  fieldLabel: {
    fontFamily: Fonts.display,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Palette.goldSoft,
    marginTop: 2,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Fonts.bodySemi,
    fontSize: 16,
    color: Palette.parchment,
  },
  multiline: { minHeight: 76, textAlignVertical: 'top' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qNum: { fontFamily: Fonts.displayBlack, fontSize: 26, color: Palette.gold },
  statusPill: {
    fontFamily: Fonts.display,
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#0B0E1A',
    backgroundColor: Palette.goldSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  countPill: {
    fontFamily: Fonts.display,
    fontSize: 12,
    color: '#7DEAA8',
    backgroundColor: 'rgba(46,196,113,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  preview: { fontFamily: Fonts.body, fontSize: 16, color: '#E7DCC2' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.3)',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  typeBtnActive: { backgroundColor: Palette.gold, borderColor: Palette.gold },
  typeText: {
    fontFamily: Fonts.display,
    fontSize: 10,
    letterSpacing: 1,
    color: Palette.parchment,
  },
  typeTextActive: { color: '#1A1405' },
  optionRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  optionInput: { flex: 1 },
  letterBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  letterBtnActive: { backgroundColor: '#2ECC71', borderColor: '#2ECC71' },
  letterBtnText: {
    fontFamily: Fonts.displayBlack,
    fontSize: 16,
    color: Palette.goldSoft,
  },
  letterBtnTextActive: { color: '#06240F' },
  hint: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontStyle: 'italic',
    color: Palette.muted,
  },
  btnRow: { flexDirection: 'row', gap: 8 },
  goldBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  goldInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  goldText: {
    fontFamily: Fonts.display,
    fontSize: 12,
    letterSpacing: 1.5,
    color: '#1A1405',
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginTop: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  ghostText: { fontFamily: Fonts.display, fontSize: 11, letterSpacing: 1.2 },
  winRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.12)',
  },
  winPos: {
    fontFamily: Fonts.displayBlack,
    fontSize: 15,
    color: Palette.gold,
    width: 40,
  },
  winName: { flex: 1, fontFamily: Fonts.bodySemi, fontSize: 16, color: '#F3EAD3' },
  winHouse: { fontFamily: Fonts.display, fontSize: 10, letterSpacing: 1 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  stepBtnActive: { backgroundColor: Palette.gold, borderColor: Palette.gold },
  stepText: { fontFamily: Fonts.display, fontSize: 12, color: Palette.parchment },
  stepTextActive: { color: '#1A1405' },
  adjRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 6 },
  adjName: { flex: 1, fontFamily: Fonts.display, fontSize: 14, color: '#F3EAD3' },
  adjPts: { fontFamily: Fonts.displayBlack, fontSize: 17, width: 64, textAlign: 'right' },
  adjBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontFamily: Fonts.display,
    fontSize: 14,
    letterSpacing: 2,
    color: Palette.gold,
    marginVertical: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  chipActive: { backgroundColor: Palette.gold, borderColor: Palette.gold },
  chipText: {
    fontFamily: Fonts.display,
    fontSize: 10,
    letterSpacing: 1.2,
    color: Palette.parchment,
  },
  chipTextActive: { color: '#1A1405' },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  pinCard: {
    width: '100%',
    backgroundColor: '#0D1020',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Palette.gold,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  pinTitle: {
    fontFamily: Fonts.displayBlack,
    fontSize: 22,
    letterSpacing: 2,
    color: Palette.gold,
  },
  pinSub: {
    fontFamily: Fonts.body,
    fontSize: 16,
    fontStyle: 'italic',
    color: Palette.parchment,
  },
  pinError: { fontFamily: Fonts.bodySemi, fontSize: 15, color: '#F5A3A3' },
});
