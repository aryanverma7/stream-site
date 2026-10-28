"use client";

import { useSyncExternalStore } from "react";
import { editorApi, EditorApiError } from "./editorApi";
import { resumableUpload, SessionExpired, sleep } from "./resumableUpload";
import { grade, measureMedia, thumbnail } from "./mediaChecks";

/**
 * Every version upload this tab knows about. Uploads live here, not in the
 * tape view, so leaving the tape does not stop one; and each unfinished
 * one is remembered in localStorage, so a closed browser can pick it up
 * again from Google's offset when the same file is dropped on that tape.
 *
 * The stored session URL can only put bytes into that one Drive file; it
 * is kept for exactly that and deleted on completion or cancel, never shown
 * or logged.
 */
const KEY = "editor.uploads";

interface Stored {
  tapeId: number;
  projectId: number;
  name: string;
  size: number;
  lastModified: number;
  iterationId: number;
  version: number;
  uploadUrl: string;
  sent: number;
}

export type TransferState = "uploading" | "offline" | "retrying" | "waiting" | "checking" | "paused" | "done" | "failed";
export interface Transfer {
  key: string;
  tapeId: number;
  projectId: number;
  name: string;
  size: number;
  version: number | null;
  sent: number;
  /** Bytes per second over the last chunk; null until two chunks have gone. */
  speed: number | null;
  state: TransferState;
  message: string | null;
}

const keyOf = (tapeId: number, f: { name: string; size: number; lastModified: number }) => `${tapeId}:${f.name}:${f.size}:${f.lastModified}`;

function load(): Stored[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function save(list: Stored[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the upload still runs, it just cannot be resumed after a close.
  }
}

/** Changes (or with null, forgets) the stored entry for `key`. */
function patchStored(key: string, patch: Partial<Stored> | null) {
  save(load().flatMap((s) => (keyOf(s.tapeId, s) !== key ? [s] : patch ? [{ ...s, ...patch }] : [])));
}

const live = new Map<string, Transfer>();
const controllers = new Map<string, AbortController>();
const listeners = new Set<() => void>();
let snapshot: Transfer[] | null = null;
const EMPTY: Transfer[] = [];

function emit() {
  snapshot = null;
  listeners.forEach((l) => l());
}

function update(key: string, patch: Partial<Transfer>) {
  const t = live.get(key);
  if (t) live.set(key, { ...t, ...patch });
  emit();
}

function getSnapshot(): Transfer[] {
  snapshot ??= [
    ...live.values(),
    ...load()
      .filter((s) => !live.has(keyOf(s.tapeId, s)))
      .map((s): Transfer => ({
        key: keyOf(s.tapeId, s),
        tapeId: s.tapeId,
        projectId: s.projectId,
        name: s.name,
        size: s.size,
        version: s.version,
        sent: s.sent,
        speed: null,
        state: "paused",
        message: null,
      })),
  ];
  return snapshot;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useTransfers(): Transfer[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

const gb = (bytes: number) => `${(bytes / 1e9).toFixed(1)} GB`;

function describe(e: unknown): string {
  if (e instanceof EditorApiError && e.status === 507 && "needed" in e.data && "free" in e.data) {
    return `Drive is too full: needs ${gb(Number(e.data.needed))}, ${gb(Number(e.data.free))} free`;
  }
  if (e instanceof TypeError) return "Couldn't reach the Mac Mini - try again";
  return e instanceof Error ? e.message : "Upload failed";
}

/** Mac Mini down or Drive hiccuping: keep asking, since the bytes are already safe on Google. */
async function completeWhenReachable(key: string, iterationId: number, fileId: string, signal: AbortSignal) {
  for (let n = 0; ; n++) {
    try {
      return await editorApi(`/iterations/${iterationId}/complete`, { method: "POST", body: { file_id: fileId } });
    } catch (e) {
      if (e instanceof EditorApiError && e.status < 500) throw e;
      update(key, { state: "waiting" });
      await sleep(Math.min(5 * 2 ** n, 300) * 1000, signal);
    }
  }
}

/**
 * Uploads `file` as a new version of the tape - or, when this exact file
 * (name, size, last modified) is already stored as unfinished there,
 * continues that version instead of creating another. Never throws: every
 * failure becomes the transfer's state and message.
 */
export async function startUpload(
  target: { tapeId: number; projectId: number; kind: "tape" | "reel" },
  file: File,
  onDone?: () => void,
): Promise<void> {
  const { tapeId, projectId } = target;
  const key = keyOf(tapeId, file);
  if (controllers.has(key)) return;
  const ctl = new AbortController();
  controllers.set(key, ctl);
  const signal = ctl.signal;
  const mime = file.type || "application/octet-stream";
  let entry = load().find((s) => keyOf(s.tapeId, s) === key);
  live.set(key, {
    key, tapeId, projectId, name: file.name, size: file.size,
    version: entry?.version ?? null, sent: entry?.sent ?? 0, speed: null, state: "uploading", message: null,
  });
  emit();

  let last: { t: number; sent: number } | null = null;
  const send = (url: string) =>
    resumableUpload(file, url, {
      signal,
      onProgress: (sent) => {
        const now = Date.now();
        const speed = last && now > last.t && sent > last.sent ? ((sent - last.sent) * 1000) / (now - last.t) : (live.get(key)?.speed ?? null);
        last = { t: now, sent };
        patchStored(key, { sent });
        update(key, { sent, speed, state: "uploading" });
      },
      onPause: (reason) => update(key, { state: reason ?? "uploading", speed: null }),
    });

  try {
    if (!entry) {
      const r = await editorApi<{ iteration_id: number; version: number; upload_url: string }>(`/tapes/${tapeId}/iterations`, {
        method: "POST",
        body: { filename: file.name, size: file.size, mime },
      });
      entry = {
        tapeId, projectId, name: file.name, size: file.size, lastModified: file.lastModified,
        iterationId: r.iteration_id, version: r.version, uploadUrl: r.upload_url, sent: 0,
      };
      save([...load(), entry]);
      update(key, { version: r.version });
    }
    const id = entry.iterationId;
    let uploaded: { id: string };
    try {
      uploaded = await send(entry.uploadUrl);
    } catch (e) {
      if (!(e instanceof SessionExpired)) throw e;
      update(key, { sent: 0, message: "Google's upload session had expired, so this version is being sent again from the start" });
      const { upload_url } = await editorApi<{ upload_url: string }>(`/iterations/${id}/session`, { method: "POST", body: { mime } });
      patchStored(key, { uploadUrl: upload_url, sent: 0 });
      last = null;
      uploaded = await send(upload_url);
    }
    await completeWhenReachable(key, id, uploaded.id, signal);
    patchStored(key, null);
    update(key, { state: "checking", speed: null, message: null });

    // Best effort: an unreadable file still gets its version, with "unknown" checks and no thumbnail.
    const measured = await measureMedia(file).catch(() => null);
    const thumb = await thumbnail(file).catch(() => null);
    const checks = grade(measured ?? { width: null, height: null, duration_s: null, fps: null, bitrate_mbps: null }, target.kind);
    await editorApi(`/iterations/${id}/media`, { method: "PUT", body: { checks, thumbnail_b64: thumb } }).catch(() => {});
    update(key, { state: "done" });
    onDone?.();
  } catch (e) {
    if (!signal.aborted) update(key, { state: "failed", speed: null, message: describe(e) });
  } finally {
    controllers.delete(key);
  }
}

/** Stops sending and forgets the upload. The version stays `uploading`; the server abandons it after 8 days. */
export function cancelTransfer(key: string) {
  controllers.get(key)?.abort();
  controllers.delete(key);
  live.delete(key);
  patchStored(key, null);
  emit();
}

/** Clears a finished or failed row; an unfinished stored upload behind it shows again as paused. */
export function dismissTransfer(key: string) {
  live.delete(key);
  emit();
}

/**
 * Drops stored entries whose version is no longer waiting for bytes - the
 * server's reconcile job finished it, or it was deleted - so the panel
 * stops asking for a file nobody needs to send.
 */
export async function refreshStored() {
  for (const s of load()) {
    const key = keyOf(s.tapeId, s);
    if (live.has(key)) continue;
    try {
      const { iteration } = await editorApi<{ iteration: { status: string } }>(`/iterations/${s.iterationId}`);
      if (iteration.status !== "uploading" && iteration.status !== "abandoned") patchStored(key, null);
    } catch (e) {
      if (e instanceof EditorApiError && e.status === 404) patchStored(key, null);
    }
  }
  emit();
}
