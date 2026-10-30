import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { Blob as NodeBlob } from "node:buffer";

/**
 * Loads public/editor/media-sw.js into a sandbox with a fake self, OPFS,
 * fetch and timer, and drives its fetch handler. CHUNK_BYTES is shrunk to 4
 * bytes after loading so ranges across chunks need no real 32 MiB files.
 */
const dir = join(__dirname, "..", "public", "editor");
const FILE = "0123456789"; // the whole video: 10 bytes, chunks of 4

type Opts = { onDisk?: number[]; fetch?: (url: string, init: RequestInit) => Promise<Response>; linkTimeout?: boolean };

function load({ onDisk = [], fetch, linkTimeout = false }: Opts = {}) {
  const listeners = new Map<string, (e: unknown) => void>();
  const chunks = new Map(onDisk.map((c) => [`c0000${c}`, new NodeBlob([FILE.slice(c * 4, c * 4 + 4)])]));
  const versionDir = {
    getFileHandle: async (n: string) => {
      const b = chunks.get(n);
      if (!b) throw new DOMException("missing", "NotFoundError");
      return { getFile: async () => b };
    },
  };
  const page = { postMessage: vi.fn() };
  const claim = vi.fn(async () => {});
  const ctx: Record<string, unknown> = {
    self: {
      addEventListener: (t: string, f: (e: unknown) => void) => listeners.set(t, f),
      skipWaiting() {},
      clients: { claim, get: async () => page, matchAll: async () => [page] },
      location: { origin: "https://site" },
    },
    navigator: { storage: { getDirectory: async () => ({ getDirectoryHandle: async (n: string) => (n === "it-1-7-F" ? versionDir : Promise.reject(new Error("no"))) }) } },
    fetch: fetch ?? (async () => new Response("", { status: 500 })),
    setTimeout: (f: () => void, ms: number) => (linkTimeout ? queueMicrotask(f) : globalThis.setTimeout(f, ms)),
    clearTimeout: (h: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(h),
    Response, ReadableStream, AbortController, URL, Promise, Map, Math, Number, String,
    importScripts: (p: string) => vm.runInContext(readFileSync(join(dir, p.split("/").pop()!), "utf8"), ctx),
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(dir, "media-sw.js"), "utf8"), ctx);
  ctx.CHUNK_BYTES = 4;
  const message = (data: unknown, waitUntil?: (p: Promise<unknown>) => void) => listeners.get("message")!({ data, waitUntil });
  const get = (range: string | null) => {
    let answer: Promise<Response> | undefined;
    listeners.get("fetch")!({
      request: { url: "https://site/editor/media/7", headers: { get: () => range } },
      clientId: "c1",
      respondWith: (p: Promise<Response>) => (answer = p),
    });
    return answer!;
  };
  return { message, get, page, claim };
}

const info = (link: unknown) => ({ type: "media", iterationId: 7, projectId: 1, fileId: "F", size: FILE.length, mime: "video/mp4", link });
const fresh = (token: string) => ({ url: "https://drive/F", access_token: token, expires_in: 3600, expires_at: Date.now() + 3_600_000 });

/** A Drive fake that answers the requested range from FILE, after an optional script of statuses. */
function drive(script: number[] = []) {
  const calls: { range: string; auth: string }[] = [];
  const f = vi.fn(async (_u: string, init: RequestInit) => {
    const h = init.headers as Record<string, string>;
    calls.push({ range: h.Range, auth: h.Authorization });
    const s = script.shift();
    if (s) return new Response("no", { status: s });
    const [a, b] = h.Range.replace("bytes=", "").split("-").map(Number);
    return new Response(FILE.slice(a, b + 1), { status: 206 });
  });
  return { f, calls };
}

describe("media-sw.js serve()", () => {
  it("answers a range from disk where present and from Drive for the rest", async () => {
    const d = drive();
    const sw = load({ onDisk: [0], fetch: d.f });
    sw.message(info(fresh("t")));
    const res = await sw.get("bytes=2-6");
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 2-5/10"); // capped at one CHUNK_BYTES
    expect(await res.text()).toBe("2345");
    expect(d.calls).toEqual([{ range: "bytes=4-5", auth: "Bearer t" }]);
  });

  it("answers 416 for a range past the end", async () => {
    const sw = load();
    sw.message(info(fresh("t")));
    const res = await sw.get("bytes=50-");
    expect(res.status).toBe(416);
    expect(res.headers.get("Content-Range")).toBe("bytes */10");
  });

  it("asks the page for a link and answers 503 when none comes in time", async () => {
    const sw = load({ linkTimeout: true });
    const res = await sw.get("bytes=0-3");
    expect(sw.page.postMessage).toHaveBeenCalledWith({ type: "need-link", iterationId: 7, need: "info" });
    expect(res.status).toBe(503);
  });

  it("retries a 401 once with a fresh link from the page", async () => {
    const d = drive([401]);
    const sw = load({ fetch: d.f });
    sw.message(info(fresh("old")));
    sw.page.postMessage.mockImplementation(() => queueMicrotask(() => sw.message(info(fresh("new")))));
    const res = await sw.get("bytes=0-3");
    expect(res.status).toBe(206);
    expect(await res.text()).toBe("0123");
    expect(d.calls.map((c) => c.auth)).toEqual(["Bearer old", "Bearer new"]);
    expect(sw.page.postMessage).toHaveBeenCalledWith({ type: "need-link", iterationId: 7, need: "link" });
  });

  it("a wait for a Drive link ignores an answer with no link and takes the real one after it", async () => {
    const d = drive();
    const sw = load({ fetch: d.f });
    sw.message(info(null)); // a downloaded version: size and type, no token
    sw.page.postMessage.mockImplementation(() =>
      queueMicrotask(() => {
        sw.message(info(null)); // the page's quick "info" answer
        setTimeout(() => sw.message(info(fresh("real"))), 0);
      }),
    );
    const res = await sw.get("bytes=0-3");
    expect(sw.page.postMessage).toHaveBeenCalledWith({ type: "need-link", iterationId: 7, need: "link" });
    expect(res.status).toBe(206);
    expect(await res.text()).toBe("0123");
    expect(d.calls.map((c) => c.auth)).toEqual(["Bearer real"]);
  });

  it("an info wait ends on any answer, link or not", async () => {
    const sw = load({ onDisk: [0] });
    sw.page.postMessage.mockImplementation(() => queueMicrotask(() => sw.message(info(null))));
    const res = await sw.get("bytes=0-3");
    expect(res.status).toBe(206);
    expect(await res.text()).toBe("0123");
  });

  it("claims the page when it asks (a shift+reload left it uncontrolled)", async () => {
    const sw = load();
    const waitUntil = vi.fn();
    sw.message({ type: "claim" }, waitUntil);
    expect(sw.claim).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise));
  });

  it("cancelling the body aborts the Drive fetch in flight", async () => {
    let signal: AbortSignal | undefined;
    const sw = load({
      onDisk: [0],
      fetch: async (_u, init) => {
        signal = init.signal ?? undefined;
        return new Promise<Response>((_res, rej) => init.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))));
      },
    });
    sw.message(info(fresh("t")));
    const res = await sw.get("bytes=2-6");
    const reader = res.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("23");
    const next = reader.read().catch(() => null); // now opening the Drive piece
    await new Promise((r) => setTimeout(r, 0));
    await reader.cancel();
    await next;
    expect(signal?.aborted).toBe(true);
  });
});
