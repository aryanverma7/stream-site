"use client";

import { useCallback, useEffect, useState } from "react";
import { editorApi } from "./editorApi";
import type { EditKind } from "./useProject";

export type QuotaCounts = { videos: number; reels: number };

export interface QuotaEdit {
  id: number;
  name: string;
  kind: EditKind;
  project_id: number;
  project_name: string;
  final_upload_at: number;
}

export interface QuotaWeek {
  /** The Monday, YYYY-MM-DD. */
  week: string;
  target: QuotaCounts;
  done: QuotaCounts;
  short: QuotaCounts;
  status: "met" | "missed" | "excused" | "in_progress";
  excused: boolean;
  note: string;
  edits: QuotaEdit[];
}

/** GET /quota, as editor_quota.summary returns it: weeks newest first, from the start week. */
export interface Quota {
  start_week: string;
  current_week: string;
  week_ends_at: number;
  targets: QuotaCounts;
  weeks: QuotaWeek[];
}

/** The weekly quota, and the streamer's three settings (each answers the fresh table or targets). */
export function useQuota() {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setQuota(await editorApi<Quota>("/quota"));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    editorApi<Quota>("/quota")
      .then(setQuota)
      .catch((e: Error) => setError(e.message));
  }, []);

  const setTargets = useCallback(
    async (t: QuotaCounts) => {
      await editorApi("/quota/targets", { method: "PUT", body: t });
      await refresh();
    },
    [refresh],
  );
  const setStart = useCallback(async (week: string) => setQuota(await editorApi<Quota>("/quota/start", { method: "PUT", body: { week } })), []);
  const setExcused = useCallback(
    async (week: string, excused: boolean, note = "") =>
      setQuota(await editorApi<Quota>("/quota/excused", { method: "PUT", body: { week, excused, note } })),
    [],
  );
  return { quota, error, refresh, setTargets, setStart, setExcused };
}

/** "16 Nov - 22 Nov" for the week starting that Monday. Dates are calendar dates, so read in UTC. */
export function weekLabel(week: string): string {
  const start = new Date(`${week}T00:00:00Z`);
  const end = new Date(start.getTime() + 6 * 86400000);
  const f = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${f(start)} - ${f(end)}`;
}

/** Whole days left in the week, at least 1 while it runs. */
export function daysLeft(weekEndsAt: number, nowMs = Date.now()): number {
  return Math.max(1, Math.ceil((weekEndsAt * 1000 - nowMs) / 86400000));
}
