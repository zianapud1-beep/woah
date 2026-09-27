import { onValue, ref, runTransaction, set, update } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';

import {
  MAX_RESPONDERS,
  decideSubmission,
  normalizeAnswer,
} from './answerLogic';
import {
  RTDB_PATHS,
  SUBMISSION_MODE_ENV,
  getCloudFunctions,
  getRealtimeDatabase,
  isFirebaseConfigured,
} from './firebaseConfig';
import { EMPTY_POINTS, localBackend, type LocalSession } from './localBackend';
import type {
  ActiveQuestion,
  SubmissionRecord,
  ConnectionState,
  HouseId,
  HousePoints,
  QuizSnapshot,
  ResponderRecord,
  SecureAnswer,
  SubmissionMode,
  SubmissionResult,
  SubmitAnswerInput,
} from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  QUIZBALL REALTIME SYNC
 *
 *  State lives in the Realtime Database (push, not poll) under `ste_event`:
 *
 *    session/activeQuestion     public question — never contains the answer
 *    session/secureAnswer       officer-only answer payload
 *    session/correctResponders  { [studentId]: { name, house, at } }
 *    session/submissions        { [studentId]: { questionId, correct, … } }
 *    session/housePoints        { zeus, poseidon, athena, aphrodite }
 *
 *  Submission uses a **transaction** on `session` so the "first 10 correct"
 *  check and the point increment are committed atomically — the counter can
 *  never overshoot 10 even with 40 students tapping the buzzer at once.
 *  The identical rule is implemented server-side in `functions/src/index.ts`
 *  for deployments that keep the answer out of the client entirely.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface SessionNode {
  activeQuestion: ActiveQuestion | null;
  secureAnswer: SecureAnswer | null;
  correctResponders: Record<string, ResponderRecord>;
  submissions: Record<string, SubmissionRecord>;
  housePoints: HousePoints;
  questionCounter: number;
  updatedAt: number;
}

/* ------------------------------------------------------------- normalising */

function asRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === 'object' ? (value as Record<string, T>) : {};
}

function asQuestion(value: unknown): ActiveQuestion | null {
  if (!value || typeof value !== 'object') return null;
  const q = value as Partial<ActiveQuestion>;
  if (!q.id || !q.text) return null;
  return {
    id: q.id,
    index: q.index ?? 1,
    text: q.text,
    type: q.type === 'SHORT_ANSWER' ? 'SHORT_ANSWER' : 'MULTIPLE_CHOICE',
    options: Array.isArray(q.options) ? q.options : [],
    pointValue: q.pointValue ?? 10,
    status: q.status ?? 'IDLE',
    timerSeconds: q.timerSeconds ?? 30,
    endsAt: q.endsAt ?? null,
    startedAt: q.startedAt ?? null,
    correctCount: q.correctCount ?? 0,
    submissionCount: q.submissionCount ?? 0,
    revealedOptionId: q.revealedOptionId ?? null,
    revealedAnswer: q.revealedAnswer ?? null,
    bonusHouse: q.bonusHouse ?? null,
  };
}

function asPoints(value: unknown): HousePoints {
  const p = asRecord<number>(value);
  return {
    zeus: p.zeus ?? 0,
    poseidon: p.poseidon ?? 0,
    athena: p.athena ?? 0,
    aphrodite: p.aphrodite ?? 0,
  };
}

function toSnapshot(node: Partial<SessionNode> | null | undefined): QuizSnapshot {
  return {
    question: node?.activeQuestion ?? null,
    points: asPoints(node?.housePoints),
    correctResponders: asRecord<ResponderRecord>(node?.correctResponders),
    updatedAt: node?.updatedAt ?? Date.now(),
  };
}

/* ------------------------------------------------------------------- state */

let degradedNotice: string | null = null;
let forcedMode: SubmissionMode | null = null;

export function getSubmissionMode(): SubmissionMode {
  if (forcedMode) return forcedMode;
  if (SUBMISSION_MODE_ENV === 'cloud-function') return 'cloud-function';
  if (SUBMISSION_MODE_ENV === 'transaction') return 'transaction';
  // "auto": prefer the Cloud Function (the answer never reaches the device)
  // and transparently fall back to the client transaction if it is not
  // deployed yet.
  return isFirebaseConfigured ? 'cloud-function' : 'transaction';
}

/** Lets the officer panel force a mode at runtime (e.g. for a lab demo). */
export function overrideSubmissionMode(mode: SubmissionMode | null): void {
  forcedMode = mode;
}

export function getConnectionState(online: boolean): ConnectionState {
  return {
    mode: isFirebaseConfigured ? 'firebase' : 'demo',
    online,
    submissionMode: getSubmissionMode(),
    notice: degradedNotice,
  };
}

export function getDegradedNotice(): string | null {
  return degradedNotice;
}

function setDegraded(message: string | null): void {
  degradedNotice = message;
}

/* -------------------------------------------------------------- listeners */

/**
 * Stream the whole quiz session. Fires immediately with a snapshot and again
 * on every remote change — no polling anywhere in the app.
 */
export function subscribeToQuiz(
  listener: (snapshot: QuizSnapshot) => void,
): () => void {
  const db = getRealtimeDatabase();
  if (!db) return localBackend.subscribeQuiz(listener);

  try {
    return onValue(
      ref(db, RTDB_PATHS.session),
      (snap) => {
        if (snap.exists()) listener(toSnapshot(snap.val() as SessionNode));
        else
          listener({
            question: null,
            points: { ...EMPTY_POINTS },
            correctResponders: {},
            updatedAt: Date.now(),
          });
      },
      (error) => {
        console.warn('[quizSync] session listener error', error.message);
        setDegraded(`Realtime read failed: ${error.message}`);
      },
    );
  } catch (error) {
    setDegraded(error instanceof Error ? error.message : 'Realtime unavailable');
    return localBackend.subscribeQuiz(listener);
  }
}

/** Connection heartbeat, mirroring `/.info/connected`. */
export function subscribeToConnection(
  listener: (online: boolean) => void,
): () => void {
  const db = getRealtimeDatabase();
  if (!db) return localBackend.subscribeConnection(listener);
  try {
    return onValue(
      ref(db, '.info/connected'),
      (snap) => listener(snap.val() === true),
      () => listener(false),
    );
  } catch {
    return localBackend.subscribeConnection(listener);
  }
}

/* ------------------------------------------------------- officer commands */

type Db = NonNullable<ReturnType<typeof getRealtimeDatabase>>;

function requireDb(): Db | null {
  const db = getRealtimeDatabase();
  if (!db) return null;
  return db;
}

/** Push a brand new question (and its hidden answer) to every device. */
export async function publishQuestion(
  question: ActiveQuestion,
  secure: SecureAnswer,
): Promise<void> {
  const db = requireDb();
  if (!db) {
    localBackend.setQuestion(question, secure);
    return;
  }
  await set(ref(db, RTDB_PATHS.session), {
    activeQuestion: {
      ...question,
      endsAt: null,
      startedAt: null,
      status: 'IDLE',
      correctCount: 0,
      submissionCount: 0,
      revealedOptionId: null,
      revealedAnswer: null,
    },
    secureAnswer: secure,
    correctResponders: {},
    submissions: {},
    housePoints: asPoints(await readPoints(db)),
    questionCounter: question.index,
    updatedAt: Date.now(),
  } satisfies SessionNode);
  setDegraded(null);
}

async function readPoints(db: Db): Promise<HousePoints> {
  return new Promise((resolve) => {
    onValue(
      ref(db, RTDB_PATHS.housePoints),
      (snap) => resolve(asPoints(snap.val())),
      () => resolve({ ...EMPTY_POINTS }),
      { onlyOnce: true },
    );
  });
}

export async function startTimer(seconds?: number): Promise<void> {
  const db = requireDb();
  if (!db) return void localBackend.startTimer(seconds);
  const q = await readQuestion(db);
  if (!q) return;
  const duration = Math.max(1, Math.round(seconds ?? q.timerSeconds));
  const now = Date.now();
  await update(ref(db, RTDB_PATHS.question), {
    timerSeconds: duration,
    startedAt: now,
    endsAt: now + duration * 1000,
    status: 'BUZZERS_OPEN',
  });
}

export async function pauseTimer(): Promise<void> {
  const db = requireDb();
  if (!db) return void localBackend.pauseTimer();
  const q = await readQuestion(db);
  if (!q?.endsAt) return;
  await update(ref(db, RTDB_PATHS.question), {
    endsAt: null,
    status: 'PAUSED',
    startedAt: null,
  });
}

export async function resetTimer(): Promise<void> {
  const db = requireDb();
  if (!db) return void localBackend.resetTimer();
  await update(ref(db, RTDB_PATHS.question), {
    endsAt: null,
    startedAt: null,
    status: 'IDLE',
  });
}

export async function clearQuestion(): Promise<void> {
  const db = requireDb();
  if (!db) return void localBackend.clearQuestion();
  await update(ref(db, RTDB_PATHS.session), {
    activeQuestion: null,
    secureAnswer: null,
    correctResponders: null,
    submissions: null,
    updatedAt: Date.now(),
  } as unknown as Partial<SessionNode>);
}

export async function revealAnswer(): Promise<void> {
  const db = requireDb();
  if (!db) return void localBackend.reveal();
  const q = await readQuestion(db);
  if (!q) return;
  const secure = await readSecureAnswer(db);
  if (!secure) return;
  const text =
    q.type === 'MULTIPLE_CHOICE'
      ? (q.options.find((o) => o.id === secure.optionId)?.label ?? secure.answer)
      : secure.answer;
  await update(ref(db, RTDB_PATHS.question), {
    status: 'ANSWER_REVEALED',
    endsAt: null,
    revealedOptionId: secure.optionId,
    revealedAnswer: text,
  });
}

export async function closeQuestion(): Promise<void> {
  const db = requireDb();
  if (!db) return void localBackend.closeQuestion();
  await update(ref(db, RTDB_PATHS.question), {
    status: 'CLOSED',
    endsAt: null,
  });
}

/** Manual point correction from the officer panel. */
export async function adjustHousePoints(
  house: HouseId,
  delta: number,
): Promise<void> {
  const db = requireDb();
  if (!db) return void localBackend.adjustPoints(house, delta);
  await runTransaction(ref(db, `${RTDB_PATHS.housePoints}/${house}`), (value) => {
    const current = typeof value === 'number' ? value : 0;
    return Math.max(0, current + delta);
  });
}

export async function resetHousePoints(): Promise<void> {
  const db = requireDb();
  if (!db) return void localBackend.resetPoints();
  await set(ref(db, RTDB_PATHS.housePoints), { ...EMPTY_POINTS });
}

export async function readQuestionNow(): Promise<ActiveQuestion | null> {
  const db = requireDb();
  if (!db) return localBackend.getState().session.activeQuestion;
  return readQuestion(db);
}

export async function readQuestionCounter(): Promise<number> {
  const db = requireDb();
  if (!db) return localBackend.nextQuestionNumber();
  return new Promise((resolve) => {
    onValue(
      ref(db, RTDB_PATHS.session),
      (snap) => {
        const node = snap.val() as SessionNode | null;
        resolve((node?.questionCounter ?? 0) + 1);
      },
      () => resolve(1),
      { onlyOnce: true },
    );
  });
}

function readQuestion(db: Db): Promise<ActiveQuestion | null> {
  return new Promise((resolve) => {
    onValue(
      ref(db, RTDB_PATHS.question),
      (snap) => {
        resolve(asQuestion(snap.val()));
      },
      () => resolve(null),
      { onlyOnce: true },
    );
  });
}

function readSecureAnswer(db: Db): Promise<SecureAnswer | null> {
  return new Promise((resolve) => {
    onValue(
      ref(db, RTDB_PATHS.secureAnswer),
      (snap) => {
        const v = snap.val() as SecureAnswer | null;
        resolve(
          v
            ? {
                questionId: v.questionId,
                answer: v.answer,
                alternates: v.alternates ?? [],
                optionId: v.optionId ?? null,
              }
            : null,
        );
      },
      () => resolve(null),
      { onlyOnce: true },
    );
  });
}

/* ---------------------------------------------------- student submission */

const networkError = (): SubmissionResult => ({
  status: 'NETWORK_ERROR',
  message: 'The link to the hall failed. Please try once more.',
  pointsAwarded: 0,
});

/**
 * Submit an answer.
 *
 * 1. `cloud-function` — the callable `submitAnswer` validates the hidden
 *    answer with the Admin SDK and commits the responder + points atomically.
 *    The answer string never leaves the device in readable form.
 * 2. `transaction` — a Realtime Database transaction performs the exact same
 *    read-check-write on `session`, used for classroom/lab deployments that
 *    run without Cloud Functions.
 */
export async function submitAnswer(
  input: SubmitAnswerInput,
): Promise<SubmissionResult> {
  if (!isFirebaseConfigured) return localBackend.submit(input);

  const mode = getSubmissionMode();

  if (mode === 'cloud-function') {
    const result = await submitViaCloudFunction(input);
    if (result) return result;
    // Function not deployed / unreachable → degrade to the transaction path.
    if (forcedMode === 'cloud-function') {
      return {
        ...networkError(),
        message: 'The scoring service is unavailable. Call the officer.',
      };
    }
    setDegraded('Cloud Function unavailable — using the client transaction.');
  }

  return submitViaTransaction(input);
}

async function submitViaCloudFunction(
  input: SubmitAnswerInput,
): Promise<SubmissionResult | null> {
  const functions = getCloudFunctions();
  if (!functions) return null;
  try {
    const callable = httpsCallable<
      SubmitAnswerInput,
      {
        status: SubmissionResult['status'];
        message?: string;
        pointsAwarded?: number;
        houseTotal?: number;
      }
    >(functions, 'submitAnswer');
    const res = await callable({
      studentId: input.studentId,
      name: input.name,
      house: input.house,
      answer: input.answer,
    });
    const data = res.data;
    return {
      status: data.status,
      message:
        data.message ??
        (data.status === 'CORRECT_ACCEPTED'
          ? 'Correct! The vault opens for your house.'
          : 'Not this time — the marble statue remains closed.'),
      pointsAwarded: data.pointsAwarded ?? 0,
      houseTotal: data.houseTotal,
    };
  } catch (error) {
    const code = (error as { code?: string }).code ?? '';
    if (
      code === 'functions/not-found' ||
      code === 'functions/unavailable' ||
      code === 'functions/internal'
    ) {
      return null;
    }
    if (code === 'functions/permission-denied') {
      setDegraded('Answer function rejected the request — check the rules.');
    }
    return networkError();
  }
}

/**
 * The atomic "first 10" transaction.
 *
 * Runs against `ste_event/session` so that — in one indivisible operation —
 * it  (a) reads the hidden answer, (b) counts accepted responders,
 * (c) rejects duplicates, (d) appends the responder, and
 * (e) increments the house total by the question's point value.
 */
export async function submitViaTransaction(
  input: SubmitAnswerInput,
): Promise<SubmissionResult> {
  const db = getRealtimeDatabase();
  if (!db) return localBackend.submit(input);

  let decision: SubmissionResult | null = null;
  const now = Date.now();

  try {
    const result = await runTransaction(
      ref(db, RTDB_PATHS.session),
      (raw) => {
        const node = (raw ?? {}) as Partial<SessionNode>;
        const question = asQuestion(node.activeQuestion);
        const secure = (node.secureAnswer ?? null) as SecureAnswer | null;
        const correctResponders = asRecord<ResponderRecord>(
          node.correctResponders,
        );
        const submissions = asRecord<{ questionId: string }>(node.submissions);
        const housePoints = asPoints(node.housePoints);

        const verdict = decideSubmission(
          {
            question,
            secure,
            correctResponderCount: Object.keys(correctResponders).length,
            alreadyAnswered:
              submissions[input.studentId]?.questionId === question?.id,
            candidate: input.answer,
            housePoints,
            now,
          },
          input.house,
        );
        decision = verdict;

        if (!verdict.accept) return undefined; // abort → nothing is written

        const nextResponders: Record<string, ResponderRecord> = {
          ...correctResponders,
          [input.studentId]: {
            name: input.name,
            house: input.house,
            at: now,
          },
        };
        const responderCount = Object.keys(nextResponders).length;

        return {
          ...node,
          correctResponders: nextResponders,
          submissions: {
            ...submissions,
            [input.studentId]: {
              questionId: question?.id ?? '',
              correct: true,
              at: now,
            },
          } as Record<string, SubmissionRecord>,
          housePoints: {
            ...housePoints,
            [input.house]: verdict.houseTotal,
          },
          activeQuestion: question
            ? {
                ...question,
                correctCount: Math.min(MAX_RESPONDERS, responderCount),
                submissionCount: question.submissionCount + 1,
              }
            : null,
          updatedAt: now,
        } satisfies Partial<SessionNode>;
      },
      { applyLocally: false },
    );

    if (result.committed) setDegraded(null);
    return (
      decision ?? {
        status: result.committed ? 'CORRECT_ACCEPTED' : 'CLOSED',
        message: result.committed
          ? 'Correct! The vault opens for your house.'
          : 'The buzzers closed before your answer landed.',
        pointsAwarded: 0,
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown realtime failure';
    if (/permission|denied/i.test(message)) {
      setDegraded(
        'Database rules blocked the write — deploy the Cloud Function or ship database.rules.labmode.json.',
      );
    }
    return networkError();
  }
}

/* ------------------------------------------------------------- utilities */

/** Normalised comparison helper reused by the officer preview UI. */
export function previewMatch(candidate: string, secure: SecureAnswer): boolean {
  const value = normalizeAnswer(candidate);
  if (!value) return false;
  if (secure.optionId && value === secure.optionId.toLowerCase()) return true;
  if (value === normalizeAnswer(secure.answer)) return true;
  return secure.alternates.some((a) => normalizeAnswer(a) === value);
}

export type { LocalSession };
export { MAX_RESPONDERS };
