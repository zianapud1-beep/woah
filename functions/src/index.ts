import { randomUUID, timingSafeEqual } from 'node:crypto';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';

if (admin.apps.length === 0) admin.initializeApp();

const db = admin.database();
const OFFICER_PIN = defineSecret('OFFICER_PIN');
const MAX_CORRECT_RESPONDERS = 10;
const HOUSE_IDS = ['ZEUS', 'POSEIDON', 'ATHENA', 'APHRODITE'] as const;
type HouseId = (typeof HOUSE_IDS)[number];
type QuestionType = 'MULTIPLE_CHOICE' | 'BLANK/SHORT_ANSWER';
type PublicStatus = 'IDLE' | 'READY' | 'BUZZERS_OPEN' | 'PAUSED' | 'TIME_UP' | 'ANSWER_REVEALED';

type PublicQuiz = {
  questionId: string;
  questionNumber: number;
  text: string;
  type: QuestionType;
  options: string[];
  pointValue: number;
  status: PublicStatus;
  timer: { duration: number; remaining: number; endsAt: number | null; isRunning: boolean };
  correctAnswersReceived: number;
  correctAnswersLimit: number;
  revealedAnswer?: string;
  updatedAt: number;
};

type GameState = {
  public?: PublicQuiz;
  private?: { questionId: string; correctAnswer: string } | null;
  standings?: Record<HouseId, number>;
  correct_responders?: Array<{ uid: string; name: string; house: HouseId; acceptedAt: number }>;
  submissions?: Record<string, { code: string; submittedAt: number }>;
};

function requireUser(request: CallableRequest<unknown>) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in before continuing.');
  return request.auth.uid;
}

function requireOfficer(request: CallableRequest<unknown>) {
  requireUser(request);
  if (request.auth?.token.admin !== true) {
    throw new HttpsError('permission-denied', 'Officer access is required for this action.');
  }
}

function normalizeAnswer(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function cleanText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== 'string') throw new HttpsError('invalid-argument', `${field} is required.`);
  const result = value.trim();
  if (!result || result.length > maxLength) {
    throw new HttpsError('invalid-argument', `${field} must be between 1 and ${maxLength} characters.`);
  }
  return result;
}

function emptyState(): GameState {
  return {
    public: {
      questionId: '',
      questionNumber: 0,
      text: 'The next challenge is being prepared.',
      type: 'MULTIPLE_CHOICE',
      options: [],
      pointValue: 0,
      status: 'IDLE',
      timer: { duration: 0, remaining: 0, endsAt: null, isRunning: false },
      correctAnswersReceived: 0,
      correctAnswersLimit: MAX_CORRECT_RESPONDERS,
      updatedAt: Date.now(),
    },
    private: null,
    standings: { ZEUS: 0, POSEIDON: 0, ATHENA: 0, APHRODITE: 0 },
    correct_responders: [],
    submissions: {},
  };
}

function asState(state: GameState | null): GameState {
  const base = emptyState();
  if (!state) return base;
  return {
    ...base,
    ...state,
    public: { ...base.public!, ...state.public },
    standings: { ...base.standings!, ...state.standings },
    correct_responders: Array.isArray(state.correct_responders) ? state.correct_responders : [],
    submissions: state.submissions ?? {},
  };
}

function integerInRange(value: unknown, field: string, minimum: number, maximum: number) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new HttpsError('invalid-argument', `${field} must be a whole number from ${minimum} to ${maximum}.`);
  }
  return number;
}

export const unlockOfficer = onCall({ secrets: [OFFICER_PIN] }, async (request) => {
  const uid = requireUser(request);
  const submittedPin = typeof request.data?.pin === 'string' ? request.data.pin : '';
  const configuredPin = OFFICER_PIN.value();
  const submittedBytes = Buffer.from(submittedPin, 'utf8');
  const configuredBytes = Buffer.from(configuredPin, 'utf8');
  if (!configuredPin || submittedBytes.length !== configuredBytes.length || !timingSafeEqual(submittedBytes, configuredBytes)) {
    throw new HttpsError('permission-denied', 'That officer PIN is not correct.');
  }

  const user = await admin.auth().getUser(uid);
  await admin.auth().setCustomUserClaims(uid, { ...(user.customClaims ?? {}), admin: true });
  return { authorized: true };
});

export const lockOfficer = onCall(async (request) => {
  const uid = requireUser(request);
  const user = await admin.auth().getUser(uid);
  const claims = { ...(user.customClaims ?? {}) };
  delete claims.admin;
  await admin.auth().setCustomUserClaims(uid, claims);
  return { locked: true };
});

export const publishQuestion = onCall(async (request) => {
  requireOfficer(request);
  const data = request.data ?? {};
  const text = cleanText(data.text, 'Question text', 1000);
  const correctAnswer = cleanText(data.correctAnswer, 'Correct answer', 300);
  const type: QuestionType = data.type === 'BLANK/SHORT_ANSWER' ? 'BLANK/SHORT_ANSWER' : 'MULTIPLE_CHOICE';
  const pointValue = integerInRange(data.pointValue, 'Point value', 1, 1000);
  let options: string[] = [];

  if (type === 'MULTIPLE_CHOICE') {
    if (!Array.isArray(data.options) || data.options.length !== 4) {
      throw new HttpsError('invalid-argument', 'A multiple-choice question must have exactly four options.');
    }
    options = data.options.map((option: unknown, index: number) => cleanText(option, `Option ${index + 1}`, 250));
    if (new Set(options.map(normalizeAnswer)).size !== 4) {
      throw new HttpsError('invalid-argument', 'Each answer option must be different.');
    }
    if (!options.some((option) => normalizeAnswer(option) === normalizeAnswer(correctAnswer))) {
      throw new HttpsError('invalid-argument', 'The correct answer must match one of the four options.');
    }
  }

  const questionId = randomUUID();
  let questionNumber = 0;
  const transaction = await db.ref('quizState').transaction((existing: GameState | null) => {
    const current = asState(existing);
    questionNumber = (Number(current.public?.questionNumber) || 0) + 1;
    const publicState: PublicQuiz = {
      questionId,
      questionNumber,
      text,
      type,
      options,
      pointValue,
      status: 'READY',
      timer: { duration: 0, remaining: 0, endsAt: null, isRunning: false },
      correctAnswersReceived: 0,
      correctAnswersLimit: MAX_CORRECT_RESPONDERS,
      updatedAt: Date.now(),
    };
    return {
      ...current,
      public: publicState,
      private: { questionId, correctAnswer },
      correct_responders: [],
      submissions: {},
      standings: current.standings ?? emptyState().standings,
    };
  });

  if (!transaction.committed) throw new HttpsError('aborted', 'The question could not be published. Please try again.');
  return { questionId, questionNumber };
});

export const controlQuizTimer = onCall(async (request) => {
  requireOfficer(request);
  const action = request.data?.action;
  if (!['start', 'pause', 'reset'].includes(action)) throw new HttpsError('invalid-argument', 'Choose start, pause, or reset.');
  const duration = action === 'start' ? integerInRange(request.data?.duration, 'Timer duration', 10, 60) : undefined;
  if (duration !== undefined && ![10, 30, 60].includes(duration)) {
    throw new HttpsError('invalid-argument', 'Choose a 10, 30, or 60 second timer.');
  }

  const failure: { message?: string } = {};
  const transaction = await db.ref('quizState').transaction((existing: GameState | null) => {
    if (!existing?.public?.questionId) {
      failure.message = 'Publish a question before starting its timer.';
      return;
    }
    const current = asState(existing);
    const quiz = current.public!;
    const now = Date.now();

    if (action === 'start') {
      const seconds = duration!;
      quiz.timer = { duration: seconds, remaining: seconds, endsAt: now + seconds * 1000, isRunning: true };
      quiz.status = 'BUZZERS_OPEN';
    } else if (action === 'pause') {
      if (quiz.timer.isRunning && quiz.timer.endsAt) {
        const remaining = Math.max(0, Math.ceil((quiz.timer.endsAt - now) / 1000));
        quiz.timer = { ...quiz.timer, remaining, endsAt: null, isRunning: false };
        quiz.status = remaining > 0 ? 'PAUSED' : 'TIME_UP';
      }
    } else {
      quiz.timer = { duration: 0, remaining: 0, endsAt: null, isRunning: false };
      quiz.status = 'READY';
    }
    quiz.updatedAt = now;
    return current;
  });

  if (failure.message) throw new HttpsError('failed-precondition', failure.message);
  if (!transaction.committed) throw new HttpsError('aborted', 'The timer update did not complete.');
  return { ok: true };
});

export const revealQuizAnswer = onCall(async (request) => {
  requireOfficer(request);
  const failure: { message?: string } = {};
  const transaction = await db.ref('quizState').transaction((existing: GameState | null) => {
    if (!existing?.public?.questionId || !existing.private?.correctAnswer) {
      failure.message = 'There is no answer to reveal yet.';
      return;
    }
    const current = asState(existing);
    const now = Date.now();
    const quiz = current.public!;
    if (quiz.timer.isRunning && quiz.timer.endsAt) {
      quiz.timer.remaining = Math.max(0, Math.ceil((quiz.timer.endsAt - now) / 1000));
    }
    quiz.timer.isRunning = false;
    quiz.timer.endsAt = null;
    quiz.status = 'ANSWER_REVEALED';
    quiz.revealedAnswer = current.private!.correctAnswer;
    quiz.updatedAt = now;
    return current;
  });
  if (failure.message) throw new HttpsError('failed-precondition', failure.message);
  if (!transaction.committed) throw new HttpsError('aborted', 'The answer could not be revealed.');
  return { ok: true };
});

export const setHousePoints = onCall(async (request) => {
  requireOfficer(request);
  const house = request.data?.house as HouseId;
  if (!HOUSE_IDS.includes(house)) throw new HttpsError('invalid-argument', 'Choose a valid house.');
  const points = integerInRange(request.data?.points, 'House points', 0, 1000000);

  const transaction = await db.ref('quizState').transaction((existing: GameState | null) => {
    const current = asState(existing);
    current.standings![house] = points;
    return current;
  });
  if (!transaction.committed) throw new HttpsError('aborted', 'The score could not be updated.');
  return { ok: true };
});

export const submitAnswer = onCall(async (request) => {
  const uid = requireUser(request);
  const data = request.data ?? {};
  const questionId = cleanText(data.questionId, 'Question ID', 80);
  const name = cleanText(data.name, 'Name', 48);
  const answer = cleanText(data.answer, 'Answer', 500);
  const house = data.house as HouseId;
  if (!HOUSE_IDS.includes(house)) throw new HttpsError('invalid-argument', 'Choose one of the four STE houses.');

  let code = 'NO_ACTIVE_QUESTION';
  let pointValue = 0;
  const transaction = await db.ref('quizState').transaction((existing: GameState | null) => {
    if (!existing?.public?.questionId || !existing.private?.correctAnswer) {
      code = 'NO_ACTIVE_QUESTION';
      return;
    }
    const current = asState(existing);
    const quiz = current.public!;
    if (quiz.questionId !== questionId || current.private?.questionId !== questionId) {
      code = 'QUESTION_CHANGED';
      return current;
    }
    if (current.submissions?.[uid]) {
      code = 'ALREADY_SUBMITTED';
      return current;
    }
    if (quiz.status !== 'BUZZERS_OPEN' || !quiz.timer.isRunning) {
      code = quiz.status === 'TIME_UP' ? 'TIME_UP' : 'BUZZERS_CLOSED';
      return current;
    }

    const now = Date.now();
    if (typeof quiz.timer.endsAt !== 'number' || now >= quiz.timer.endsAt) {
      quiz.timer.remaining = 0;
      quiz.timer.endsAt = null;
      quiz.timer.isRunning = false;
      quiz.status = 'TIME_UP';
      quiz.updatedAt = now;
      code = 'TIME_UP';
      return current;
    }

    const responders = current.correct_responders ?? [];
    const submissions = current.submissions ?? {};
    const alreadyCorrect = responders.length;
    if (alreadyCorrect >= MAX_CORRECT_RESPONDERS) {
      code = 'LIMIT_REACHED';
      return {
        ...current,
        submissions: { ...submissions, [uid]: { code, submittedAt: now } },
      };
    }

    if (normalizeAnswer(answer) !== normalizeAnswer(current.private!.correctAnswer)) {
      code = 'INCORRECT';
      return {
        ...current,
        submissions: { ...submissions, [uid]: { code, submittedAt: now } },
      };
    }

    pointValue = Math.max(0, Math.floor(Number(quiz.pointValue) || 0));
    code = 'CORRECT';
    const nextResponders = [...responders, { uid, name, house, acceptedAt: now }];
    const standings = { ...current.standings, ...emptyState().standings } as Record<HouseId, number>;
    standings[house] = Math.max(0, Number(standings[house]) || 0) + pointValue;

    return {
      ...current,
      correct_responders: nextResponders,
      submissions: { ...submissions, [uid]: { code, submittedAt: now } },
      standings,
      public: {
        ...quiz,
        correctAnswersReceived: nextResponders.length,
        updatedAt: now,
      },
    };
  });

  if (!transaction.committed && code === 'NO_ACTIVE_QUESTION') {
    return {
      code,
      accepted: false,
      locked: false,
      message: 'There is no live question to answer right now.',
    };
  }

  const messages: Record<string, string> = {
    CORRECT: `Correct! Your house earned ${pointValue} points.`,
    INCORRECT: 'Not quite. Your answer has been recorded; wait for the next question.',
    ALREADY_SUBMITTED: 'An answer has already been recorded for you in this round.',
    LIMIT_REACHED: 'The first ten correct responses are already in. Thank you for playing.',
    BUZZERS_CLOSED: 'The buzzers are closed for this round. Watch for the next question.',
    TIME_UP: 'Time is up for this question. Get ready for the next round.',
    QUESTION_CHANGED: 'The question changed before your answer arrived. Please check the live round.',
    NO_ACTIVE_QUESTION: 'There is no live question to answer right now.',
  };
  const locked = ['CORRECT', 'INCORRECT', 'ALREADY_SUBMITTED', 'LIMIT_REACHED'].includes(code);
  return {
    code,
    accepted: code === 'CORRECT',
    locked,
    message: messages[code] ?? 'Your answer could not be accepted. Please try again.',
    ...(code === 'CORRECT' ? { pointValue } : {}),
  };
});
