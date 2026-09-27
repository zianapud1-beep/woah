import { ref, onValue, runTransaction, update, get, set } from 'firebase/database';
import * as Crypto from 'expo-crypto';
import { db, isFirebaseConfigured } from './firebaseConfig';
import {
  getLiveSnapshot,
  subscribeLive as subscribeDemoLive,
  updateLive as updateDemoLive,
  replaceLive as replaceDemoLive,
  transactionLive as transactionDemoLive,
} from './demoStore';
import {
  DEFAULT_STANDINGS,
  LiveState,
  QuestionType,
  Responder,
  defaultLiveState,
} from './types';
import type { HouseId } from '../styles/theme';

/**
 * Live Quizball sync over Firebase Realtime Database (`onValue` listeners —
 * no polling). Falls back to the local DemoStore when Firebase is not
 * configured, preserving identical semantics.
 *
 * FIRST-10 RULE — enforced atomically inside a single transaction on the
 * `ste2026/live` node (which co-locates question state, responders, and
 * standings so the claim is all-or-nothing):
 *   1. Buzzers must be open and the timer unexpired.
 *   2. The SHA-256 hash of the normalized attempt must match `answerHash`
 *      (the plaintext answer is never exposed to clients).
 *   3. The student must not already be in `responders`.
 *   4. `correctCount` must be < `maxWinners` (10).
 * On success the responder is appended, `correctCount` increments, and the
 * house total grows by `pointValue` — all in one atomic commit.
 */

export const LIVE_PATH = 'ste2026/live';
export const MAX_WINNERS = 10;
const HASH_PREFIX = 'ste-quizball-v1::';

// ------------------------------------------------------------ primitives ---
export function normalizeAnswer(input: string): string {
  return (input || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function hashAnswer(normalized: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${HASH_PREFIX}${normalized}`
  );
}

export type SubmitCode =
  | 'SUCCESS'
  | 'WRONG'
  | 'FULL'
  | 'CLOSED'
  | 'DUPLICATE'
  | 'NO_QUESTION'
  | 'ERROR';

export interface SubmitResult {
  ok: boolean;
  code: SubmitCode;
  message: string;
  position?: number;
  points?: number;
}

function isExpired(live: LiveState): boolean {
  return (
    live.status === 'BUZZERS_OPEN' &&
    live.timerEndsAt > 0 &&
    Date.now() > live.timerEndsAt
  );
}

function findDuplicate(live: LiveState, name: string): Responder | undefined {
  const needle = name.trim().toLowerCase();
  return Object.values(live.responders || {}).find(
    (r) => r.name.trim().toLowerCase() === needle
  );
}

/** Returns a rejection result, or null when the attempt may proceed. */
function precheck(
  live: LiveState | null,
  name: string,
  attemptHash: string
): SubmitResult | null {
  if (
    !live ||
    !live.text ||
    live.questionNumber <= 0 ||
    !live.answerHash
  ) {
    return {
      ok: false,
      code: 'NO_QUESTION',
      message: 'There is no active question right now. Stand by!',
    };
  }
  if (findDuplicate(live, name)) {
    return {
      ok: false,
      code: 'DUPLICATE',
      message: 'Your correct answer is already recorded. Well done!',
    };
  }
  if (live.status !== 'BUZZERS_OPEN' || isExpired(live)) {
    return {
      ok: false,
      code: 'CLOSED',
      message:
        live.status === 'PAUSED'
          ? 'Buzzers are paused. Hold your answer!'
          : 'Buzzers are closed for this question.',
    };
  }
  if (attemptHash !== live.answerHash) {
    return {
      ok: false,
      code: 'WRONG',
      message: 'Not quite right — try again while buzzers are open!',
    };
  }
  if ((live.correctCount || 0) >= (live.maxWinners || MAX_WINNERS)) {
    return {
      ok: false,
      code: 'FULL',
      message: 'So close! The first 10 winners are already in.',
    };
  }
  return null;
}

/** Mutates the draft in place (transaction-safe, no side effects). */
function applyClaim(
  draft: LiveState,
  name: string,
  house: HouseId
): { position: number; points: number } {
  const position = (draft.correctCount || 0) + 1;
  const key = `r${Date.now().toString(36)}${Math.floor(
    Math.random() * 1e6
  ).toString(36)}`;
  draft.responders = draft.responders || {};
  draft.responders[key] = {
    name: name.trim(),
    house,
    at: Date.now(),
    position,
  };
  draft.correctCount = position;
  const standings = { ...(draft.standings || DEFAULT_STANDINGS) };
  standings[house] = Math.max(0, (standings[house] || 0) + (draft.pointValue || 0));
  draft.standings = standings;
  return { position, points: draft.pointValue || 0 };
}

function liveRef() {
  if (!db) throw new Error('Firebase database unavailable');
  return ref(db, LIVE_PATH);
}

async function patchLive(patch: Partial<LiveState>): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    updateDemoLive(patch);
    return;
  }
  await update(liveRef(), { ...patch, updatedAt: Date.now() });
}

// ------------------------------------------------------------- listeners ---
export function subscribeToLiveState(cb: (live: LiveState) => void): () => void {
  if (!isFirebaseConfigured || !db) return subscribeDemoLive(cb);
  const unsub = onValue(liveRef(), (snap) => {
    const val = snap.val() as LiveState | null;
    cb(val ?? defaultLiveState());
  });
  return () => unsub();
}

export async function getLiveOnce(): Promise<LiveState> {
  if (!isFirebaseConfigured || !db) return getLiveSnapshot();
  const snap = await get(liveRef());
  return (snap.val() as LiveState | null) ?? defaultLiveState();
}

// ------------------------------------------------------------ submission ---
export async function submitAnswer(input: {
  name: string;
  house: HouseId;
  answer: string;
}): Promise<SubmitResult> {
  const cleanName = (input.name || '').trim();
  if (cleanName.length < 2) {
    return {
      ok: false,
      code: 'ERROR',
      message: 'Please set your name (2+ characters) before answering.',
    };
  }
  const normalized = normalizeAnswer(input.answer);
  if (!normalized) {
    return { ok: false, code: 'ERROR', message: 'Please enter an answer.' };
  }
  const attemptHash = await hashAnswer(normalized);

  // ---- demo backend (identical rules, local atomic transaction) ----
  if (!isFirebaseConfigured || !db) {
    const snap = getLiveSnapshot();
    const blocked = precheck(snap, cleanName, attemptHash);
    if (blocked) return blocked;
    const res = transactionDemoLive((draft) => {
      const blockedAgain = precheck(draft, cleanName, attemptHash);
      if (blockedAgain) return { ok: false, reason: blockedAgain.code };
      applyClaim(draft, cleanName, input.house);
      return { ok: true, next: draft };
    });
    if (!res.committed) {
      return {
        ok: false,
        code: 'FULL',
        message: 'Just missed it — the winners circle filled up!',
      };
    }
    return {
      ok: true,
      code: 'SUCCESS',
      message: `Correct! You are winner #${res.live.correctCount}.`,
      position: res.live.correctCount,
      points: res.live.pointValue,
    };
  }

  // ---- Firebase backend ----
  let current: LiveState | null;
  try {
    current = ((await get(liveRef())).val() as LiveState | null) ?? null;
  } catch {
    return {
      ok: false,
      code: 'ERROR',
      message: 'Network hiccup — check your connection and retry.',
    };
  }
  const blocked = precheck(current, cleanName, attemptHash);
  if (blocked) return blocked;

  try {
    const result = await runTransaction(liveRef(), (cur: unknown) => {
      if (!cur || typeof cur !== 'object') return; // abort
      const st = cur as LiveState;
      if (!st.text || !st.answerHash || st.status !== 'BUZZERS_OPEN') return;
      if (st.timerEndsAt > 0 && Date.now() > st.timerEndsAt) return;
      const dup = Object.values((st.responders || {}) as Record<string, Responder>).some(
        (r) => r.name.trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (dup) return;
      if (attemptHash !== st.answerHash) return;
      if ((st.correctCount || 0) >= (st.maxWinners || MAX_WINNERS)) return;
      const position = (st.correctCount || 0) + 1;
      const key = `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
      const responders = { ...(st.responders || {}) };
      responders[key] = {
        name: cleanName,
        house: input.house,
        at: Date.now(),
        position,
      };
      const standings = { ...(st.standings || DEFAULT_STANDINGS) };
      standings[input.house] = Math.max(
        0,
        (standings[input.house] || 0) + (st.pointValue || 0)
      );
      return {
        ...st,
        responders,
        correctCount: position,
        standings,
        updatedAt: Date.now(),
      };
    });

    if (!result.committed) {
      const fresh =
        ((await get(liveRef())).val() as LiveState | null) ?? null;
      const again = precheck(fresh, cleanName, attemptHash);
      return (
        again ?? {
          ok: false,
          code: 'FULL',
          message: 'Just missed it — the winners circle filled up!',
        }
      );
    }
    const updated = result.snapshot.val() as LiveState;
    return {
      ok: true,
      code: 'SUCCESS',
      message: `Correct! You are winner #${updated.correctCount}.`,
      position: updated.correctCount,
      points: updated.pointValue,
    };
  } catch {
    return {
      ok: false,
      code: 'ERROR',
      message: 'Submission failed. Check your connection and retry.',
    };
  }
}

// -------------------------------------------------------- officer actions ---
export interface PublishInput {
  text: string;
  type: QuestionType;
  options: string[];
  correctAnswer: string;
  pointValue: number;
}

export async function publishQuestion(
  input: PublishInput
): Promise<{ ok: boolean; message: string; questionNumber?: number }> {
  const text = (input.text || '').trim();
  if (text.length < 3) {
    return { ok: false, message: 'Question text is too short.' };
  }
  const pointValue = Math.max(1, Math.floor(input.pointValue || 0));
  if (!pointValue) return { ok: false, message: 'Point value must be ≥ 1.' };
  const correct = normalizeAnswer(input.correctAnswer);
  if (!correct) {
    return { ok: false, message: 'A hidden correct answer is required.' };
  }
  let options: string[] = [];
  if (input.type === 'MULTIPLE_CHOICE') {
    options = (input.options || []).map((o) => o.trim()).filter(Boolean);
    if (options.length < 2) {
      return { ok: false, message: 'MCQ needs at least 2 options.' };
    }
    options = options.slice(0, 4);
  }

  const answerHash = await hashAnswer(correct);
  const base = await getLiveOnce();
  const next: LiveState = {
    ...defaultLiveState(),
    standings: base.standings || { ...DEFAULT_STANDINGS },
    questionNumber: (base.questionNumber || 0) + 1,
    text,
    type: input.type,
    options,
    pointValue,
    status: 'IDLE',
    answerHash,
    revealAnswer: '',
    maxWinners: MAX_WINNERS,
  };

  try {
    if (!isFirebaseConfigured || !db) {
      replaceDemoLive(next);
    } else {
      await set(liveRef(), { ...next, updatedAt: Date.now() });
    }
    return {
      ok: true,
      message: `Question ${next.questionNumber} published. Open the buzzers when ready!`,
      questionNumber: next.questionNumber,
    };
  } catch {
    return { ok: false, message: 'Publish failed — check the connection.' };
  }
}

export async function openBuzzers(seconds: number): Promise<void> {
  const secs = Math.max(3, Math.floor(seconds || 30));
  await patchLive({
    status: 'BUZZERS_OPEN',
    timerDuration: secs,
    timerEndsAt: Date.now() + secs * 1000,
    pausedRemaining: 0,
  });
}

export async function pauseQuiz(): Promise<void> {
  const cur = await getLiveOnce();
  if (cur.status !== 'BUZZERS_OPEN') return;
  const remaining =
    cur.timerEndsAt > 0
      ? Math.max(0, Math.ceil((cur.timerEndsAt - Date.now()) / 1000))
      : cur.timerDuration || 0;
  await patchLive({ status: 'PAUSED', pausedRemaining: remaining, timerEndsAt: 0 });
}

export async function resumeQuiz(): Promise<void> {
  const cur = await getLiveOnce();
  if (cur.status !== 'PAUSED') return;
  const remaining = cur.pausedRemaining > 0 ? cur.pausedRemaining : cur.timerDuration || 30;
  await patchLive({
    status: 'BUZZERS_OPEN',
    timerEndsAt: Date.now() + remaining * 1000,
    pausedRemaining: 0,
  });
}

export async function markTimeUp(): Promise<void> {
  const cur = await getLiveOnce();
  if (cur.status !== 'BUZZERS_OPEN') return;
  await patchLive({ status: 'TIME_UP' });
}

export async function revealQuizAnswer(plaintext: string): Promise<void> {
  await patchLive({ revealAnswer: (plaintext || '').trim(), status: 'ANSWER_REVEALED' });
}

/** Ends the question and clears its secret material (keeps standings). */
export async function clearQuestion(): Promise<void> {
  const cur = await getLiveOnce();
  const cleared: LiveState = {
    ...defaultLiveState(),
    standings: cur.standings || { ...DEFAULT_STANDINGS },
    questionNumber: cur.questionNumber || 0,
  };
  if (!isFirebaseConfigured || !db) {
    replaceDemoLive(cleared);
  } else {
    await set(liveRef(), { ...cleared, updatedAt: Date.now() });
  }
}

export async function adjustPoints(house: HouseId, delta: number): Promise<void> {
  if (!delta) return;
  if (!isFirebaseConfigured || !db) {
    transactionDemoLive((draft) => {
      const s = { ...(draft.standings || DEFAULT_STANDINGS) };
      s[house] = Math.max(0, (s[house] || 0) + delta);
      draft.standings = s;
      return { ok: true, next: draft };
    });
    return;
  }
  await runTransaction(liveRef(), (cur: unknown) => {
    const base = (cur as LiveState | null) ?? defaultLiveState();
    const s = { ...(base.standings || DEFAULT_STANDINGS) };
    s[house] = Math.max(0, (s[house] || 0) + delta);
    return { ...base, standings: s, updatedAt: Date.now() };
  });
}

/** Full season reset: standings to zero and question cleared. */
export async function resetSeason(): Promise<void> {
  const fresh = defaultLiveState();
  if (!isFirebaseConfigured || !db) {
    replaceDemoLive(fresh);
    return;
  }
  await set(liveRef(), { ...fresh, updatedAt: Date.now() });
}
