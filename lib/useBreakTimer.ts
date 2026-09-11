"use client";

import { useCallback, useEffect, useState } from "react";

export interface BreakState {
  active: boolean;
  duration_seconds: number;
  remaining_seconds: number;
  overdue: boolean;
  message: string;
  default_minutes: number;
}

/**
 * Reads and controls the break screen's countdown.
 *
 * Polls, because the remaining time is derived from the clock on the
 * backend and a panel that only refreshed on a button press would show a
 * frozen number for the whole break - which is exactly when somebody is
 * looking at it to decide whether to add five minutes.
 *
 * `start` is deliberately a verb rather than a state write: starting
 * again means restart the clock from now, and a PUT carrying the same
 * duration twice cannot express that.
 */
export function useBreakTimer() {
  const [state, setState] = useState<BreakState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/break", { credentials: "same-origin" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setState(await res.json());
      setError(null);
    } catch {
      // Deliberately does not blank `state`: a dropped poll mid-break
      // must not erase the number the streamer is reading.
      setError("Couldn't read the break state");
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, [refresh]);

  const send = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/break", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? `request failed: ${res.status}`);
        setState(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Break request failed");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const start = useCallback(
    (minutes: number, message: string) => send({ action: "start", minutes, message }),
    [send],
  );
  const stop = useCallback(() => send({ action: "stop" }), [send]);

  return { state, error, busy, start, stop, refresh };
}
