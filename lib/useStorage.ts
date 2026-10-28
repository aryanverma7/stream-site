"use client";

import { useCallback, useEffect, useState } from "react";
import { editorApi } from "./editorApi";

export interface StorageFile {
  kind: "vod" | "iteration";
  label: string;
  size: number | null;
  project_id: number;
  tape_id: number | null;
  status: "ready" | "deleting";
  /** The names a delete is confirmed against. */
  project_name: string;
  tape_name: string | null;
  vod_filename: string | null;
}

/**
 * GET /storage (admin): Drive quota, every app file, the scheduler and the
 * Discord outbox. While Drive is down quota and files are null and
 * drive_error says why; the scheduler and Discord blocks are still there.
 */
export interface StorageData {
  quota: { limit: number | null; usage: number; free: number | null } | null;
  files: StorageFile[] | null;
  drive_error?: string;
  scheduler: { sane: boolean; last_seen: number | null; paused_since: number | null };
  discord: { enabled: boolean; pending: number; sending: number; dropped: number; last_error: string | null; last_sent_at: number | null };
}

/** GET /drive/status: answers even when Drive is not connected, which /storage cannot. */
export interface DriveStatus {
  connected: boolean;
  layout: boolean;
  error?: string;
}

/** The Storage page's two reads; either failing leaves the other on screen. */
export function useStorage(): {
  storage: StorageData | null;
  drive: DriveStatus | null;
  error: string | null;
  refresh: () => Promise<void>;
  resetClock: () => Promise<void>;
} {
  const [state, setState] = useState<{ storage: StorageData | null; drive: DriveStatus | null; error: string | null }>({
    storage: null,
    drive: null,
    error: null,
  });

  const refresh = useCallback(async () => {
    const [storage, drive] = await Promise.allSettled([editorApi<StorageData>("/storage"), editorApi<DriveStatus>("/drive/status")]);
    setState((s) => ({
      storage: storage.status === "fulfilled" ? storage.value : s.storage,
      drive: drive.status === "fulfilled" ? drive.value : s.drive,
      error: storage.status === "rejected" ? (storage.reason as Error).message : null,
    }));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const resetClock = useCallback(async () => {
    try {
      await editorApi("/scheduler/reset-clock", { method: "POST" });
    } catch (e) {
      setState((s) => ({ ...s, error: (e as Error).message }));
      return;
    }
    await refresh();
  }, [refresh]);

  return { ...state, refresh, resetClock };
}
