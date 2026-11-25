"use client";

import { useCallback, useEffect, useState } from "react";
import { editorApi } from "./editorApi";
import type { Project } from "./useProjects";

/** null until the first version is uploaded: its shape decides video or clip (a tape's reel is always a reel). */
export type EditKind = "video" | "clip" | "reel";
export const KIND_LABEL: Record<EditKind, string> = { video: "Video", clip: "Clip", reel: "Reel" };

export type EditStatus = "cutting" | "in_review" | "changes_asked" | "final";

/** An edit as GET /projects/{id} lists it (GET /edits/{id} lacks the last four). */
export interface Edit {
  id: number;
  project_id: number;
  name: string;
  kind: EditKind | null;
  status: EditStatus;
  notes: string;
  files_deleted_at: number | null;
  /** 1 when the streamer switched it out of the weekly quota (older backends leave it out). */
  quota_exempt?: number;
  /** The clips a reel is made of, oldest first; two or more is a combined reel. */
  source_project_ids: number[];
  created_at: number;
  has_new?: boolean;
  latest_version?: number | null;
  latest_iteration_id?: number | null;
  open_comments?: number;
}

/** One project and its edits. `project` stays null until loaded or on failure. */
export function useProject(id: number): {
  project: Omit<Project, "edit_count" | "has_new"> | null;
  edits: Edit[];
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [data, setData] = useState<{ project: Project | null; edits: Edit[] }>({ project: null, edits: [] });
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await editorApi<{ project: Project; edits?: Edit[] }>(`/projects/${id}`);
      setData({ project: d.project, edits: d.edits ?? [] }); // an older backend sends "tapes"
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; state is set after the await
    refresh();
  }, [refresh]);

  return { ...data, error, refresh };
}
