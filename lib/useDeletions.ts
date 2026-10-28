"use client";

import { useCallback, useEffect, useState } from "react";
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
  status: "pending" | "running";
}

export const DELETIONS_POLL_MS = 30_000;

/** Whole minutes left until the delete runs, never below zero. */
export function minutesLeft(deleteAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((deleteAt * 1000 - now) / 60_000));
}

/**
 * Deletes in their undo hour. Polled every 30 s while the page is visible,
 * so a delete the other person scheduled shows up without a reload.
 */
export function useDeletions(): {
  pending: DeleteRequest[];
  find: (kind: DeleteKind, targetId: number) => DeleteRequest | undefined;
  refresh: () => Promise<void>;
  undo: (requestId: number) => Promise<void>;
} {
  const [pending, setPending] = useState<DeleteRequest[]>([]);

  // A failed poll keeps the last answer: a backend restart is not "nothing pending".
  const refresh = useCallback(async () => {
    try {
      setPending((await editorApi<{ pending: DeleteRequest[] }>("/deletions")).pending);
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
