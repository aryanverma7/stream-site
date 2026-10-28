"use client";

import { useCallback, useEffect, useState } from "react";
import { editorApi } from "./editorApi";
import type { Tape } from "./useProject";

/** The checks Task 4 measures; any of them may be missing or malformed. */
export type CheckState = "pass" | "warn" | "fail" | "unknown";
export type Checks = Partial<Record<"resolution" | "fps" | "bitrate", { state?: CheckState; value?: unknown }>>;

/** An iteration (a "version") as GET /tapes/{id} lists it. */
export interface Iteration {
  id: number;
  tape_id: number;
  version: number;
  filename: string;
  size: number;
  status: "uploading" | "ready" | "deleting" | "deleted" | "abandoned";
  drive_file_id: string | null;
  uploaded_at: number | null;
  created_at: number;
  checks: Checks | null;
  has_thumbnail: boolean;
}

/**
 * One tape and its versions (oldest first, as sent). Reading it marks the
 * tape seen for this user - that is the backend's doing, and the reason
 * the projects list never reads tapes.
 *
 * update() PATCHes and keeps the server's answer; it throws EditorApiError
 * so the caller can show the refusal.
 */
export function useTape(id: number): {
  tape: Tape | null;
  iterations: Iteration[];
  error: string | null;
  refresh: () => Promise<void>;
  update: (patch: Partial<Pick<Tape, "name" | "notes" | "status">>) => Promise<void>;
} {
  const [data, setData] = useState<{ tape: Tape | null; iterations: Iteration[] }>({ tape: null, iterations: [] });
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await editorApi<{ tape: Tape; iterations: Iteration[] }>(`/tapes/${id}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  const update = useCallback(
    async (patch: Partial<Pick<Tape, "name" | "notes" | "status">>) => {
      const tape = await editorApi<Tape>(`/tapes/${id}`, { method: "PATCH", body: patch });
      setData((d) => ({ ...d, tape }));
    },
    [id],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; state is set after the await
    refresh();
  }, [refresh]);

  return { ...data, error, refresh, update };
}
