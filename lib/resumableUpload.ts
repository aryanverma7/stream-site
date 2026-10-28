/**
 * Google's resumable upload protocol, from the browser straight to Drive:
 * the bytes never pass through the Mac Mini. The session URL is a bearer
 * credential for this one file, so it is never put in an error or a log.
 */
export const CHUNK = 8 * 1024 * 1024; // a multiple of 256 KiB, as Google requires

/** Google forgot the session (it keeps one about a week): ask the backend for a new one. */
export class SessionExpired extends Error {
  constructor() {
    super("The upload session expired");
    this.name = "SessionExpired";
  }
}

class Retry extends Error {}

/** setTimeout as a promise that rejects when `signal` aborts. */
export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason);
      },
      { once: true },
    );
  });

function untilOnline(signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const on = () => {
      window.removeEventListener("online", on);
      resolve();
    };
    window.addEventListener("online", on);
    signal?.addEventListener(
      "abort",
      () => {
        window.removeEventListener("online", on);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/** 308's `Range: bytes=0-N` means Google holds N+1 bytes; no Range means none. */
const heldBytes = (res: Response) => {
  const m = res.headers.get("Range")?.match(/-(\d+)$/);
  return m ? Number(m[1]) + 1 : 0;
};

/**
 * Sends `file` into the session, starting wherever Google says it already
 * is - so the same call is both a fresh upload and a resume. Network
 * errors and 5xx retry with min(5 * 2^n, 300) s of backoff, and wait for
 * `online` first while the browser is offline; every retry re-asks the
 * offset, since a failed PUT may have landed partly.
 */
export async function resumableUpload(
  file: Blob,
  sessionUrl: string,
  opts: {
    onProgress?: (sent: number, total: number) => void;
    onPause?: (reason: "offline" | "retrying" | null) => void;
    signal?: AbortSignal;
    wait?: (ms: number) => Promise<void>;
  },
): Promise<{ id: string }> {
  const { signal } = opts;
  const wait = opts.wait ?? ((ms) => sleep(ms, signal));
  const total = file.size;
  let offset: number | null = null; // null: ask Google first
  let failures = 0;
  for (;;) {
    signal?.throwIfAborted();
    try {
      const end = offset === null ? 0 : Math.min(offset + CHUNK, total);
      const res = await fetch(sessionUrl, {
        method: "PUT",
        signal,
        headers: { "Content-Range": offset === null ? `bytes */${total}` : `bytes ${offset}-${end - 1}/${total}` },
        ...(offset !== null && { body: file.slice(offset, end) }),
      });
      if (res.status === 200 || res.status === 201) {
        opts.onProgress?.(total, total);
        return { id: (await res.json()).id };
      }
      if (res.status === 404 || res.status === 410) throw new SessionExpired();
      if (res.status === 429 || res.status >= 500) throw new Retry();
      if (res.status !== 308) throw new Error(`Google refused the upload (${res.status})`);
      offset = heldBytes(res);
      if (failures) opts.onPause?.(null);
      failures = 0;
      opts.onProgress?.(offset, total);
    } catch (e) {
      if (signal?.aborted || e instanceof SessionExpired || (e instanceof Error && !(e instanceof Retry) && !(e instanceof TypeError))) {
        throw signal?.aborted ? signal.reason : e;
      }
      offset = null;
      if (!navigator.onLine) {
        opts.onPause?.("offline");
        await untilOnline(signal);
      } else {
        opts.onPause?.("retrying");
      }
      await wait(Math.min(5 * 2 ** failures, 300) * 1000);
      failures++;
    }
  }
}
