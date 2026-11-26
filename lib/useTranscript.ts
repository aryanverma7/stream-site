"use client";

import { useCallback, useEffect, useState } from "react";
import { editorApi } from "./editorApi";

export type Segment = { start: number; end: number; text: string; edited?: boolean };
export type TranscriptStatus = "none" | "queued" | "running" | "done" | "failed";
type Transcript = { status: TranscriptStatus; segments: Segment[] | null; error: string | null };

export const TRANSCRIPT_POLL_MS = 15_000;

/**
 * One version's transcript. Polled every 15 s while it is waiting for the
 * PC or being made; `request()` asks for one (or again, after a failure).
 * `status` is null until the first answer.
 */
export function useTranscript(iterationId: number) {
  const [t, setT] = useState<(Transcript & { id: number }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await editorApi<Transcript>(`/iterations/${iterationId}/transcript`);
      setT({ ...d, id: iterationId });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the transcript");
    }
  }, [iterationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; state is set after the await
    load();
  }, [load]);

  const cur = t?.id === iterationId ? t : null;
  const waiting = cur?.status === "queued" || cur?.status === "running";
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => document.visibilityState === "visible" && load(), TRANSCRIPT_POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, load]);

  const request = useCallback(async () => {
    setError(null);
    try {
      await editorApi(`/iterations/${iterationId}/transcript`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not ask for a transcript");
    }
  }, [iterationId, load]);

  /** Fix one line's text; resolves to an error message, or null once saved. */
  const saveLine = useCallback(
    async (index: number, text: string): Promise<string | null> => {
      try {
        const d = await editorApi<Transcript>(`/iterations/${iterationId}/transcript/lines/${index}`, { method: "PUT", body: { text } });
        setT({ ...d, id: iterationId });
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : "Could not save the line";
      }
    },
    [iterationId],
  );

  return { status: cur?.status ?? null, segments: cur?.segments ?? null, error: error ?? cur?.error ?? null, request, saveLine };
}
