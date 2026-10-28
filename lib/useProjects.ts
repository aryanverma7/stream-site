"use client";

import { useCallback, useEffect, useState } from "react";
import { editorApi } from "./editorApi";
import type { Tape } from "./useProject";

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
  kind: "vod" | "clip";
  duration_s: number | null;
  reel_tape_id: number | null;
  tape_count: number;
  has_new: boolean;
  created_at: number;
}

export interface ProjectsData {
  /** Newest first, as the backend sends them. */
  vods: Project[];
  /** Oldest first (spec): clips are cut in the order they happened. */
  clips: Project[];
  /** Every clip's reel by tape id, so a clip card can show its status and where it went. */
  reels: Record<number, Tape>;
}

const EMPTY: ProjectsData = { vods: [], clips: [], reels: {} };

/**
 * The projects list. A clip's reel can live in another clip's project
 * (combined reels stay with the first clip), so the reels come from each
 * clip's own project read - the host's read carries the reel.
 *
 * ponytail: one GET per clip; a `reel` field on GET /projects if the list ever gets long.
 */
export function useProjects(): ProjectsData & { error: string | null; refresh: () => Promise<void> } {
  const [data, setData] = useState<ProjectsData>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { projects } = await editorApi<{ projects: Project[] }>("/projects");
      const clips = projects
        .filter((p) => p.kind === "clip")
        .sort((a, b) => a.created_at - b.created_at || a.id - b.id);
      const reads = await Promise.all(clips.map((c) => editorApi<{ tapes: Tape[] }>(`/projects/${c.id}`)));
      const reels: Record<number, Tape> = {};
      for (const t of reads.flatMap((r) => r.tapes)) reels[t.id] = t;
      setData({ vods: projects.filter((p) => p.kind !== "clip"), clips, reels });
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
