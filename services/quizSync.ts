import { onValue, ref } from 'firebase/database';
import { getIdTokenResult, signInAnonymously, User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { cloudFunctions, firebaseAuth, isFirebaseConfigured, realtimeDatabase } from './firebaseConfig';
import { HOUSE_IDS, HouseId } from '../styles/theme';

export type QuizQuestionType = 'MULTIPLE_CHOICE' | 'BLANK/SHORT_ANSWER';
export type QuizStatus = 'IDLE' | 'READY' | 'BUZZERS_OPEN' | 'PAUSED' | 'TIME_UP' | 'ANSWER_REVEALED';

export type QuizTimer = {
  duration: number;
  remaining: number;
  endsAt: number | null;
  isRunning: boolean;
};

export type QuizPublicState = {
  questionId: string;
  questionNumber: number;
  text: string;
  type: QuizQuestionType;
  options: string[];
  pointValue: number;
  status: QuizStatus;
  timer: QuizTimer;
  correctAnswersReceived: number;
  correctAnswersLimit: number;
  revealedAnswer?: string | null;
  updatedAt?: number;
};

export type Standings = Record<HouseId, number>;

export type SubmissionCode =
  | 'CORRECT'
  | 'INCORRECT'
  | 'ALREADY_SUBMITTED'
  | 'LIMIT_REACHED'
  | 'BUZZERS_CLOSED'
  | 'TIME_UP'
  | 'QUESTION_CHANGED'
  | 'NO_ACTIVE_QUESTION';

export type SubmissionResult = {
  code: SubmissionCode;
  accepted: boolean;
  locked: boolean;
  message: string;
  pointValue?: number;
};

export type PublishQuestionInput = {
  text: string;
  type: QuizQuestionType;
  options: string[];
  correctAnswer: string;
  pointValue: number;
};

export const EMPTY_QUIZ: QuizPublicState = {
  questionId: '',
  questionNumber: 0,
  text: 'The next challenge is being prepared.',
  type: 'MULTIPLE_CHOICE',
  options: [],
  pointValue: 0,
  status: 'IDLE',
  timer: { duration: 0, remaining: 0, endsAt: null, isRunning: false },
  correctAnswersReceived: 0,
  correctAnswersLimit: 10,
};

export const EMPTY_STANDINGS: Standings = {
  ZEUS: 0,
  POSEIDON: 0,
  ATHENA: 0,
  APHRODITE: 0,
};

function normalizeQuiz(value: unknown): QuizPublicState {
  if (!value || typeof value !== 'object') return EMPTY_QUIZ;
  const raw = value as Partial<QuizPublicState>;
  const timer = raw.timer && typeof raw.timer === 'object' ? raw.timer : EMPTY_QUIZ.timer;
  return {
    ...EMPTY_QUIZ,
    ...raw,
    questionId: typeof raw.questionId === 'string' ? raw.questionId : '',
    questionNumber: Number(raw.questionNumber) || 0,
    text: typeof raw.text === 'string' ? raw.text : EMPTY_QUIZ.text,
    type: raw.type === 'BLANK/SHORT_ANSWER' ? 'BLANK/SHORT_ANSWER' : 'MULTIPLE_CHOICE',
    options: Array.isArray(raw.options) ? raw.options.filter((option): option is string => typeof option === 'string') : [],
    pointValue: Number(raw.pointValue) || 0,
    status: raw.status ?? 'IDLE',
    timer: {
      duration: Number(timer.duration) || 0,
      remaining: Number(timer.remaining) || 0,
      endsAt: typeof timer.endsAt === 'number' ? timer.endsAt : null,
      isRunning: Boolean(timer.isRunning),
    },
    correctAnswersReceived: Number(raw.correctAnswersReceived) || 0,
    correctAnswersLimit: Number(raw.correctAnswersLimit) || 10,
  };
}

export function normalizeStandings(value: unknown): Standings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return HOUSE_IDS.reduce((result, house) => {
    result[house] = Math.max(0, Math.floor(Number(raw[house]) || 0));
    return result;
  }, { ...EMPTY_STANDINGS });
}

export function subscribeQuizState(
  onChange: (state: QuizPublicState) => void,
  onError?: (error: Error) => void,
) {
  if (!realtimeDatabase) {
    onChange(EMPTY_QUIZ);
    return () => undefined;
  }
  return onValue(
    ref(realtimeDatabase, 'quizState/public'),
    (snapshot) => onChange(normalizeQuiz(snapshot.val())),
    (error) => onError?.(error),
  );
}

export function subscribeStandings(
  onChange: (standings: Standings) => void,
  onError?: (error: Error) => void,
) {
  if (!realtimeDatabase) {
    onChange(EMPTY_STANDINGS);
    return () => undefined;
  }
  return onValue(
    ref(realtimeDatabase, 'quizState/standings'),
    (snapshot) => onChange(normalizeStandings(snapshot.val())),
    (error) => onError?.(error),
  );
}

export async function ensureSignedIn(): Promise<User> {
  if (!isFirebaseConfigured || !firebaseAuth) {
    throw new Error('Firebase is not configured. Add the EXPO_PUBLIC_FIREBASE values to your .env file.');
  }
  if (firebaseAuth.currentUser) return firebaseAuth.currentUser;
  const credential = await signInAnonymously(firebaseAuth);
  return credential.user;
}

function getCallable<TInput, TOutput>(name: string) {
  if (!cloudFunctions) throw new Error('Firebase is not configured for this build.');
  return httpsCallable<TInput, TOutput>(cloudFunctions, name);
}

export async function unlockOfficerSession(pin: string) {
  await ensureSignedIn();
  const result = await getCallable<{ pin: string }, { authorized: boolean }>('unlockOfficer')({ pin });
  if (!result.data.authorized || !firebaseAuth?.currentUser) throw new Error('Officer access could not be verified.');
  await firebaseAuth.currentUser.getIdToken(true);
  return true;
}

export async function restoreOfficerSession() {
  const user = await ensureSignedIn();
  const token = await getIdTokenResult(user, true);
  return token.claims.admin === true;
}

export async function lockOfficerSession() {
  await ensureSignedIn();
  await getCallable<Record<string, never>, { locked: boolean }>('lockOfficer')({});
  if (firebaseAuth?.currentUser) await firebaseAuth.currentUser.getIdToken(true);
}

export async function publishQuestion(input: PublishQuestionInput) {
  await ensureSignedIn();
  const callable = getCallable<PublishQuestionInput, { questionId: string; questionNumber: number }>('publishQuestion');
  return (await callable(input)).data;
}

export async function controlQuizTimer(action: 'start' | 'pause' | 'reset', duration?: 10 | 30 | 60) {
  await ensureSignedIn();
  const callable = getCallable<{ action: 'start' | 'pause' | 'reset'; duration?: number }, { ok: boolean }>('controlQuizTimer');
  return (await callable({ action, duration })).data;
}

export async function revealQuizAnswer() {
  await ensureSignedIn();
  const callable = getCallable<Record<string, never>, { ok: boolean }>('revealQuizAnswer');
  return (await callable({})).data;
}

export async function setHousePoints(house: HouseId, points: number) {
  await ensureSignedIn();
  const callable = getCallable<{ house: HouseId; points: number }, { ok: boolean }>('setHousePoints');
  return (await callable({ house, points })).data;
}

export async function submitStudentAnswer(input: {
  questionId: string;
  name: string;
  house: HouseId;
  answer: string;
}): Promise<SubmissionResult> {
  await ensureSignedIn();
  const callable = getCallable<typeof input, SubmissionResult>('submitAnswer');
  return (await callable(input)).data;
}

export function getRemainingSeconds(timer: QuizTimer, now = Date.now()) {
  if (timer.isRunning && typeof timer.endsAt === 'number') {
    return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
  }
  return Math.max(0, Math.ceil(timer.remaining));
}

export function getLiveStatus(state: QuizPublicState, now = Date.now()): QuizStatus {
  if (state.status === 'BUZZERS_OPEN' && state.timer.isRunning && getRemainingSeconds(state.timer, now) <= 0) return 'TIME_UP';
  return state.status;
}
