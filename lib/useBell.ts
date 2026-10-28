"use client";

import { useCallback, useEffect, useState } from "react";
import { editorApi } from "./editorApi";

/** One bell row, as editor_bell.feed sends it: the other person's events, newest first. */
export interface BellItem {
  id: number;
  at: number;
  actor: string;
  kind: string;
  summary: string;
  project_id: number | null;
  tape_id: number | null;
  iteration_id: number | null;
}

export const BELL_POLL_MS = 60_000;

/**
 * The notification bell's feed. Always the newest page (no `after=`), so a
 * gap longer than one page never skips events; `unseen` counts against the
 * server's per-user marker, so the newest `unseen` items are the new ones.
 * Polled every 60 s while visible, and at once when the tab comes back.
 */
export function useBell(): {
  items: BellItem[];
  unseen: number;
  loaded: boolean;
  markSeen: (upToId: number) => Promise<void>;
} {
  const [feed, setFeed] = useState<{ items: BellItem[]; unseen: number; loaded: boolean }>({ items: [], unseen: 0, loaded: false });

  // A failed poll keeps the last answer: a backend restart is not "nothing new".
  const refresh = useCallback(async () => {
    try {
      const { items, unseen } = await editorApi<{ items: BellItem[]; unseen: number }>("/notifications");
      setFeed({ items, unseen, loaded: true });
    } catch {}
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; state is set after the await
    refresh();
    const visible = () => document.visibilityState === "visible";
    const timer = setInterval(() => visible() && refresh(), BELL_POLL_MS);
    const onVisibility = () => visible() && refresh();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const markSeen = useCallback(
    async (upToId: number) => {
      await editorApi("/notifications/seen", { method: "POST", body: { up_to_id: upToId } });
      await refresh();
    },
    [refresh],
  );

  return { ...feed, markSeen };
}
