"use client";

import { useCallback, useEffect, useState } from "react";
import { editorApi } from "./editorApi";
import type { Edit } from "./useProject";

/** A row of GET /projects (editor_store.list_projects, minus the upload URL). */
export interface Project {
  id: number;
  name: string;
  stream_date: string;
  stream_title: string;
  vod_filename: string;
  vod_size: number | null;
  vod_file_id: string | null;
  vod_status: "uploading" | "ready" | "deleting" | "deleted";
  download_clicked_at: number | null;
  kind: "vod" | "tape";
  duration_s: number | null;
  reel_edit_id: number | null;
  edit_count: number;
  has_new: boolean;
  created_at: number;
}

export interface ProjectsData {
  /** Newest first, as the backend sends them. */
  vods: Project[];
  /** Oldest first (spec): tapes are cut in the order they happened. */
  tapes: Project[];
  /** Every tape's reel by edit id, so a tape card can show its status and where it went. */
  reels: Record<number, Edit>;
}

const EMPTY: ProjectsData = { vods: [], tapes: [], reels: {} };

/**
 * The projects list. A tape's reel can live in another tape's project
 * (combined reels stay with the first tape), so the reels come from each
 * tape's own project read - the host's read carries the reel.
 *
 * ponytail: one GET per tape; a `reel` field on GET /projects if the list ever gets long.
 */
export function useProjects(): ProjectsData & { error: string | null; refresh: () => Promise<void> } {
  const [data, setData] = useState<ProjectsData>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { projects } = await editorApi<{ projects: Project[] }>("/projects");
      const tapes = projects
        .filter((p) => p.kind === "tape")
        .sort((a, b) => a.created_at - b.created_at || a.id - b.id);
      // A tape deleted between the two reads just has no reel shown; it must not empty the list.
      const reads = await Promise.allSettled(tapes.map((c) => editorApi<{ edits: Edit[] }>(`/projects/${c.id}`)));
      const reels: Record<number, Edit> = {};
      for (const r of reads) if (r.status === "fulfilled") for (const t of r.value.edits) reels[t.id] = t;
      setData({ vods: projects.filter((p) => p.kind !== "tape"), tapes, reels });
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; state is set after the await
    refresh();
  }, [refresh]);

  return { ...data, error, refresh };
}
