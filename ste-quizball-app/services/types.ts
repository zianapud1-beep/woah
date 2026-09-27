/**
 * Domain types shared by every screen, service and component.
 *
 * The active question that is broadcast to students is described by
 * `ActiveQuestion`. It deliberately contains **no** correct-answer material —
 * the answer only ever lives in `SecureAnswer` (Firebase) or inside the
 * officer's session (offline demo backend).
 */

/* ------------------------------------------------------------------ houses */

export type HouseId = 'zeus' | 'poseidon' | 'athena' | 'aphrodite';

export const HOUSE_IDS: readonly HouseId[] = [
  'zeus',
  'poseidon',
  'athena',
  'aphrodite',
] as const;

/* --------------------------------------------------------------- questions */

export type QuestionType = 'MULTIPLE_CHOICE' | 'SHORT_ANSWER';

export type QuizStatus =
  /** Nothing on the display board yet. */
  | 'IDLE'
  /** Question is on screen, buzzers are open, timer is running. */
  | 'BUZZERS_OPEN'
  /** Timer was paused by the officer; submissions are frozen. */
  | 'PAUSED'
  /** Timer expired; submissions rejected, answer not yet shown. */
  | 'TIME_UP'
  /** Correct answer is being shown to the hall. */
  | 'ANSWER_REVEALED'
  /** Question retired. */
  | 'CLOSED';

export interface QuestionOption {
  id: string;
  label: string;
}

/** Public, student-safe shape of the live question. */
export interface ActiveQuestion {
  /** Stable id — changes whenever a new question is pushed. */
  id: string;
  /** "Question 3" — monotonic counter maintained by the officer app. */
  index: number;
  text: string;
  type: QuestionType;
  /** Empty for SHORT_ANSWER. */
  options: QuestionOption[];
  pointValue: number;
  status: QuizStatus;
  /** Configured duration in seconds (10 / 30 / 60 …). */
  timerSeconds: number;
  /** Epoch ms when the countdown finishes; `null` while not running. */
  endsAt: number | null;
  /** Epoch ms when the current run started (used to resume after a pause). */
  startedAt: number | null;
  /** Accepted-correct count, hard-capped at MAX_RESPONDERS. */
  correctCount: number;
  /** Total answers received (right + wrong) — drives the live ticker. */
  submissionCount: number;
  /** Only ever written by the officer while status is ANSWER_REVEALED. */
  revealedOptionId: string | null;
  revealedAnswer: string | null;
  /** Optional house bonus (e.g. a lightning round for a single house). */
  bonusHouse: HouseId | null;
}

/** Officer-only payload. Never read by the student app in cloud-function mode. */
export interface SecureAnswer {
  questionId: string;
  /** Normalised primary answer. */
  answer: string;
  /** Normalised alternates (accepted synonyms) for SHORT_ANSWER. */
  alternates: string[];
  /** For MULTIPLE_CHOICE the accepted option id. */
  optionId: string | null;
}

export interface ResponderRecord {
  name: string;
  house: HouseId;
  at: number;
}

export type HousePoints = Record<HouseId, number>;

/* ------------------------------------------------------------ submissions */

export type SubmissionStatus =
  | 'CORRECT_ACCEPTED'
  | 'INCORRECT'
  | 'FULL'
  | 'DUPLICATE'
  | 'CLOSED'
  | 'NO_QUESTION'
  | 'NETWORK_ERROR';

export interface SubmissionResult {
  status: SubmissionStatus;
  message: string;
  pointsAwarded: number;
  /** Populated on success so the student portal can celebrate the right value. */
  houseTotal?: number;
}

export interface SubmissionRecord {
  questionId: string;
  correct: boolean;
  answer: string;
  at: number;
}

export interface SubmitAnswerInput {
  studentId: string;
  name: string;
  house: HouseId;
  answer: string;
}

/* ----------------------------------------------------------------- scores */

/** Everything the UI needs for one frame of live state. */
export interface QuizSnapshot {
  question: ActiveQuestion | null;
  points: HousePoints;
  correctResponders: Record<string, ResponderRecord>;
  updatedAt: number;
}

/* --------------------------------------------------------------- bulletin */

/**
 * Bulletin audiences are stored upper-case in Firestore so the officer forms
 * and the filter chips read exactly like the house banners.
 */
export type BulletinHouse =
  | 'ALL'
  | 'ZEUS'
  | 'POSEIDON'
  | 'ATHENA'
  | 'APHRODITE';

/** Map an upper-case bulletin audience onto the internal house id. */
export function bulletinHouseToId(house: BulletinHouse): HouseId | null {
  if (house === 'ALL') return null;
  return house.toLowerCase() as HouseId;
}

export type BulletinCategory =
  | 'EVENT'
  | 'ANNOUNCEMENT'
  | 'REMINDER'
  | 'RESULT';

export interface BulletinPost {
  id: string;
  title: string;
  body: string;
  house: BulletinHouse;
  category: BulletinCategory;
  /** ISO date (yyyy-mm-dd) of the event the post refers to. */
  eventDate: string;
  pinned: boolean;
  createdAt: number;
  createdBy: string;
}

/* ------------------------------------------------------------- connection */

export type BackendMode = 'firebase' | 'demo';

export type SubmissionMode = 'cloud-function' | 'transaction';

export interface ConnectionState {
  mode: BackendMode;
  /** `true` when the realtime link is healthy. */
  online: boolean;
  submissionMode: SubmissionMode;
  /** Human readable reason when degraded (e.g. rules locked the writes). */
  notice: string | null;
}
