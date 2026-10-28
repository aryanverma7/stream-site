import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { editorBackend } from "./testUtils";

vi.mock("./mediaChecks", async (orig) => ({
  ...(await orig<typeof import("./mediaChecks")>()),
  measureMedia: vi.fn(async () => ({ width: 1920, height: 1080, duration_s: 10, fps: 60, bitrate_mbps: 55 })),
  thumbnail: vi.fn(async () => "QUJD"),
}));

const MiB = 1024 * 1024;
const SIZE = 20 * MiB;
const file = () => new File([new Uint8Array(SIZE)], "jett.mp4", { type: "video/mp4", lastModified: 1000 });
const target = { tapeId: 5, projectId: 12, kind: "tape" as const };
const stored = () => JSON.parse(localStorage.getItem("editor.uploads") ?? "[]");

/**
 * The backend table plus a fake Google behind every https://upload.example
 * URL. `hold` makes Google stop answering once it holds that many bytes,
 * the way a closed browser stops an upload.
 */
function backend(table: Record<string, unknown>, google: { have?: Record<string, number>; hold?: number; expired?: string[] } = {}) {
  const api = editorBackend(table);
  const have = google.have ?? {};
  const googleCalls: string[] = [];
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (!url.startsWith("https://upload.example")) return api(url, init);
    const range = (init?.headers as Record<string, string>)["Content-Range"];
    googleCalls.push(`${url} ${range}`);
    if (google.expired?.includes(url)) return { status: 404, headers: new Headers(), json: async () => ({}) };
    const m = range.match(/^bytes (\d+)-(\d+)\//);
    if (m) {
      if (google.hold !== undefined && (have[url] ?? 0) >= google.hold) {
        return new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
      }
      have[url] = Number(m[2]) + 1;
    }
    const n = have[url] ?? 0;
    if (n === SIZE) return { status: 200, headers: new Headers(), json: async () => ({ id: "FILE_ID_1" }) };
    return { status: 308, headers: new Headers(n ? { Range: `bytes=0-${n - 1}` } : {}), json: async () => ({}) };
  }) as unknown as typeof fetch;
  return { api, googleCalls };
}

const calls = (api: ReturnType<typeof editorBackend>, method: string, path: string) =>
  api.mock.calls.filter(([u, i]) => u === `/api/editor${path}` && (i?.method ?? "GET") === method).map(([, i]) => (i?.body ? JSON.parse(String(i.body)) : null));

async function fresh() {
  vi.resetModules();
  return import("./useTransfers");
}

describe("useTransfers", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("creates the version, remembers it while sending, then completes, grades and forgets it", async () => {
    const { startUpload, useTransfers } = await fresh();
    let seenWhileSending: unknown[] = [];
    const { api } = backend({
      "POST /tapes/5/iterations": { iteration_id: 7, version: 3, upload_url: "https://upload.example/s1" },
      "POST /iterations/7/complete": () => {
        seenWhileSending = stored();
        return { id: 7, status: "ready" };
      },
      "PUT /iterations/7/media": { id: 7 },
    });
    const onDone = vi.fn();
    const { result } = renderHook(() => useTransfers());
    await act(() => startUpload(target, file(), onDone));

    expect(calls(api, "POST", "/tapes/5/iterations")).toEqual([{ filename: "jett.mp4", size: SIZE, mime: "video/mp4" }]);
    expect(seenWhileSending).toEqual([
      { tapeId: 5, projectId: 12, name: "jett.mp4", size: SIZE, lastModified: 1000, iterationId: 7, version: 3, uploadUrl: "https://upload.example/s1", sent: SIZE },
    ]);
    expect(calls(api, "POST", "/iterations/7/complete")).toEqual([{ file_id: "FILE_ID_1" }]);
    const [media] = calls(api, "PUT", "/iterations/7/media");
    expect(media.thumbnail_b64).toBe("QUJD");
    expect(media.checks.resolution).toEqual({ state: "pass", value: "1920x1080" });
    expect(stored()).toEqual([]);
    expect(result.current[0]).toMatchObject({ name: "jett.mp4", version: 3, state: "done", sent: SIZE });
    expect(onDone).toHaveBeenCalled();
  });

  it("survives a reload as an unfinished entry, and the same file resumes it from Google's offset", async () => {
    let mod = await fresh();
    const table = {
      "POST /tapes/5/iterations": { iteration_id: 7, version: 3, upload_url: "https://upload.example/s1" },
      "/iterations/7": { iteration: { id: 7, status: "uploading" } },
      "POST /iterations/7/complete": { id: 7, status: "ready" },
      "PUT /iterations/7/media": { id: 7 },
    };
    const have: Record<string, number> = {};
    backend(table, { have, hold: 8 * MiB });
    void mod.startUpload(target, file());
    await waitFor(() => expect(stored()[0]?.sent).toBe(8 * MiB));

    // The browser closes; a new page load reads only localStorage.
    mod = await fresh();
    const { result } = renderHook(() => mod.useTransfers());
    expect(result.current).toEqual([
      expect.objectContaining({ name: "jett.mp4", version: 3, sent: 8 * MiB, size: SIZE, state: "paused", tapeId: 5, projectId: 12 }),
    ]);
    await act(() => mod.refreshStored());
    expect(result.current).toHaveLength(1);

    const { api, googleCalls } = backend(table, { have });
    await act(() => mod.startUpload(target, file()));
    expect(calls(api, "POST", "/tapes/5/iterations")).toEqual([]);
    expect(googleCalls[0]).toBe(`https://upload.example/s1 bytes */${SIZE}`);
    expect(googleCalls[1]).toBe(`https://upload.example/s1 bytes ${8 * MiB}-${16 * MiB - 1}/${SIZE}`);
    expect(calls(api, "POST", "/iterations/7/complete")).toHaveLength(1);
    expect(stored()).toEqual([]);
  });

  it("gets the same version a new session when Google has forgotten the old one, and sends it from the start", async () => {
    const mod = await fresh();
    localStorage.setItem(
      "editor.uploads",
      JSON.stringify([{ tapeId: 5, projectId: 12, name: "jett.mp4", size: SIZE, lastModified: 1000, iterationId: 7, version: 3, uploadUrl: "https://upload.example/old", sent: 12 * MiB }]),
    );
    const { api, googleCalls } = backend(
      {
        "POST /iterations/7/session": { upload_url: "https://upload.example/new" },
        "POST /iterations/7/complete": { id: 7, status: "ready" },
        "PUT /iterations/7/media": { id: 7 },
      },
      { expired: ["https://upload.example/old"] },
    );
    await act(() => mod.startUpload(target, file()));
    expect(calls(api, "POST", "/iterations/7/session")).toEqual([{ mime: "video/mp4" }]);
    expect(calls(api, "POST", "/tapes/5/iterations")).toEqual([]);
    expect(googleCalls).toContain(`https://upload.example/new bytes 0-${8 * MiB - 1}/${SIZE}`);
    expect(calls(api, "POST", "/iterations/7/complete")).toHaveLength(1);
  });

  it("cancel stops sending and forgets the entry", async () => {
    const mod = await fresh();
    backend({ "POST /tapes/5/iterations": { iteration_id: 7, version: 3, upload_url: "https://upload.example/s1" } }, { hold: 8 * MiB });
    const { result } = renderHook(() => mod.useTransfers());
    const done = mod.startUpload(target, file());
    await waitFor(() => expect(stored()[0]?.sent).toBe(8 * MiB));
    act(() => mod.cancelTransfer(result.current[0].key));
    await done;
    expect(stored()).toEqual([]);
    expect(result.current).toEqual([]);
  });

  it("explains a Drive that is too full in GB", async () => {
    const mod = await fresh();
    backend({ "POST /tapes/5/iterations": { status: 507, body: { error: "Drive is too full for this file", needed: 20_970_000_000, free: 4_000_000_000 } } });
    const { result } = renderHook(() => mod.useTransfers());
    await act(() => mod.startUpload(target, file()));
    expect(result.current[0]).toMatchObject({ state: "failed", message: "Drive is too full: needs 21.0 GB, 4.0 GB free" });
    expect(stored()).toEqual([]);
  });

  it("still finishes the upload when the checks cannot be measured", async () => {
    const mod = await fresh();
    const checks = await import("./mediaChecks");
    vi.mocked(checks.measureMedia).mockRejectedValueOnce(new Error("no video track"));
    vi.mocked(checks.thumbnail).mockRejectedValueOnce(new Error("no video track"));
    const { api } = backend({
      "POST /tapes/5/iterations": { iteration_id: 7, version: 3, upload_url: "https://upload.example/s1" },
      "POST /iterations/7/complete": { id: 7, status: "ready" },
      "PUT /iterations/7/media": { id: 7 },
    });
    const { result } = renderHook(() => mod.useTransfers());
    await act(() => mod.startUpload(target, file()));
    const [media] = calls(api, "PUT", "/iterations/7/media");
    expect([media.checks.resolution.state, media.checks.fps.state, media.checks.bitrate.state]).toEqual(["unknown", "unknown", "unknown"]);
    expect(media.thumbnail_b64).toBeNull();
    expect(result.current[0].state).toBe("done");
  });

  it("refresh drops entries the server has finished (reconcile) or deleted", async () => {
    const mod = await fresh();
    const entry = (iterationId: number) => ({ tapeId: 5, projectId: 12, name: `f${iterationId}.mp4`, size: 10, lastModified: 1, iterationId, version: 1, uploadUrl: "https://upload.example/x", sent: 0 });
    localStorage.setItem("editor.uploads", JSON.stringify([entry(1), entry(2), entry(3), entry(4)]));
    editorBackend({
      "/iterations/1": { iteration: { status: "ready" } },
      "/iterations/2": { iteration: { status: "uploading" } },
      "/iterations/3": { iteration: { status: "abandoned" } },
    });
    const { result } = renderHook(() => mod.useTransfers());
    await act(() => mod.refreshStored());
    expect(stored().map((s: { iterationId: number }) => s.iterationId)).toEqual([2, 3]);
    expect(result.current.map((t) => t.name)).toEqual(["f2.mp4", "f3.mp4"]);
  });

  it("a cancel while the version is being created never stores it", async () => {
    const mod = await fresh();
    let answer!: (v: unknown) => void;
    const { api } = backend({});
    global.fetch = vi.fn((url: string, init?: RequestInit) =>
      url === "/api/editor/tapes/5/iterations"
        ? new Promise((r) => (answer = r))
        : api(url, init),
    ) as unknown as typeof fetch;
    const { result } = renderHook(() => mod.useTransfers());
    const done = mod.startUpload(target, file());
    await waitFor(() => expect(result.current).toHaveLength(1));
    act(() => mod.cancelTransfer(result.current[0].key));
    answer({ ok: true, status: 200, json: async () => ({ iteration_id: 7, version: 3, upload_url: "https://upload.example/s1" }) });
    await act(() => done);
    expect(stored()).toEqual([]);
    expect(result.current).toEqual([]);
  });

  it("forgets a stored version the server no longer takes uploads for (409 from /session)", async () => {
    const mod = await fresh();
    localStorage.setItem(
      "editor.uploads",
      JSON.stringify([{ tapeId: 5, projectId: 12, name: "jett.mp4", size: SIZE, lastModified: 1000, iterationId: 7, version: 3, uploadUrl: "https://upload.example/old", sent: 0 }]),
    );
    backend({ "POST /iterations/7/session": { status: 409, body: { error: "This version is not uploading" } } }, { expired: ["https://upload.example/old"] });
    const { result } = renderHook(() => mod.useTransfers());
    await act(() => mod.startUpload(target, file()));
    expect(stored()).toEqual([]);
    expect(result.current[0]).toMatchObject({
      state: "failed",
      message: "This version is no longer waiting for an upload — drop the file again to upload it as a new version.",
    });
    act(() => mod.dismissTransfer(result.current[0].key));
    expect(result.current).toEqual([]);
  });
});
