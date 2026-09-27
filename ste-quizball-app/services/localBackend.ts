import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  MAX_RESPONDERS,
  decideSubmission,
  normalizeAnswer,
} from './answerLogic';
import type {
  ActiveQuestion,
  BulletinPost,
  HouseId,
  HousePoints,
  QuizSnapshot,
  ResponderRecord,
  SecureAnswer,
  SubmissionRecord,
  SubmissionResult,
  SubmitAnswerInput,
} from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  OFFLINE "CLASSROOM" BACKEND
 *
 *  A faithful, in-memory mirror of the Realtime Database + Firestore contract
 *  used by the production app. It exists so the app is fully demonstrable
 *  (and unit-testable) without credentials: same node names, same first-10
 *  rule, same listener semantics, same result shapes — just broadcast in
 *  process and persisted to AsyncStorage instead of the cloud.
 *
 *  `services/quizSync.ts` and `services/bulletinSync.ts` transparently pick
 *  this backend when Firebase is not configured.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const STORAGE_KEY = 'ste_quizball:local:v1';

export const EMPTY_POINTS: HousePoints = {
  zeus: 0,
  poseidon: 0,
  athena: 0,
  aphrodite: 0,
};

export interface LocalSession {
  activeQuestion: ActiveQuestion | null;
  secureAnswer: SecureAnswer | null;
  housePoints: HousePoints;
  correctResponders: Record<string, ResponderRecord>;
  submissions: Record<string, SubmissionRecord>;
  questionCounter: number;
  /** Milliseconds left when the timer is paused. */
  pausedRemainingMs: number | null;
  updatedAt: number;
}

export interface LocalState {
  session: LocalSession;
  bulletin: BulletinPost[];
}

const seedQuestion: ActiveQuestion = {
  id: 'seed-q1',
  index: 1,
  text: 'A 2 kg block slides down a frictionless 30° incline. Which force supplies the acceleration?',
  type: 'MULTIPLE_CHOICE',
  options: [
    { id: 'A', label: 'The normal force' },
    { id: 'B', label: 'The component of gravity along the plane' },
    { id: 'C', label: 'The friction force' },
    { id: 'D', label: 'The applied push' },
  ],
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

function seedState(): LocalState {
  const now = Date.now();
  return {
    session: {
      activeQuestion: { ...seedQuestion },
      secureAnswer: {
        questionId: seedQuestion.id,
        answer: 'b',
        alternates: [],
        optionId: 'B',
      },
      housePoints: { zeus: 120, poseidon: 100, athena: 90, aphrodite: 70 },
      correctResponders: {},
      submissions: {},
      questionCounter: 1,
      pausedRemainingMs: null,
      updatedAt: now,
    },
    bulletin: [
      {
        id: 'seed-b1',
        title: 'STE Week Opening Rite',
        body:
          'The Olympiad of Houses opens at 8:00 in the main hall. Full regalia, house banners at the ready.',
        house: 'ALL',
        category: 'EVENT',
        eventDate: isoDate(now),
        pinned: true,
        createdAt: now - 1000 * 60 * 60 * 26,
        createdBy: 'Facultad STE',
      },
      {
        id: 'seed-b2',
        title: 'Zeus — Electromagnetism Trial',
        body:
          'Report to Lab 3 for the Van de Graaff and lightning-rod practical. Safety goggles are mandatory.',
        house: 'ZEUS',
        category: 'REMINDER',
        eventDate: isoDate(now + 86_400_000),
        pinned: false,
        createdAt: now - 1000 * 60 * 60 * 20,
        createdBy: 'Engr. R. del Rosario',
      },
      {
        id: 'seed-b3',
        title: 'Poseidon — Fluid Mechanics Tank Trial',
        body:
          'The wave tank demonstration moves to the gymnasium. Bring your observation sheets and pencil cases.',
        house: 'POSEIDON',
        category: 'EVENT',
        eventDate: isoDate(now + 2 * 86_400_000),
        pinned: false,
        createdAt: now - 1000 * 60 * 60 * 8,
        createdBy: 'Ms. J. Bautista',
      },
      {
        id: 'seed-b4',
        title: 'Athena — Build Night: the Automated Quizball Turret',
        body:
          'Athena reports to the fabrication lab to machine the buzzer receivers. Bronze, bronze, bronze.',
        house: 'ATHENA',
        category: 'ANNOUNCEMENT',
        eventDate: isoDate(now + 3 * 86_400_000),
        pinned: false,
        createdAt: now - 1000 * 60 * 30,
        createdBy: 'Dr. M. Santos',
      },
      {
        id: 'seed-b5',
        title: 'Aphrodite — Titration & the Golden Ratio Tour',
        body:
          'The crimson house walks the Fibonacci galleries at 3pm. A working titration lab report earns ten points.',
        house: 'APHRODITE',
        category: 'EVENT',
        eventDate: isoDate(now + 4 * 86_400_000),
        pinned: false,
        createdAt: now - 1000 * 60 * 5,
        createdBy: 'Ms. L. Cervantes',
      },
    ],
  };
}

export function isoDate(ts: number): string {
  const d = new Date(ts);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/* ------------------------------------------------------------------ store */

type QuizListener = (snapshot: QuizSnapshot) => void;
type BulletinListener = (posts: BulletinPost[]) => void;
type ConnectionListener = (online: boolean) => void;

class LocalBackend {
  private state: LocalState = seedState();
  private hydrated = false;
  private quizListeners = new Set<QuizListener>();
  private bulletinListeners = new Set<BulletinListener>();
  private connectionListeners = new Set<ConnectionListener>();
  private online = true;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  /** Serialises writes so concurrent submissions stay deterministic. */
  private queue: Promise<unknown> = Promise.resolve();

  /* --------------------------------------------------------- persistence */

  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    this.hydrated = true;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LocalState;
        if (parsed?.session) {
          this.state = {
            session: { ...seedState().session, ...parsed.session },
            bulletin: Array.isArray(parsed.bulletin)
              ? parsed.bulletin
              : seedState().bulletin,
          };
        }
      }
    } catch {
      // A corrupt cache must never take the app down — fall back to the seed.
      this.state = seedState();
    }
    this.emitAll();
  }

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)).catch(
        () => undefined,
      );
    }, 200);
  }

  async resetToSeed(): Promise<void> {
    await this.enqueue(async () => {
      this.state = seedState();
      this.schedulePersist();
      this.emitAll();
    });
  }

  /* ---------------------------------------------------------- pub / sub */

  subscribeQuiz(listener: QuizListener): () => void {
    this.quizListeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.quizListeners.delete(listener);
    };
  }

  subscribeBulletin(listener: BulletinListener): () => void {
    this.bulletinListeners.add(listener);
    listener(this.state.bulletin);
    return () => {
      this.bulletinListeners.delete(listener);
    };
  }

  subscribeConnection(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.online);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  /** Test / demo hook: simulate a dropped link. */
  setOnline(online: boolean): void {
    if (this.online === online) return;
    this.online = online;
    this.connectionListeners.forEach((l) => l(online));
  }

  isOnline(): boolean {
    return this.online;
  }

  snapshot(): QuizSnapshot {
    const { session } = this.state;
    return {
      question: session.activeQuestion,
      points: session.housePoints,
      correctResponders: session.correctResponders,
      updatedAt: session.updatedAt,
    };
  }

  private emitAll(): void {
    const snap = this.snapshot();
    this.quizListeners.forEach((l) => l(snap));
    const posts = this.state.bulletin;
    this.bulletinListeners.forEach((l) => l(posts));
  }

  private enqueue<T>(task: () => Promise<T> | T): Promise<T> {
    const run = this.queue.then(task, task);
    // Keep the chain alive even if a task rejects.
    this.queue = run.catch(() => undefined);
    return run;
  }

  private touch(): void {
    this.state.session.updatedAt = Date.now();
    this.schedulePersist();
    this.emitAll();
  }

  /* ------------------------------------------------------ officer writes */

  setQuestion(question: ActiveQuestion, secure: SecureAnswer): void {
    this.state.session.activeQuestion = { ...question };
    this.state.session.secureAnswer = { ...secure };
    this.state.session.correctResponders = {};
    this.state.session.submissions = {};
    this.state.session.pausedRemainingMs = null;
    this.state.session.questionCounter = Math.max(
      this.state.session.questionCounter,
      question.index,
    );
    this.touch();
  }

  updateQuestion(patch: Partial<ActiveQuestion>): void {
    if (!this.state.session.activeQuestion) return;
    this.state.session.activeQuestion = {
      ...this.state.session.activeQuestion,
      ...patch,
    };
    this.touch();
  }

  startTimer(seconds?: number): void {
    const q = this.state.session.activeQuestion;
    if (!q) return;
    const duration = Math.max(1, Math.round(seconds ?? q.timerSeconds));
    this.state.session.activeQuestion = {
      ...q,
      timerSeconds: duration,
      startedAt: Date.now(),
      endsAt: Date.now() + duration * 1000,
      status: 'BUZZERS_OPEN',
    };
    this.state.session.pausedRemainingMs = null;
    this.touch();
  }

  pauseTimer(): void {
    const q = this.state.session.activeQuestion;
    if (!q || !q.endsAt) return;
    const remaining = Math.max(0, q.endsAt - Date.now());
    this.state.session.pausedRemainingMs = remaining;
    this.state.session.activeQuestion = {
      ...q,
      endsAt: null,
      status: 'PAUSED',
    };
    this.touch();
  }

  resetTimer(): void {
    const q = this.state.session.activeQuestion;
    if (!q) return;
    this.state.session.pausedRemainingMs = q.timerSeconds * 1000;
    this.state.session.activeQuestion = {
      ...q,
      endsAt: null,
      startedAt: null,
      status: 'IDLE',
    };
    this.touch();
  }

  clearQuestion(): void {
    this.state.session.activeQuestion = null;
    this.state.session.secureAnswer = null;
    this.state.session.correctResponders = {};
    this.state.session.submissions = {};
    this.state.session.pausedRemainingMs = null;
    this.touch();
  }

  adjustPoints(house: HouseId, delta: number): void {
    const current = this.state.session.housePoints[house] ?? 0;
    this.state.session.housePoints = {
      ...this.state.session.housePoints,
      [house]: Math.max(0, current + delta),
    };
    this.touch();
  }

  resetPoints(): void {
    this.state.session.housePoints = { ...EMPTY_POINTS };
    this.touch();
  }

  /* --------------------------------------------------- student submissions */

  /**
   * The reference implementation of the "first 10 correct answers" rule.
   * Mirrors the Firebase transaction in `services/quizSync.ts` step for step.
   */
  async submit(input: SubmitAnswerInput): Promise<SubmissionResult> {
    return this.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 180)); // simulate round-trip
      if (!this.online) {
        return {
          status: 'NETWORK_ERROR',
          message: 'The link to the hall failed. Please try once more.',
          pointsAwarded: 0,
        };
      }

      const session = this.state.session;
      const previous = session.submissions[input.studentId];
      const alreadyAnswered =
        !!previous && previous.questionId === session.activeQuestion?.id;

      const decision = decideSubmission(
        {
          question: session.activeQuestion,
          secure: session.secureAnswer,
          correctResponderCount: Object.keys(session.correctResponders).length,
          alreadyAnswered,
          candidate: input.answer,
          housePoints: session.housePoints,
          now: Date.now(),
        },
        input.house,
      );

      if (!decision.accept) return { ...decision };

      // Accepted — write the responder and the point total together.
      session.correctResponders[input.studentId] = {
        name: input.name,
        house: input.house,
        at: Date.now(),
      };
      session.submissions[input.studentId] = {
        questionId: session.activeQuestion?.id ?? '',
        correct: true,
        answer: normalizeAnswer(input.answer),
        at: Date.now(),
      };
      session.housePoints = {
        ...session.housePoints,
        [input.house]: decision.houseTotal,
      };
      if (session.activeQuestion) {
        session.activeQuestion = {
          ...session.activeQuestion,
          correctCount: Math.min(
            MAX_RESPONDERS,
            Object.keys(session.correctResponders).length,
          ),
          submissionCount: session.activeQuestion.submissionCount + 1,
        };
      }
      this.touch();

      return { ...decision };
    });
  }

  /** Staff-side reveal: writes the answer to the *display* state only. */
  reveal(): void {
    const q = this.state.session.activeQuestion;
    const secure = this.state.session.secureAnswer;
    if (!q || !secure) return;
    const answerText =
      q.type === 'MULTIPLE_CHOICE'
        ? (q.options.find((o) => o.id === secure.optionId)?.label ?? secure.answer)
        : secure.answer;
    this.state.session.activeQuestion = {
      ...q,
      status: 'ANSWER_REVEALED',
      endsAt: null,
      revealedOptionId: secure.optionId,
      revealedAnswer: answerText,
    };
    this.touch();
  }

  closeQuestion(): void {
    const q = this.state.session.activeQuestion;
    if (!q) return;
    this.state.session.activeQuestion = { ...q, status: 'CLOSED', endsAt: null };
    this.touch();
  }

  nextQuestionNumber(): number {
    return this.state.session.questionCounter + 1;
  }

  /* -------------------------------------------------------------- bulletin */

  async publishPost(
    post: Omit<BulletinPost, 'id' | 'createdAt'>,
  ): Promise<BulletinPost> {
    return this.enqueue(async () => {
      const created: BulletinPost = {
        ...post,
        id: `post-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 7)}`,
        createdAt: Date.now(),
      };
      this.state.bulletin = [created, ...this.state.bulletin];
      this.schedulePersist();
      this.bulletinListeners.forEach((l) => l(this.state.bulletin));
      return created;
    });
  }

  async deletePost(id: string): Promise<void> {
    return this.enqueue(async () => {
      this.state.bulletin = this.state.bulletin.filter((p) => p.id !== id);
      this.schedulePersist();
      this.bulletinListeners.forEach((l) => l(this.state.bulletin));
    });
  }

  async setPinned(id: string, pinned: boolean): Promise<void> {
    return this.enqueue(async () => {
      this.state.bulletin = this.state.bulletin.map((p) =>
        p.id === id ? { ...p, pinned } : p,
      );
      this.schedulePersist();
      this.bulletinListeners.forEach((l) => l(this.state.bulletin));
    });
  }

  /** Direct read used by the officer screen before the first snapshot lands. */
  getState(): LocalState {
    return this.state;
  }
}

export const localBackend = new LocalBackend();
