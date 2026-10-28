"use client";

import { useCallback, useEffect, useState } from "react";
import { editorApi } from "./editorApi";
import type { Project } from "./useProjects";

export type TapeStatus = "cutting" | "in_review" | "changes_asked" | "final";

/** A tape as GET /projects/{id} lists it (GET /tapes/{id} lacks the last four). */
export interface Tape {
  id: number;
  project_id: number;
  name: string;
  kind: "tape" | "reel";
  status: TapeStatus;
  notes: string;
  files_deleted_at: number | null;
  /** The clips a reel is made of, oldest first; two or more is a combined reel. */
  source_project_ids: number[];
  created_at: number;
  has_new?: boolean;
  latest_version?: number | null;
  latest_iteration_id?: number | null;
  open_comments?: number;
}

/** One project and its tapes. `project` stays null until loaded or on failure. */
export function useProject(id: number): {
  project: Omit<Project, "tape_count" | "has_new"> | null;
  tapes: Tape[];
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [data, setData] = useState<{ project: Project | null; tapes: Tape[] }>({ project: null, tapes: [] });
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await editorApi<{ project: Project; tapes: Tape[] }>(`/projects/${id}`));
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
