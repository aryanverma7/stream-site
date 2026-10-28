"use client";

import { useEffect, useState } from "react";
import { editorApi } from "./editorApi";

/** An open comment, as editor_comments.comments_for_iteration returns it. */
export interface FixComment {
  id: number;
  kind: "fix" | "keep" | "question";
  body: string;
  start_s: number | null;
  /** True when it was made on an earlier version and carried onto this one. */
  carried: boolean;
  origin_version: number;
  created_at: number;
}

export interface FixItem {
  comment: FixComment;
  tape_id: number;
  tape_name: string;
  project_id: number;
  iteration_id: number;
  version: number;
}

/** Every open comment on every tape's latest version, grouped by tape in the server's (oldest first) order. */
export function useFixList(): { groups: FixItem[][]; error: string | null } {
  const [groups, setGroups] = useState<FixItem[][]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    editorApi<{ items: FixItem[] }>("/fix-list")
      .then(({ items }) => {
        const byTape = new Map<number, FixItem[]>();
        for (const i of items) byTape.set(i.tape_id, [...(byTape.get(i.tape_id) ?? []), i]);
        setGroups([...byTape.values()]);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  return { groups, error };
}
