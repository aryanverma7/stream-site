"use client";

import { useCallback, useEffect, useState } from "react";
import { editorApi } from "./editorApi";
import type { Project } from "./useProjects";
import type { Edit } from "./useProject";

/** A notice from the streamer to the editor; seen_at is the editor's Got it. Times in seconds. */
export interface Notice {
  id: number;
  text: string;
  created_by: string;
  created_at: number;
  updated_at: number;
  seen_at: number | null;
}

/** GET /home: what is waiting on someone. Projects in delete limbo are in none of it. */
export interface HomeData {
  /** Newest first. Optional: an older backend sends none. */
  notices?: Notice[];
  /** Ready VODs nobody has pressed Download on yet. */
  vods_ready: Omit<Project, "edit_count" | "has_new">[];
  /** Downloaded, still on Drive, no delete scheduled: the editor confirms he has the file. */
  deletes_to_confirm: Omit<Project, "edit_count" | "has_new">[];
  /** Edits with unresolved comments on their latest version, most first. */
  open_edits: { edit: Edit; project_name: string; latest_iteration_id: number; latest_version: number; open_comments: number }[];
}

export function useHome(): { home: HomeData | null; error: string | null; refresh: () => Promise<void> } {
  const [home, setHome] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const h = await editorApi<HomeData>("/home");
      setHome({ ...h, open_edits: h.open_edits ?? [] }); // an older backend sends "open_tapes"
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
