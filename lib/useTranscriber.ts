"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { editorApi } from "./editorApi";

type Settings = { enabled: boolean; auto: boolean; last_seen: number | null; queued: number; running: number };

export const TRANSCRIBER_POLL_MS = 30_000;

/**
 * The gaming PC transcriber's two switches and queue, both roles. Polled
 * every 30 s while visible. A flip is shown at once and put back if the
 * PUT fails, with the server's error. Off (Paused) until the first answer.
 */
export function useTranscriber() {
  const [s, setS] = useState<Settings>({ enabled: false, auto: false, last_seen: null, queued: 0, running: 0 });
  const [error, setError] = useState<string | null>(null);
  // Bumped by every flip: a poll that started before a flip (or while one is saving) is stale and dropped.
  const gen = useRef(0);
  const saving = useRef(0);

  // A failed poll keeps the last answer.
  const refresh = useCallback(async () => {
    const started = gen.current;
    try {
      const next = await editorApi<Settings>("/transcriber");
      if (gen.current === started && saving.current === 0) setS(next);
    } catch {}
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; state is set after the await
    refresh();
    const visible = () => document.visibilityState === "visible";
    const timer = setInterval(() => visible() && refresh(), TRANSCRIBER_POLL_MS);
    const onVisibility = () => visible() && refresh();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const put = useCallback(async (change: { enabled?: boolean; auto?: boolean }) => {
    gen.current++;
    saving.current++;
    setS((cur) => ({ ...cur, ...change }));
    setError(null);
    try {
      setS(await editorApi<Settings>("/transcriber", { method: "PUT", body: change }));
    } catch (e) {
      // put back only what this flip changed
      const undo = Object.fromEntries(Object.entries(change).map(([k, v]) => [k, !v]));
      setS((cur) => ({ ...cur, ...undo }));
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      saving.current--;
    }
  }, []);

  return {
    enabled: s.enabled,
    auto: s.auto,
    lastSeen: s.last_seen,
    queued: s.queued,
    running: s.running,
    setEnabled: (b: boolean) => put({ enabled: b }),
    setAuto: (b: boolean) => put({ auto: b }),
    error,
  };
}
