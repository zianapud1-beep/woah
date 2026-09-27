import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useCountdown } from './useCountdown';
import { MAX_RESPONDERS } from '@/services/answerLogic';
import { EMPTY_POINTS, localBackend } from '@/services/localBackend';
import {
  getConnectionState,
  subscribeToConnection,
  subscribeToQuiz,
} from '@/services/quizSync';
import type {
  ActiveQuestion,
  ConnectionState,
  HouseId,
  HousePoints,
  QuizSnapshot,
  QuizStatus,
} from '@/services/types';

/**
 * Single live source of truth for the quiz. Every screen subscribes to the
 * same Realtime Database node, so the officer panel, the projector display
 * and all student phones converge within one push round-trip.
 */

export interface QuizViewModel {
  ready: boolean;
  question: ActiveQuestion | null;
  /** Status after applying the buzzer deadline. */
  status: QuizStatus;
  points: HousePoints;
  totalPoints: number;
  leader: HouseId | null;
  standings: Array<{ house: HouseId; points: number; rank: number }>;
  correctCount: number;
  maxResponders: number;
  countdown: ReturnType<typeof useCountdown>;
  connection: ConnectionState;
  resetDemo: () => void;
  setDemoOnline: (online: boolean) => void;
}

const RANKED = (points: HousePoints) => {
  const entries = (Object.keys(points) as HouseId[]).map((house) => ({
    house,
    points: points[house] ?? 0,
    rank: 0,
  }));
  entries.sort((a, b) => b.points - a.points);
  entries.forEach((entry, i) => {
    entry.rank = i + 1;
  });
  return entries;
};

export function useQuizSync(): QuizViewModel {
  const [snapshot, setSnapshot] = useState<QuizSnapshot | null>(null);
  const [online, setOnline] = useState(false);
  const question = snapshot?.question ?? null;

  useEffect(() => subscribeToQuiz(setSnapshot), []);
  useEffect(() => subscribeToConnection(setOnline), []);

  const running = question?.status === 'BUZZERS_OPEN';
  const countdown = useCountdown(
    question?.endsAt ?? null,
    question?.timerSeconds ?? 30,
    running,
  );

  const status: QuizStatus = useMemo(() => {
    if (!question) return 'IDLE';
    if (question.status === 'BUZZERS_OPEN' && countdown.expired) return 'TIME_UP';
    return question.status;
  }, [question, countdown.expired]);

  const points = snapshot?.points ?? EMPTY_POINTS;
  const standings = useMemo(() => RANKED(points), [points]);
  const totalPoints = useMemo(
    () => standings.reduce((sum, s) => sum + s.points, 0),
    [standings],
  );

  const connection = useMemo(
    () => getConnectionState(online),
    [online],
  );

  const resetDemo = useCallback(() => {
    void localBackend.resetToSeed();
  }, []);
  const setDemoOnline = useCallback((next: boolean) => {
    localBackend.setOnline(next);
  }, []);

  return {
    ready: snapshot !== null,
    question,
    status,
    points,
    totalPoints,
    leader: standings[0]?.house ?? null,
    standings,
    correctCount: Math.min(
      MAX_RESPONDERS,
      question?.correctCount ??
        Object.keys(snapshot?.correctResponders ?? {}).length,
    ),
    maxResponders: MAX_RESPONDERS,
    countdown,
    connection,
    resetDemo,
    setDemoOnline,
  };
}

/** Tracks the student's own submission for the currently displayed question. */
export function useSubmissionGuard(questionId: string | undefined) {
  const lastQuestion = useRef<string | undefined>(undefined);
  const [state, setState] = useState<
    | { phase: 'idle' }
    | { phase: 'sending' }
    | { phase: 'done'; status: string; message: string; points: number; answer: string }
  >({ phase: 'idle' });

  useEffect(() => {
    if (lastQuestion.current !== questionId) {
      lastQuestion.current = questionId;
      setState({ phase: 'idle' });
    }
  }, [questionId]);

  return {
    ...state,
    begin: () => setState({ phase: 'sending' }),
    settle: (result: {
      status: string;
      message: string;
      pointsAwarded: number;
    }, answer: string) =>
      setState({
        phase: 'done',
        status: result.status,
        message: result.message,
        points: result.pointsAwarded,
        answer,
      }),
    reset: () => setState({ phase: 'idle' }),
  };
}
