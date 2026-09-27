import type {
  ActiveQuestion,
  HouseId,
  QuestionOption,
  QuestionType,
  QuizStatus,
  SecureAnswer,
  SubmissionStatus,
} from './types';

/**
 * Hard cap for a single question — "the first 10 correct answers score".
 * The same constant is mirrored in `functions/src/index.ts`.
 */
export const MAX_RESPONDERS = 10;

/**
 * Normalises a learner answer so that "  Ohm's  LAW " === "ohm's law".
 *
 * Rules (in order): trim → lowercase → strip curly apostrophes → collapse
 * inner whitespace → strip a trailing full stop → drop surrounding quotes and
 * brackets. Deliberately conservative: it never removes characters that could
 * change the meaning of a chemistry formula.
 */
export function normalizeAnswer(input: string | null | undefined): string {
  if (!input) return '';
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

/** True when `candidate` matches the primary answer or any accepted alternate. */
export function answerMatches(candidate: string, secure: SecureAnswer): boolean {
  const value = normalizeAnswer(candidate);
  if (!value) return false;

  if (secure.optionId && value === secure.optionId.toLowerCase()) return true;
  if (value === normalizeAnswer(secure.answer)) return true;
  return secure.alternates.some((alt) => normalizeAnswer(alt) === value);
}

export interface DecisionContext {
  question: ActiveQuestion | null;
  secure: SecureAnswer | null;
  /** Number of entries currently in the `correctResponders` map. */
  correctResponderCount: number;
  /** `true` when this student already answered this question. */
  alreadyAnswered: boolean;
  candidate: string;
  housePoints: Record<HouseId, number>;
  /** Wall-clock reference used for the buzzer deadline (ms since epoch). */
  now: number;
}

export interface Decision {
  status: SubmissionStatus;
  message: string;
  pointsAwarded: number;
  houseTotal: number;
  /** `true` when the transaction must be committed. */
  accept: boolean;
}

const polite: Record<SubmissionStatus, string> = {
  CORRECT_ACCEPTED: 'Correct! The vault opens for your house.',
  INCORRECT:
    'Not this time — the marble statue remains closed. Wait for the reveal.',
  FULL: 'The first 10 correct answers are already in. Try the next question.',
  DUPLICATE: 'Your answer for this question is already recorded.',
  CLOSED: 'Buzzers are closed. The next question is being prepared.',
  NO_QUESTION: 'No question is on the board yet. Stand by.',
  NETWORK_ERROR: 'The link to the hall failed. Please try once more.',
};

/**
 * The single source of truth for the "first 10" rule.
 *
 * It is intentionally pure so the exact same function powers the client
 * transaction, the offline demo backend and (mirrored) the Cloud Function.
 */
export function decideSubmission(ctx: DecisionContext, house: HouseId): Decision {
  const reject = (status: SubmissionStatus): Decision => ({
    status,
    message: polite[status],
    pointsAwarded: 0,
    houseTotal: ctx.housePoints[house] ?? 0,
    accept: false,
  });

  if (!ctx.question || !ctx.secure) return reject('NO_QUESTION');
  if (ctx.secure.questionId !== ctx.question.id) return reject('NO_QUESTION');
  if (ctx.question.status !== 'BUZZERS_OPEN') return reject('CLOSED');
  // The buzzer deadline is authoritative even if the officer never pressed
  // "time up": once `endsAt` has passed, late answers are refused.
  if (ctx.question.endsAt != null && ctx.now >= ctx.question.endsAt) {
    return reject('CLOSED');
  }
  if (ctx.alreadyAnswered) return reject('DUPLICATE');

  const value = normalizeAnswer(ctx.candidate);

  if (!answerMatches(value, ctx.secure)) return reject('INCORRECT');

  // The cutoff is evaluated *after* correctness so a late correct answer gets
  // the courteous "already full" message rather than "wrong".
  if (ctx.correctResponderCount >= MAX_RESPONDERS) return reject('FULL');

  const points = ctx.question.pointValue;
  return {
    status: 'CORRECT_ACCEPTED',
    message: polite.CORRECT_ACCEPTED,
    pointsAwarded: points,
    houseTotal: (ctx.housePoints[house] ?? 0) + points,
    accept: true,
  };
}

/* ---------------------------------------------------------------- helpers */

export function makeOptions(labels: string[]): QuestionOption[] {
  return labels
    .map((label) => label.trim())
    .filter((label) => label.length > 0)
    .map((label, i) => ({ id: String.fromCharCode(65 + i), label }));
}

export function emptyQuestion(type: QuestionType, index: number): ActiveQuestion {
  return {
    id: '',
    index,
    text: '',
    type,
    options:
      type === 'MULTIPLE_CHOICE'
        ? makeOptions(['', '', '', ''])
        : [],
    pointValue: 10,
    status: 'IDLE',
    timerSeconds: 30,
    endsAt: null,
    startedAt: null,
    correctCount: 0,
    submissionCount: 0,
    revealedOptionId: null,
    revealedAnswer: null,
    bonusHouse: null,
  };
}

export function isBuzzing(status: QuizStatus): boolean {
  return status === 'BUZZERS_OPEN';
}

export function describeStatus(status: QuizStatus): string {
  switch (status) {
    case 'IDLE':
      return 'AWAITING THE OFFICER';
    case 'BUZZERS_OPEN':
      return 'BUZZERS OPEN';
    case 'PAUSED':
      return 'PAUSED';
    case 'TIME_UP':
      return 'TIME UP';
    case 'ANSWER_REVEALED':
      return 'ANSWER REVEALED';
    case 'CLOSED':
      return 'QUESTION CLOSED';
  }
}
