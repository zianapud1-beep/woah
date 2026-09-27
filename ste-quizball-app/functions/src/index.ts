import { setGlobalOptions } from 'firebase-functions/v2';
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase, ServerValue } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

initializeApp();

setGlobalOptions({ region: 'asia-southeast1', maxInstances: 10 });

const db = () => getDatabase();
const store = () => getFirestore();

/** Must match `MAX_RESPONDERS` in `services/answerLogic.ts`. */
const MAX_RESPONDERS = 10;

const HOUSES = ['zeus', 'poseidon', 'athena', 'aphrodite'] as const;
type House = (typeof HOUSES)[number];

const MESSAGES = {
  CORRECT_ACCEPTED: 'Correct! The vault opens for your house.',
  INCORRECT: 'Not this time — the marble statue remains closed. Wait for the reveal.',
  FULL: 'The first 10 correct answers are already in. Try the next question.',
  DUPLICATE: 'Your answer for this question is already recorded.',
  CLOSED: 'Buzzers are closed. The next question is being prepared.',
  NO_QUESTION: 'No question is on the board yet. Stand by.',
  RATE_LIMITED: 'Too many buzzer attempts. Wait for the next question.',
} as const;

/** Mirrors `normalizeAnswer()` in services/answerLogic.ts. */
function normalizeAnswer(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[.。]+$/u, '')
    .replace(/^["'“”‘’(\[{\s]+/, '')
    .replace(/["'“”‘’)\]}.,;:!?]+$/u, '')
    .trim();
}

function matches(candidate: string, secure: SecureAnswer): boolean {
  if (!candidate) return false;
  if (secure.optionId && candidate === secure.optionId.toLowerCase()) return true;
  if (candidate === normalizeAnswer(secure.answer)) return true;
  return (secure.alternates ?? []).some(
    (alt) => normalizeAnswer(alt) === candidate,
  );
}

interface SecureAnswer {
  questionId: string;
  answer: string;
  alternates: string[];
  optionId: string | null;
}

interface ActiveQuestion {
  id: string;
  index: number;
  text: string;
  type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';
  options: { id: string; label: string }[];
  pointValue: number;
  status: string;
  timerSeconds: number;
  endsAt: number | null;
  correctCount: number;
}

interface SubmitPayload {
  studentId: string;
  name: string;
  house: string;
  answer: string;
}

/** Per-device attempt throttle — one buzz per second is plenty. */
const attemptWindow = new Map<string, number[]>();
function throttled(key: string): boolean {
  const now = Date.now();
  const hits = (attemptWindow.get(key) ?? []).filter((t) => now - t < 2000);
  if (hits.length >= 3) {
    attemptWindow.set(key, hits);
    return true;
  }
  hits.push(now);
  attemptWindow.set(key, hits);
  if (attemptWindow.size > 5000) attemptWindow.clear();
  return false;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  submitAnswer — the scoring endpoint.
 *
 *  The hidden answer never leaves this function. Everything the client sends
 *  is validated here and committed in ONE Realtime Database transaction:
 *
 *      1. the question is live and the buzzer deadline has not passed
 *      2. this device has not already answered this question
 *      3. the normalised answer matches the stored answer / alternates
 *      4. fewer than MAX_RESPONDERS correct answers are banked
 *      5. the responder is appended AND the house total is incremented
 *
 *  Steps 4 and 5 happen atomically, so with 40 phones buzzing at once the
 *  eleventh correct answer is rejected — the counter can never overshoot.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const submitAnswer = onCall(async (request: CallableRequest<SubmitPayload>) => {
  const { studentId, name, house, answer } = request.data ?? ({} as SubmitPayload);

  if (typeof studentId !== 'string' || studentId.length < 4) {
    throw new HttpsError('invalid-argument', 'A student identity is required.');
  }
  if (typeof name !== 'string' || !name.trim() || name.length > 64) {
    throw new HttpsError('invalid-argument', 'A valid name is required.');
  }
  if (!HOUSES.includes(house as House)) {
    throw new HttpsError('invalid-argument', 'Unknown house.');
  }
  if (typeof answer !== 'string' || !normalizeAnswer(answer)) {
    return { status: 'INCORRECT', message: MESSAGES.INCORRECT, pointsAwarded: 0 };
  }
  if (throttled(`${request.rawRequest.ip ?? 'unknown'}:${studentId}`)) {
    return { status: 'RATE_LIMITED', message: MESSAGES.RATE_LIMITED, pointsAwarded: 0 };
  }

  const sessionRef = db().ref('ste_event/session');
  const now = Date.now();

  let result: {
    status: keyof typeof MESSAGES;
    pointsAwarded: number;
    houseTotal: number;
  } | null = null;

  const committed = await sessionRef.transaction(
    async (current): Promise<unknown> => {
      const node = (current ?? {}) as {
        activeQuestion?: ActiveQuestion | null;
        secureAnswer?: SecureAnswer | null;
        correctResponders?: Record<string, unknown>;
        submissions?: Record<string, { questionId: string }>;
        housePoints?: Record<string, number>;
      };

      const question = node.activeQuestion ?? null;
      const secure = node.secureAnswer ?? null;
      const responders = node.correctResponders ?? {};
      const submissions = node.submissions ?? {};
      const points = node.housePoints ?? {
        zeus: 0,
        poseidon: 0,
        athena: 0,
        aphrodite: 0,
      };

      const fail = (status: keyof typeof MESSAGES) => {
        result = { status, pointsAwarded: 0, houseTotal: points[house as House] ?? 0 };
        return undefined; // aborts the transaction
      };

      if (!question || !secure || secure.questionId !== question.id) {
        return fail('NO_QUESTION');
      }
      if (question.status !== 'BUZZERS_OPEN') return fail('CLOSED');
      if (question.endsAt != null && now >= question.endsAt) return fail('CLOSED');
      if (submissions[studentId]?.questionId === question.id) {
        return fail('DUPLICATE');
      }
      if (!matches(normalizeAnswer(answer), secure)) return fail('INCORRECT');
      if (Object.keys(responders).length >= MAX_RESPONDERS) return fail('FULL');

      const accepted = Math.min(
        MAX_RESPONDERS,
        Object.keys(responders).length + 1,
      );
      const houseTotal = (points[house as House] ?? 0) + question.pointValue;

      result = {
        status: 'CORRECT_ACCEPTED',
        pointsAwarded: question.pointValue,
        houseTotal,
      };

      return {
        ...node,
        correctResponders: {
          ...responders,
          [studentId]: { name: name.trim().slice(0, 64), house, at: now },
        },
        submissions: {
          ...submissions,
          [studentId]: {
            questionId: question.id,
            correct: true,
            answer: normalizeAnswer(answer).slice(0, 120),
            at: now,
          },
        },
        housePoints: { ...points, [house]: houseTotal },
        activeQuestion: {
          ...question,
          correctCount: accepted,
          submissionCount: (question.submissionCount ?? 0) + 1,
        },
        updatedAt: now,
      };
    },
    { applyLocally: false },
  );

  if (!result) {
    // The transaction was aborted by a rejection (or the ledger moved under us).
    return committed.committed
      ? { status: 'CORRECT_ACCEPTED', message: MESSAGES.CORRECT_ACCEPTED, pointsAwarded: 0 }
      : { status: 'CLOSED', message: MESSAGES.CLOSED, pointsAwarded: 0 };
  }

  const payload = result as { status: keyof typeof MESSAGES; pointsAwarded: number; houseTotal: number };
  logger.info('buzzer', {
    studentId,
    house,
    status: payload.status,
    points: payload.pointsAwarded,
  });

  return {
    status: payload.status,
    message: MESSAGES[payload.status],
    pointsAwarded: payload.pointsAwarded,
    houseTotal: payload.houseTotal,
  };
});

/**
 * Grant (or revoke) the `officer` custom claim. Run once per faculty
 * account from a trusted machine — it is intentionally not callable by the app.
 *
 *   curl -X POST https://REGION-PROJECT.cloudfunctions.net/grantOfficerClaim \
 *     -H 'Authorization: Bearer <ID token of an admin>' \
 *     -d '{"uid":"<auth uid>","officer":true}'
 */
export const grantOfficerClaim = onRequest(async (req, res) => {
  const auth = req.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Bearer token required' });
    return;
  }

  const { getAuth } = await import('firebase-admin/auth');
  const decoded = await getAuth().verifyIdToken(auth.slice(7));
  if (decoded.admin !== true) {
    res.status(403).json({ error: 'Admin token required' });
    return;
  }

  const uid = (req.body?.uid as string) ?? '';
  const officer = req.body?.officer !== false;
  if (!uid) {
    res.status(400).json({ error: 'uid is required' });
    return;
  }

  await getAuth().setCustomUserClaims(uid, { officer });
  res.json({ ok: true, uid, officer });
});

/** Health/diagnostic endpoint for the officer panel. */
export const quizballStatus = onRequest(async (_req, res) => {
  const snapshot = await db().ref('ste_event/session').get();
  const value = (snapshot.val() ?? {}) as {
    activeQuestion?: ActiveQuestion | null;
    housePoints?: Record<string, number>;
  };
  const bulletin = await store().collection('bulletin_posts').count().get();

  res.json({
    live: !!value.activeQuestion,
    question: value.activeQuestion?.id ?? null,
    housePoints: value.housePoints ?? {},
    bulletinPosts: bulletin.data().count,
    responderCap: MAX_RESPONDERS,
    serverTime: ServerValue.TIMESTAMP,
  });
});
