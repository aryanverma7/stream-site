"use client";

import { useCallback, useEffect, useState } from "react";
import { editorApi } from "./editorApi";
import type { Project } from "./useProjects";
import type { Tape } from "./useProject";

/** GET /home: what is waiting on someone. Projects in delete limbo are in none of it. */
export interface HomeData {
  /** Ready VODs nobody has pressed Download on yet. */
  vods_ready: Omit<Project, "tape_count" | "has_new">[];
  /** Downloaded, still on Drive, no delete scheduled: the editor confirms he has the file. */
  deletes_to_confirm: Omit<Project, "tape_count" | "has_new">[];
  /** Tapes with unresolved comments on their latest version, most first. */
  open_tapes: { tape: Tape; project_name: string; latest_iteration_id: number; latest_version: number; open_comments: number }[];
}

export function useHome(): { home: HomeData | null; error: string | null; refresh: () => Promise<void> } {
  const [home, setHome] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setHome(await editorApi<HomeData>("/home"));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; state is set after the await
    refresh();
  }, [refresh]);

  return { home, error, refresh };
}
