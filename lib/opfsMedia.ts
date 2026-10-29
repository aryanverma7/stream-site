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

let queue: Promise<unknown> = Promise.resolve();

/** Deletes every version directory outside `projectId` (all when null). Calls run one after another. */
export function keepOnlyProject(projectId: number | null, root?: FileSystemDirectoryHandle): Promise<void> {
  const run = async () => {
    const r = await getRoot(root);
    for (const name of await versionDirs(r)) {
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
  const names = (await versionDirs(r))
    .filter((n) => n.startsWith(`it-${projectId}-`) && !protect.some((p) => n.startsWith(p)))
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
};

export async function downloadToOpfs(opts: DownloadOpts): Promise<void> {
  const { projectId, iterationId, fileId, size, signal, onProgress } = opts;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? realSleep;
  const root = await getRoot(opts.root);
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
      link = await opts.getLink(fresh);
      linkAt = now();
    }
    return link;
  };

  for (const i of missing) {
    const start = i * CHUNK_BYTES;
    const want = chunkLength(size, i);
    let refreshed = false;
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
        if (res.status === 403 || res.status === 404) throw new MediaGone();
        // a one-chunk file asks for every byte, and Drive may answer that with a plain 200
        const whole = start === 0 && want === size;
        if (res.status === 200 && !whole) throw new FatalMediaError("Drive did not honour the range request");
        if (res.status !== 206 && res.status !== 200) {
          if (res.status >= 500 || res.status === 429) throw new Error(`Drive error ${res.status}`);
          throw new FatalMediaError(`Unexpected response ${res.status}`);
        }
        const got = await res.blob();
        if (got.size !== want) throw new Error("Drive sent a short chunk");
        blob = got;
      } catch (e) {
        if (signal.aborted || e instanceof FatalMediaError) throw e;
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
