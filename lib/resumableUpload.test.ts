import { describe, expect, it, vi, afterEach } from "vitest";
import { CHUNK, resumableUpload, SessionExpired, STALLED } from "./resumableUpload";

const MiB = 1024 * 1024;
const URL = "https://upload.example/session?upload_id=X";

/** A fake Google session: remembers how many bytes it holds, answers 308 + Range until it has them all. */
function google(total: number, opts: { have?: number; status?: number } = {}) {
  let have = opts.have ?? 0;
  const calls: { range: string; bytes: number }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    expect(url).toBe(URL);
    const range = (init?.headers as Record<string, string>)["Content-Range"];
    const body = init?.body as Blob | undefined;
    calls.push({ range, bytes: body ? body.size : 0 });
    if (opts.status) return { status: opts.status, headers: new Headers(), json: async () => ({}) };
    const m = range.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    if (m) {
      expect(Number(m[1])).toBe(have);
      have = Number(m[2]) + 1;
    }
    if (have === total) return { status: 200, headers: new Headers(), json: async () => ({ id: "FILE1" }) };
    const headers = new Headers(have > 0 ? { Range: `bytes=0-${have - 1}` } : {});
    return { status: 308, headers, json: async () => ({}) };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return { calls, fetchMock };
}

describe("resumableUpload", () => {
  afterEach(() => vi.restoreAllMocks());

  it("asks Google for its offset first, then PUTs 8 MiB chunks with Content-Range", async () => {
    const total = 20 * MiB;
    const { calls } = google(total);
    const progress: number[] = [];
    const res = await resumableUpload(new Blob([new Uint8Array(total)]), URL, { onProgress: (s) => progress.push(s) });
    expect(res).toEqual({ id: "FILE1" });
    expect(CHUNK).toBe(8 * MiB);
    expect(calls).toEqual([
      { range: `bytes */${total}`, bytes: 0 },
      { range: `bytes 0-${8 * MiB - 1}/${total}`, bytes: 8 * MiB },
      { range: `bytes ${8 * MiB}-${16 * MiB - 1}/${total}`, bytes: 8 * MiB },
      { range: `bytes ${16 * MiB}-${total - 1}/${total}`, bytes: 4 * MiB },
    ]);
    expect(progress).toEqual([0, 8 * MiB, 16 * MiB, total]);
  });

  it("resumes from the offset Google reports instead of starting over", async () => {
    const total = 20 * MiB;
    const { calls } = google(total, { have: 12 * MiB });
    await resumableUpload(new Blob([new Uint8Array(total)]), URL, {});
    expect(calls.map((c) => c.range)).toEqual([
      `bytes */${total}`,
      `bytes ${12 * MiB}-${20 * MiB - 1}/${total}`,
    ]);
  });

  it.each([404, 410])("throws SessionExpired on %i", async (status) => {
    google(10, { status });
    await expect(resumableUpload(new Blob(["0123456789"]), URL, {})).rejects.toBeInstanceOf(SessionExpired);
  });

  it("never puts the session URL in an error", async () => {
    google(10, { status: 400 });
    const err = await resumableUpload(new Blob(["0123456789"]), URL, {}).catch((e: Error) => e);
    expect(String((err as Error).message)).not.toContain("upload.example");
  });

  it("pauses while offline and carries on, re-asking the offset, once back online", async () => {
    const total = 10;
    const real = google(total);
    let online = true;
    vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
    let failed = false;
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (!failed && init?.body) {
        failed = true;
        online = false;
        throw new TypeError("Failed to fetch");
      }
      return real.fetchMock(url, init);
    }) as unknown as typeof fetch;
    const waits: number[] = [];
    const pauses: (string | null)[] = [];
    const done = resumableUpload(new Blob(["0123456789"]), URL, {
      wait: async (ms) => void waits.push(ms),
      onPause: (p) => pauses.push(p),
    });
    await vi.waitFor(() => expect(pauses).toContain("offline"));
    online = true;
    window.dispatchEvent(new Event("online"));
    expect(await done).toEqual({ id: "FILE1" });
    expect(waits).toEqual([5000]);
    expect(real.calls.map((c) => c.range)).toEqual(["bytes */10", "bytes */10", "bytes 0-9/10"]);
    expect(pauses.at(-1)).toBeNull();
  });

  it("backs off min(5 * 2^n, 300) s between network failures", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    let n = 0;
    const real = google(10);
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (n++ < 8) throw new TypeError("Failed to fetch");
      return real.fetchMock(url, init);
    }) as unknown as typeof fetch;
    const waits: number[] = [];
    await resumableUpload(new Blob(["0123456789"]), URL, { wait: async (ms) => void waits.push(ms) });
    expect(waits).toEqual([5, 10, 20, 40, 80, 160, 300, 300].map((s) => s * 1000));
  });

  it("stops when aborted", async () => {
    google(10);
    const ctl = new AbortController();
    ctl.abort();
    await expect(resumableUpload(new Blob(["0123456789"]), URL, { signal: ctl.signal })).rejects.toHaveProperty("name", "AbortError");
  });

  it("gives up after three chunks Google answers without holding more bytes, instead of resending forever", async () => {
    const fetchMock = vi.fn(async () => ({ status: 308, headers: new Headers(), json: async () => ({}) }));
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(resumableUpload(new Blob([new Uint8Array(20 * MiB)]), URL, {})).rejects.toThrow(STALLED);
    expect(fetchMock).toHaveBeenCalledTimes(4); // the offset query, then three stalled chunks
  });

  it("a chunk that advances resets the stall count", async () => {
    const total = 4 * CHUNK;
    let have = 0;
    let n = 0;
    global.fetch = vi.fn(async (_u: string, init?: RequestInit) => {
      const m = (init?.headers as Record<string, string>)["Content-Range"].match(/^bytes (\d+)-(\d+)\//);
      // Every other chunk is dropped: two stalls never come three in a row.
      if (m && n++ % 2 === 1) have = Number(m[2]) + 1;
      if (have === total) return { status: 200, headers: new Headers(), json: async () => ({ id: "FILE1" }) };
      return { status: 308, headers: new Headers(have ? { Range: `bytes=0-${have - 1}` } : {}), json: async () => ({}) };
    }) as unknown as typeof fetch;
    expect(await resumableUpload(new Blob([new Uint8Array(total)]), URL, {})).toEqual({ id: "FILE1" });
  });
});
