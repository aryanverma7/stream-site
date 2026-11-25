"use client";

import { useCallback, useEffect, useState } from "react";
import { editorApi } from "./editorApi";
import type { Edit } from "./useProject";

/** The checks Task 4 measures; any of them may be missing or malformed. */
export type CheckState = "pass" | "warn" | "fail" | "unknown";
export type Checks = Partial<Record<"resolution" | "fps" | "bitrate", { state?: CheckState; value?: unknown }>> & {
  duration_s?: unknown;
  codec?: unknown;
  playable?: unknown;
};

/** An iteration (a "version") as GET /edits/{id} lists it. */
export interface Iteration {
  id: number;
  edit_id: number;
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
 * One edit and its versions (oldest first, as sent). Reading it marks the
 * edit seen for this user - that is the backend's doing, and the reason
 * the projects list never reads edits.
 *
 * update() PATCHes and keeps the server's answer; it throws EditorApiError
 * so the caller can show the refusal.
 */
/** quota_exempt is the streamer's "doesn't count toward the quota" switch. */
export type TapePatch = Partial<Pick<Edit, "name" | "notes" | "status">> & { quota_exempt?: boolean };

export function useEdit(id: number): {
  edit: Edit | null;
  iterations: Iteration[];
  error: string | null;
  refresh: () => Promise<void>;
  update: (patch: TapePatch) => Promise<void>;
} {
  const [data, setData] = useState<{ edit: Edit | null; iterations: Iteration[] }>({ edit: null, iterations: [] });
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await editorApi<{ edit: Edit; iterations: Iteration[] }>(`/edits/${id}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  const update = useCallback(
    async (patch: TapePatch) => {
      const edit = await editorApi<Edit>(`/edits/${id}`, { method: "PATCH", body: patch });
      setData((d) => ({ ...d, edit }));
    },
    [id],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; state is set after the await
    refresh();
  }, [refresh]);

  return { ...data, error, refresh, update };
}
