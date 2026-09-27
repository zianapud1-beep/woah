import type { HouseId } from '../styles/theme';

/** Quiz question format */
export type QuestionType = 'MULTIPLE_CHOICE' | 'BLANK';

/** Live quiz lifecycle */
export type QuizStatus =
  | 'IDLE'
  | 'BUZZERS_OPEN'
  | 'PAUSED'
  | 'TIME_UP'
  | 'ANSWER_REVEALED';

export interface Responder {
  name: string;
  house: HouseId;
  at: number;
  position: number;
}

/**
 * Single atomic live node (Realtime Database `ste2026/live`).
 * NOTE: the plaintext correct answer is NEVER stored here — only a
 * one-way SHA-256 `answerHash`. `revealAnswer` stays empty until an
 * officer explicitly reveals it, so students cannot snoop the answer
 * from readable state.
 */
export interface LiveState {
  questionNumber: number;
  text: string;
  type: QuestionType;
  options: string[];
  pointValue: number;
  status: QuizStatus;
  timerDuration: number;
  timerEndsAt: number;
  pausedRemaining: number;
  answerHash: string;
  revealAnswer: string;
  correctCount: number;
  maxWinners: number;
  responders: Record<string, Responder>;
  standings: Record<HouseId, number>;
  updatedAt: number;
}

export type BulletinHouse =
  | 'ALL'
  | 'ZEUS'
  | 'POSEIDON'
  | 'ATHENA'
  | 'APHRODITE';

export interface Bulletin {
  id: string;
  title: string;
  body: string;
  house: BulletinHouse;
  eventDate: string;
  location: string;
  author: string;
  createdAt: number;
}

export interface StudentProfile {
  name: string;
  house: HouseId;
}

export const DEFAULT_STANDINGS: Record<HouseId, number> = {
  zeus: 0,
  poseidon: 0,
  athena: 0,
  aphrodite: 0,
};

export function defaultLiveState(): LiveState {
  return {
    questionNumber: 0,
    text: '',
    type: 'MULTIPLE_CHOICE',
    options: [],
    pointValue: 10,
    status: 'IDLE',
    timerDuration: 0,
    timerEndsAt: 0,
    pausedRemaining: 0,
    answerHash: '',
    revealAnswer: '',
    correctCount: 0,
    maxWinners: 10,
    responders: {},
    standings: { ...DEFAULT_STANDINGS },
    updatedAt: Date.now(),
  };
}
