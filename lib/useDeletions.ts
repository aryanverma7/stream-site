"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { editorApi } from "./editorApi";

export type DeleteKind = "vod" | "tape_files" | "project";

/** A live delete request, as GET /deletions lists them (deletions.pending). */
export interface DeleteRequest {
  id: number;
  kind: DeleteKind;
  target_id: number;
  label: string;
  requested_by: string;
  delete_at: number;
  remaining_seconds: number;
  status: "pending" | "running";
  /**
   * Browser-clock time (ms) the delete runs, from the server's
   * remaining_seconds when the poll landed. delete_at is the Mac Mini's
   * clock, which can be off; a duration is not.
   */
  ends_at_ms: number;
}

export const DELETIONS_POLL_MS = 30_000;

/** Whole minutes left until the delete runs, never below zero. */
export function minutesLeft(endsAtMs: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((endsAtMs - now) / 60_000));
}

/**
 * Deletes in their undo hour. Polled every 30 s while the page is visible,
 * so a delete the other person scheduled shows up without a reload.
 *
 * `onChange` runs when a request appears or disappears after the first
 * load (an Undo, a delete scheduled elsewhere, one that finished): the
 * target's own state changed with it, so the view refetches.
 */
export function useDeletions(onChange?: () => void): {
  pending: DeleteRequest[];
  find: (kind: DeleteKind, targetId: number) => DeleteRequest | undefined;
  refresh: () => Promise<void>;
  undo: (requestId: number) => Promise<void>;
} {
  const [pending, setPending] = useState<DeleteRequest[]>([]);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const lastKey = useRef<string | null>(null);

  // A failed poll keeps the last answer: a backend restart is not "nothing pending".
  const refresh = useCallback(async () => {
    try {
      const rows = (await editorApi<{ pending: Omit<DeleteRequest, "ends_at_ms">[] }>("/deletions")).pending;
      const now = Date.now();
      setPending(rows.map((r) => ({ ...r, ends_at_ms: now + r.remaining_seconds * 1000 })));
      const key = rows.map((r) => r.id).join(",");
      if (lastKey.current !== null && lastKey.current !== key) onChangeRef.current?.();
      lastKey.current = key;
    } catch {}
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; state is set after the await
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, DELETIONS_POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const find = useCallback(
    (kind: DeleteKind, targetId: number) => pending.find((r) => r.kind === kind && r.target_id === targetId),
    [pending],
  );

  const undo = useCallback(
    async (requestId: number) => {
      await editorApi(`/deletions/${requestId}/undo`, { method: "POST" });
      await refresh();
    },
    [refresh],
  );

  return { pending, find, refresh, undo };
}
