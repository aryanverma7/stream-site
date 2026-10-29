import { afterEach, describe, expect, it, vi } from "vitest";
import { CHUNK_BYTES, FatalMediaError, MediaGone, NotEnoughStorage, chunkName, dirName, downloadToOpfs, freeSpaceFor, holdLocks, keepOnlyProject, opened } from "./opfsMedia";
import { EditorApiError } from "./editorApi";
import { asFetchMock, fakeDir, fakeStorage } from "./testUtils";

const MIB = 1024 * 1024;
const link = { url: "https://www.googleapis.com/drive/v3/files/F?alt=media", access_token: "t1", expires_in: 3600 };
type Res = { status: number; size?: number; json?: unknown };
const ok = (r: Res) => ({ status: r.status, blob: async () => ({ size: r.size ?? 0 }), json: async () => r.json ?? {} });

/** A fetch answering 206 with exactly the requested range unless `script` says otherwise. */
function fakeFetch(script: Res[] = []) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const mock = vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
    calls.push({ url, headers: init.headers });
    const s = script.shift();
    if (s) return ok(s);
    const [a, b] = init.headers.Range.replace("bytes=", "").split("-").map(Number);
    return ok({ status: 206, size: b - a + 1 });
  });
  global.fetch = asFetchMock(mock);
  return calls;
}

function setup(size: number, quota = 1e12) {
  const root = fakeDir();
  const used = () => [...root.dirs.values()].reduce((s, d) => s + [...d.files.values()].reduce((a, b) => a + b, 0), 0);
  fakeStorage(root, { quota, usage: used });
  const run = (over: Partial<Parameters<typeof downloadToOpfs>[0]> = {}) =>
    downloadToOpfs({
      projectId: 7, iterationId: 1, fileId: "F", size, root,
      getLink: async () => link, onProgress: () => {}, signal: new AbortController().signal, sleep: async () => {},
      ...over,
    });
  return { root, run, dir: () => root.dirs.get(dirName(7, 1, "F"))! };
}

afterEach(() => opened.clear());

describe("downloadToOpfs", () => {
  it("downloads in 32 MiB ranges into chunk files", async () => {
    const calls = fakeFetch();
    const { run, dir } = setup(70 * MIB);
    await run();
    expect(calls.map((c) => c.headers.Range)).toEqual(["bytes=0-33554431", "bytes=33554432-67108863", "bytes=67108864-73400319"]);
    expect([...dir().files]).toEqual([["c00000", CHUNK_BYTES], ["c00001", CHUNK_BYTES], ["c00002", 6 * MIB]]);
  });

  it("resumes after the present chunks", async () => {
    const calls = fakeFetch();
    const { run, root } = setup(70 * MIB);
    const d = await root.getDirectoryHandle(dirName(7, 1, "F"), { create: true });
    (d as ReturnType<typeof fakeDir>).files.set("c00000", CHUNK_BYTES);
    (d as ReturnType<typeof fakeDir>).files.set("c00001", 0);
    await run();
    expect(calls[0].headers.Range).toBe("bytes=33554432-67108863");
    expect(calls).toHaveLength(2);
  });

  it("a short chunk file counts as missing and is fetched again", async () => {
    const calls = fakeFetch();
    const { run, root } = setup(40 * MIB);
    const d = (await root.getDirectoryHandle(dirName(7, 1, "F"), { create: true })) as ReturnType<typeof fakeDir>;
    d.files.set("c00000", CHUNK_BYTES);
    d.files.set("c00001", 5);
    await run();
    expect(calls).toHaveLength(1);
    expect(d.files.get("c00001")).toBe(8 * MIB);
  });

  it("complete version fetches nothing", async () => {
    const calls = fakeFetch();
    const { run, root } = setup(CHUNK_BYTES);
    ((await root.getDirectoryHandle(dirName(7, 1, "F"), { create: true })) as ReturnType<typeof fakeDir>).files.set("c00000", CHUNK_BYTES);
    await run();
    expect(calls).toHaveLength(0);
  });

  it("refreshes the link on 401 and never puts the token in the URL", async () => {
    const calls = fakeFetch([{ status: 401 }]);
    const getLink = vi.fn(async (fresh?: boolean) => (fresh ? { ...link, access_token: "t2" } : link));
    await setup(MIB).run({ getLink });
    expect(calls.map((c) => c.headers.Authorization)).toEqual(["Bearer t1", "Bearer t2"]);
    expect(calls.every((c) => !c.url.includes("access_token"))).toBe(true);
  });

  it("refreshes the link ahead of expiry", async () => {
    fakeFetch();
    let t = 0;
    const getLink = vi.fn(async () => ({ ...link, expires_in: 100 }));
    await setup(70 * MIB).run({ getLink, now: () => (t += 50_000) });
    expect(getLink.mock.calls.length).toBeGreaterThan(1);
  });

  it("retries a 5xx with backoff", async () => {
    const calls = fakeFetch([{ status: 503 }, { status: 503 }]);
    const sleep = vi.fn(async () => {});
    await setup(MIB).run({ sleep });
    expect(calls).toHaveLength(3);
    expect(sleep.mock.calls).toEqual([[2000], [4000]]);
  });

  it("retries a 429 like a 5xx", async () => {
    const calls = fakeFetch([{ status: 429 }]);
    await setup(MIB).run();
    expect(calls).toHaveLength(2);
  });

  it("throws NotEnoughStorage before fetching when freeSpaceFor cannot make room", async () => {
    const calls = fakeFetch();
    await expect(setup(70 * MIB, 10 * MIB).run()).rejects.toBeInstanceOf(NotEnoughStorage);
    expect(calls).toHaveLength(0);
  });

  it("keeps written chunks on QuotaExceededError", async () => {
    fakeFetch();
    const s = setup(70 * MIB);
    const orig = global.fetch;
    let n = 0;
    global.fetch = asFetchMock(vi.fn(async (...a: Parameters<typeof fetch>) => {
      if (++n === 2) s.dir().failWrites = "QuotaExceededError";
      return (orig as (...x: unknown[]) => unknown)(...a);
    }));
    await expect(s.run()).rejects.toBeInstanceOf(NotEnoughStorage);
    expect([...s.dir().files]).toEqual([["c00000", CHUNK_BYTES], ["c00001", 0]]); // empty file = missing
  });

  it("MediaGone on 404", async () => {
    fakeFetch([{ status: 404 }]);
    await expect(setup(MIB).run()).rejects.toBeInstanceOf(MediaGone);
  });

  it("a 403 rate limit is retried; any other 403 is MediaGone", async () => {
    const limited = { error: { errors: [{ reason: "userRateLimitExceeded" }] } };
    const calls = fakeFetch([{ status: 403, json: limited }]);
    await setup(MIB).run();
    expect(calls).toHaveLength(2);
    fakeFetch([{ status: 403, json: { error: { errors: [{ reason: "forbidden" }] } } }]);
    await expect(setup(MIB).run()).rejects.toBeInstanceOf(MediaGone);
  });

  it("a final media-link answer is fatal with the server's words; a passing one is retried and reported", async () => {
    fakeFetch();
    const gone = vi.fn(async () => {
      throw new EditorApiError(404, "This file is no longer on Drive");
    });
    const s = setup(MIB);
    await expect(s.run({ getLink: gone })).rejects.toThrow(new FatalMediaError("This file is no longer on Drive"));
    expect(gone).toHaveBeenCalledTimes(1);
    let n = 0;
    const flaky = vi.fn(async () => {
      if (n++ === 0) throw new EditorApiError(503, "Drive is not connected");
      return link;
    });
    const onRetry = vi.fn();
    await setup(MIB).run({ getLink: flaky, onRetry });
    expect(onRetry).toHaveBeenCalledWith("Drive is not connected");
  });

  it("gives up after five short chunks in a row", async () => {
    const calls = fakeFetch(Array.from({ length: 6 }, () => ({ status: 206, size: 1 })));
    await expect(setup(MIB).run()).rejects.toBeInstanceOf(FatalMediaError);
    expect(calls).toHaveLength(5);
  });

  it("creates no folder once aborted", async () => {
    fakeFetch();
    const ctl = new AbortController();
    ctl.abort();
    const s = setup(MIB);
    await expect(s.run({ signal: ctl.signal })).rejects.toThrow();
    expect(s.root.dirs.size).toBe(0);
  });

  it("refuses a 200 for part of the file", async () => {
    fakeFetch([{ status: 200, size: 40 * MIB }]);
    const s = setup(40 * MIB);
    await expect(s.run()).rejects.toThrow("range");
    expect(s.dir().files.size).toBe(0);
  });

  it("accepts a 200 when the one chunk is the whole file", async () => {
    const calls = fakeFetch([{ status: 200, size: MIB }]);
    const s = setup(MIB);
    await s.run();
    expect(calls[0].headers.Range).toBe("bytes=0-1048575");
    expect([...s.dir().files]).toEqual([["c00000", MIB]]);
  });
});

describe("keepOnlyProject and freeSpaceFor", () => {
  async function seeded() {
    const root = fakeDir();
    fakeStorage(root, { quota: 100, usage: () => 0 });
    for (const n of ["it-3-1-a", "it-7-2-b", "it-7-3-c", "it-7-4-d"]) await root.getDirectoryHandle(n, { create: true });
    return root;
  }

  it("keepOnlyProject(7) deletes project 3's directories and keeps project 7's", async () => {
    const root = await seeded();
    await keepOnlyProject(7, root);
    expect([...root.dirs.keys()]).toEqual(["it-7-2-b", "it-7-3-c", "it-7-4-d"]);
  });

  it("keepOnlyProject(null) deletes all", async () => {
    const root = await seeded();
    await keepOnlyProject(null, root);
    expect(root.dirs.size).toBe(0);
  });

  it("two quick calls run in order", async () => {
    const root = await seeded();
    const log: string[] = [];
    const orig = root.removeEntry.bind(root);
    root.removeEntry = async (n: string) => {
      log.push("start " + n);
      await new Promise((r) => setTimeout(r, 5));
      await orig(n);
      log.push("end " + n);
    };
    await Promise.all([keepOnlyProject(null, root), keepOnlyProject(7, root)]);
    // the second call's listing happens after the first finished: nothing left to remove
    expect(log).toHaveLength(8);
    expect(log.every((l, i) => l.startsWith(i % 2 ? "end" : "start"))).toBe(true);
  });

  it("freeSpaceFor deletes least recently opened first, never protected or another project's", async () => {
    const root = await seeded();
    const free = { n: 0 };
    fakeStorage(root, { quota: 100, usage: () => 100 - free.n });
    const orig = root.removeEntry.bind(root);
    root.removeEntry = async (n: string) => { free.n += 40; await orig(n); };
    opened.set("it-7-2-b", 30);
    opened.set("it-7-3-c", 10);
    opened.set("it-7-4-d", 20);
    await freeSpaceFor(40, 7, ["it-7-3-"], root);
    expect([...root.dirs.keys()].sort()).toEqual(["it-3-1-a", "it-7-2-b", "it-7-3-c"]);
  });
});

describe("another tab's locks", () => {
  function fakeLocks() {
    const held: { name: string }[] = [];
    const locks = {
      held,
      request: async (name: string, _o: unknown, cb: () => Promise<void>) => {
        const l = { name };
        held.push(l);
        try {
          await cb();
        } finally {
          held.splice(held.indexOf(l), 1);
        }
      },
      query: async () => ({ held: [...held] }),
    };
    Object.defineProperty(navigator, "locks", { configurable: true, value: locks });
    return locks;
  }
  afterEach(() => void delete (navigator as unknown as { locks?: unknown }).locks);

  async function seeded() {
    const root = fakeDir();
    fakeStorage(root, { quota: 100, usage: () => 0 });
    for (const n of ["it-3-1-a", "it-7-2-b", "it-7-3-c"]) await root.getDirectoryHandle(n, { create: true });
    return root;
  }

  it("keepOnlyProject skips a project another tab holds, not one this page holds", async () => {
    const locks = fakeLocks();
    const root = await seeded();
    locks.held.push({ name: "opfs-project-3" }); // the other tab
    await keepOnlyProject(null, root);
    expect([...root.dirs.keys()]).toEqual(["it-3-1-a"]);
    locks.held.length = 0;
    const release = holdLocks(["opfs-project-3"]);
    await new Promise((r) => setTimeout(r, 0));
    expect(locks.held).toHaveLength(1);
    await keepOnlyProject(null, root);
    expect(root.dirs.size).toBe(0);
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(locks.held).toHaveLength(0);
  });

  it("freeSpaceFor skips a version another tab holds", async () => {
    const locks = fakeLocks();
    const root = await seeded();
    const free = { n: 0 };
    fakeStorage(root, { quota: 100, usage: () => 100 - free.n });
    const orig = root.removeEntry.bind(root);
    root.removeEntry = async (n: string) => { free.n += 40; await orig(n); };
    opened.set("it-7-2-b", 10);
    opened.set("it-7-3-c", 20);
    locks.held.push({ name: "opfs-version-it-7-2-b" });
    await freeSpaceFor(40, 7, [], root);
    expect([...root.dirs.keys()].sort()).toEqual(["it-3-1-a", "it-7-2-b"]);
  });
});

it("chunk names", () => expect(chunkName(12)).toBe("c00012"));
