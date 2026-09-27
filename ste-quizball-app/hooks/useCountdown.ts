import { useEffect, useRef, useState } from 'react';

/**
 * Ticking clock used by the countdown rings. This is a *local UI* timer —
 * all networking in this app is push based, nothing polls the server.
 */
export function useNow(intervalMs = 250, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef(now);

  useEffect(() => {
    if (!active) return;
    ref.current = Date.now();
    const id = setInterval(() => {
      const next = Date.now();
      if (next - ref.current >= intervalMs - 30) {
        ref.current = next;
        setNow(next);
      }
    }, Math.max(60, Math.floor(intervalMs / 2)));
    return () => clearInterval(id);
  }, [intervalMs, active]);

  return now;
}

export interface CountdownState {
  /** Milliseconds left on the buzzer (0 when idle/finished). */
  remainingMs: number;
  seconds: number;
  /** 0 → 1 progress across the whole round. */
  progress: number;
  expired: boolean;
  running: boolean;
}

/**
 * Derives a smooth countdown from the server-provided `endsAt` timestamp so
 * every device in the hall agrees, even if a phone joins mid-question.
 */
export function useCountdown(
  endsAt: number | null,
  durationSeconds: number,
  running: boolean,
): CountdownState {
  const now = useNow(200, running && endsAt != null);
  const durationMs = Math.max(1, durationSeconds) * 1000;

  if (endsAt == null) {
    return {
      remainingMs: 0,
      seconds: 0,
      progress: 0,
      expired: !running,
      running: false,
    };
  }

  const remainingMs = Math.max(0, endsAt - now);
  return {
    remainingMs,
    seconds: Math.ceil(remainingMs / 1000),
    progress: Math.min(1, Math.max(0, remainingMs / durationMs)),
    expired: remainingMs <= 0,
    running: running && remainingMs > 0,
  };
}
