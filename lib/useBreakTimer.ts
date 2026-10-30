"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
 *
 * The poll is skipped while the tab is hidden, and a poll answer that
 * overlaps a start/stop is dropped: it may predate the change and would
 * flash the old state back.
 */
type Schedule = (fn: () => void, ms: number) => () => void;
const every: Schedule = (fn, ms) => {
  const id = setInterval(fn, ms);
  return () => clearInterval(id);
};

export function useBreakTimer({ schedule = every }: { schedule?: Schedule } = {}) {
  const [state, setState] = useState<BreakState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(0); // sends in flight
  const sends = useRef(0); // sends started, to spot one that overlapped a poll

  const refresh = useCallback(async () => {
    const at = sends.current;
    try {
      const res = await fetch("/api/break", { credentials: "same-origin" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const next = await res.json();
      if (sending.current || sends.current !== at) return;
      setState(next);
      setError(null);
    } catch {
      if (sending.current || sends.current !== at) return;
      // Deliberately does not blank `state`: a dropped poll mid-break
      // must not erase the number the streamer is reading.
      setError("Couldn't read the break state");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-existing mount-time load/sync; restructuring would change behavior
    refresh();
    return schedule(() => {
      if (document.visibilityState !== "hidden" && !sending.current) void refresh();
    }, 1000);
  }, [refresh, schedule]);

  const send = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      sending.current++;
      sends.current++;
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
        sending.current--;
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
