/**
 * Versions are cached in the browser's origin-private file system, one
 * directory per version holding fixed-size chunk files. A chunk counts as
 * present only when its size is exactly the expected one (a write commits on
 * close(), so a cut-off write never leaves a half chunk). The access token
 * only ever travels in an Authorization header.
 *
 * CHUNK_BYTES / chunkCount / chunkName / dirName are repeated in the service
 * worker (plain JS); a test pins that they agree.
 */
import { EditorApiError } from "./editorApi";

export const CHUNK_BYTES = 32 * 1024 * 1024;
export const chunkCount = (size: number) => Math.ceil(size / CHUNK_BYTES);
export const chunkName = (i: number) => "c" + String(i).padStart(5, "0");
export const dirName = (projectId: number, iterationId: number, fileId: string) => `it-${projectId}-${iterationId}-${fileId}`;

/** Bytes chunk `i` holds: CHUNK_BYTES, except the last. */
export const chunkLength = (size: number, i: number) => Math.min(size, (i + 1) * CHUNK_BYTES) - i * CHUNK_BYTES;

/** An error retrying cannot fix. */
export class FatalMediaError extends Error {}

export class MediaGone extends FatalMediaError {
  constructor(message = "This file is no longer on Drive") {
    super(message);
    this.name = "MediaGone";
  }
}

const gb = (n: number) => (n / 1024 ** 3).toFixed(1);
export class NotEnoughStorage extends FatalMediaError {
  constructor(public needBytes: number, public freeBytes: number) {
    super(`Not enough browser storage: needs ${gb(needBytes)} GB, ${gb(freeBytes)} GB free`);
    this.name = "NotEnoughStorage";
  }
}

/** `expires_at` (ms epoch) is stamped by useMediaFile when the link is fetched; expires_in is its lifetime then. */
export type MediaLink = { url: string; access_token: string; expires_in: number; expires_at?: number };

/** When each version directory was last opened (ms), written by useMediaFile. */
export const opened = new Map<string, number>();

const getRoot = (root?: FileSystemDirectoryHandle) => root ?? navigator.storage.getDirectory();

/** The names of the directory's subdirectories that start with `it-`. */
export async function versionDirs(root: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = [];
  const entries = (root as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries();
  for await (const [name, handle] of entries) if (handle.kind === "directory" && name.startsWith("it-")) names.push(name);
  return names;
}

export async function presentChunks(dir: FileSystemDirectoryHandle, size: number): Promise<boolean[]> {
  return Promise.all(
    Array.from({ length: chunkCount(size) }, async (_, i) => {
      try {
        const file = await (await dir.getFileHandle(chunkName(i))).getFile();
        return file.size === chunkLength(size, i);
      } catch {
        return false;
      }
    }),
  );
}

/*
 * OPFS is shared by every tab of the site, so a tab playing or downloading a
 * version holds shared Web Locks on its project and its version directory for
 * as long as it is open; deletion skips anything another tab holds. Without
 * navigator.locks nothing is skipped (one tab's view of the world).
 */
type LockManager = {
  request(name: string, o: { mode: "shared" }, cb: () => Promise<void>): Promise<void>;
  query(): Promise<{ held?: { name?: string }[] }>;
};
const lockManager = () => (typeof navigator === "undefined" ? undefined : (navigator as unknown as { locks?: LockManager }).locks);
export const projectLock = (projectId: number) => `opfs-project-${projectId}`;
export const versionLock = (dir: string) => `opfs-version-${dir}`;
/** Locks this page holds (granted and not yet released): they do not protect from this page's own deletions. */
const mine = new Map<string, number>();
const bump = (name: string, d: number) => mine.set(name, (mine.get(name) ?? 0) + d);

/** Holds shared locks on `names` until the returned function is called. */
export function holdLocks(names: string[]): () => void {
  const locks = lockManager();
  if (!locks) return () => {};
  let release = () => {};
  const gone = new Promise<void>((r) => (release = r));
  for (const name of names) {
    let granted = false;
    locks
      .request(name, { mode: "shared" }, async () => {
        granted = true;
        bump(name, 1);
        await gone;
      })
      .catch(() => {})
      .finally(() => granted && bump(name, -1));
  }
  return release;
}

/** Lock names some other tab holds; empty without the Locks API or when the query fails. */
async function heldElsewhere(): Promise<Set<string>> {
  const locks = lockManager();
  const out = new Set<string>();
  if (!locks) return out;
  try {
    const count = new Map<string, number>();
    for (const l of (await locks.query()).held ?? []) if (l.name) count.set(l.name, (count.get(l.name) ?? 0) + 1);
    for (const [name, n] of count) if (n > (mine.get(name) ?? 0)) out.add(name);
  } catch {
    /* treat as nothing held */
  }
  return out;
}

const projectOf = (dir: string) => Number(dir.split("-")[1]);

let queue: Promise<unknown> = Promise.resolve();

/** Deletes every version directory outside `projectId` (all when null), except another tab's. Calls run one after another. */
export function keepOnlyProject(projectId: number | null, root?: FileSystemDirectoryHandle): Promise<void> {
  const run = async () => {
    const r = await getRoot(root);
    const held = await heldElsewhere();
    for (const name of await versionDirs(r)) {
      if (held.has(projectLock(projectOf(name)))) continue;
      if (projectId === null || !name.startsWith(`it-${projectId}-`)) await r.removeEntry(name, { recursive: true }).catch(() => {});
    }
  };
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}

async function freeBytes(): Promise<number> {
  const { quota = 0, usage = 0 } = await navigator.storage.estimate();
  return quota - usage;
}

/** Deletes `projectId`'s version directories, least recently opened first, until `needBytes` are free. */
export async function freeSpaceFor(needBytes: number, projectId: number, protect: string[], root?: FileSystemDirectoryHandle): Promise<void> {
  const r = await getRoot(root);
  const held = await heldElsewhere();
  const names = (await versionDirs(r))
    .filter((n) => n.startsWith(`it-${projectId}-`) && !protect.some((p) => n.startsWith(p)) && !held.has(versionLock(n)))
    .sort((a, b) => (opened.get(a) ?? 0) - (opened.get(b) ?? 0));
  for (const name of names) {
    if ((await freeBytes()) >= needBytes) return;
    await r.removeEntry(name, { recursive: true }).catch(() => {});
  }
}

const realSleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
const waitOnline = (signal: AbortSignal) =>
  new Promise<void>((res) => {
    const done = () => {
      window.removeEventListener("online", done);
      signal.removeEventListener("abort", done);
      res();
    };
    window.addEventListener("online", done);
    signal.addEventListener("abort", done);
  });

export type DownloadOpts = {
  projectId: number;
  iterationId: number;
  fileId: string;
  size: number;
  /** `fresh` asks for a new link rather than a cached one. */
  getLink: (fresh?: boolean) => Promise<MediaLink>;
  onProgress(present: boolean[]): void;
  signal: AbortSignal;
  /** Directory-name prefixes freeSpaceFor must not delete (e.g. a compare partner). */
  protect?: string[];
  root?: FileSystemDirectoryHandle;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Called before each wait to retry, with what went wrong; progress means it is going again. */
  onRetry?(message: string): void;
};

/** getLink answers the backend gives for good (no file, not allowed, gone from Drive, not ready). */
const FINAL_LINK_STATUSES = [400, 403, 404, 409];
/** Drive 403 reasons that mean "slow down", not "you may not have this". */
const RATE_LIMITED = ["rateLimitExceeded", "userRateLimitExceeded", "downloadQuotaExceeded"];
const SHORT_CHUNK_TRIES = 5;

async function reasonsOf(res: Response): Promise<string[]> {
  try {
    const body = await res.json();
    return (body?.error?.errors ?? []).map((e: { reason?: string }) => String(e?.reason ?? ""));
  } catch {
    return [];
  }
}

export async function downloadToOpfs(opts: DownloadOpts): Promise<void> {
  const { projectId, iterationId, fileId, size, signal, onProgress } = opts;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? realSleep;
  const root = await getRoot(opts.root);
  signal.throwIfAborted(); // never recreate a folder for a version the person has left
  const name = dirName(projectId, iterationId, fileId);
  const dir = await root.getDirectoryHandle(name, { create: true });
  const present = await presentChunks(dir, size);
  onProgress([...present]);
  const missing = present.flatMap((p, i) => (p ? [] : [i]));
  if (!missing.length) return;

  const needBytes = missing.reduce((s, i) => s + chunkLength(size, i), 0);
  if ((await freeBytes()) < needBytes) {
    await freeSpaceFor(needBytes, projectId, [name, ...(opts.protect ?? [])], root);
    const free = await freeBytes();
    if (free < needBytes) throw new NotEnoughStorage(needBytes, free);
  }

  let link: MediaLink | null = null;
  let linkAt = 0;
  const current = async (fresh = false) => {
    if (fresh || !link || (now() - linkAt) / 1000 > link.expires_in - 60) {
      try {
        link = await opts.getLink(fresh);
      } catch (e) {
        if (e instanceof EditorApiError && FINAL_LINK_STATUSES.includes(e.status)) throw new FatalMediaError(e.message);
        throw e;
      }
      linkAt = now();
    }
    return link;
  };

  for (const i of missing) {
    const start = i * CHUNK_BYTES;
    const want = chunkLength(size, i);
    let refreshed = false;
    let short = 0;
    let blob: Blob | null = null;
    for (let n = 0; !blob; ) {
      signal.throwIfAborted();
      try {
        const l = await current();
        const res = await fetch(l.url, {
          headers: { Authorization: `Bearer ${l.access_token}`, Range: `bytes=${start}-${start + want - 1}` },
          signal,
        });
        if (res.status === 401 && !refreshed) {
          refreshed = true;
          await current(true);
          continue;
        }
        if (res.status === 401) throw new FatalMediaError("Drive refused the download link");
        if (res.status === 403 && (await reasonsOf(res)).some((r) => RATE_LIMITED.includes(r))) throw new Error("Drive asked to slow down");
        if (res.status === 403 || res.status === 404) throw new MediaGone();
        // a one-chunk file asks for every byte, and Drive may answer that with a plain 200
        const whole = start === 0 && want === size;
        if (res.status === 200 && !whole) throw new FatalMediaError("Drive did not honour the range request");
        if (res.status !== 206 && res.status !== 200) {
          if (res.status >= 500 || res.status === 429) throw new Error(`Drive error ${res.status}`);
          throw new FatalMediaError(`Unexpected response ${res.status}`);
        }
        const got = await res.blob();
        if (got.size !== want) {
          if (++short >= SHORT_CHUNK_TRIES) throw new FatalMediaError("Drive keeps sending part of the file");
          throw new Error("Drive sent a short chunk");
        }
        blob = got;
      } catch (e) {
        if (signal.aborted || e instanceof FatalMediaError) throw e;
        opts.onRetry?.(e instanceof Error ? e.message : "Connection lost");
        if (navigator.onLine === false) await waitOnline(signal);
        else await sleep(Math.min(2 * 2 ** n, 60) * 1000);
        n++;
      }
    }
    try {
      const w = await (await dir.getFileHandle(chunkName(i), { create: true })).createWritable();
      await w.write(blob);
      await w.close();
    } catch (e) {
      if (e instanceof DOMException && e.name === "QuotaExceededError") throw new NotEnoughStorage(needBytes, await freeBytes());
      throw e;
    }
    present[i] = true;
    onProgress([...present]);
  }
}
