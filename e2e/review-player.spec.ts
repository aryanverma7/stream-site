/**
 * The review player in a real browser: service-worker range playback, the
 * OPFS download, resume after the tab closes, Start watching now, and a clip
 * under one chunk. Each test gets its own mock backend and mock Drive (own
 * ports, so its own origin and an empty OPFS).
 */
import { test as base, expect, type Page } from "@playwright/test";
import { statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MEDIA, OUT } from "./global-setup";
import { startBackend, startDrive, type Backend, type Drive, type Fixture } from "./mocks";

const CHUNK = 32 * 1024 * 1024; // lib/opfsMedia.ts CHUNK_BYTES; not overridable, so the big video is > 2 chunks

// read when used: test files load before global-setup makes the videos
const size = (f: string) => statSync(path.join(MEDIA, f)).size;
const VOD: Fixture = { projectId: 1, tapeId: 10, iterationId: 100, fileId: "bigfile", filename: "big.webm", get size() { return size("big.webm"); }, kind: "vod" };
const CLIP: Fixture = { projectId: 2, tapeId: 20, iterationId: 200, fileId: "clipfile", filename: "clip.webm", get size() { return size("clip.webm"); }, kind: "clip" };
const dir = (f: Fixture) => `it-${f.projectId}-${f.iterationId}-${f.fileId}`;
const hash = (f: Fixture) => `#/p/${f.projectId}/t/${f.tapeId}/v/${f.iterationId}`;

// fixtures name their callback `provide`, not `use`: the React hooks lint rule reads `use` as a hook
const test = base.extend<{ drive: Drive; backend: Backend }>({
  drive: async ({}, provide) => {
    const drive = await startDrive({ [VOD.fileId]: path.join(MEDIA, VOD.filename), [CLIP.fileId]: path.join(MEDIA, CLIP.filename) });
    await provide(drive);
    await drive.close().catch(() => {});
  },
  backend: async ({ drive }, provide) => {
    const backend = await startBackend(OUT, drive, [VOD, CLIP]);
    await provide(backend);
    if (test.info().status !== test.info().expectedStatus)
      writeFileSync(test.info().outputPath("server-logs.json"), JSON.stringify({ drive: drive.log, backend: backend.log }, null, 1));
    await backend.close();
  },
});

/**
 * Holds the page's own Drive requests (the OPFS download) from byte `from`
 * on, until release(). page.route never sees the service worker's requests,
 * so playback is untouched. `starts` is every Range start the page asked for.
 */
async function holdDownload(page: Page, drive: Drive, from: number) {
  const waiting: (() => void)[] = [];
  let holding = true;
  const starts: number[] = [];
  await page.route(
    (u) => u.href.startsWith(drive.origin),
    async (route) => {
      const start = Number(/bytes=(\d+)-/.exec(route.request().headers().range ?? "")?.[1] ?? 0);
      starts.push(start);
      if (holding && start >= from) await new Promise<void>((go) => waiting.push(go));
      await route.continue().catch(() => {}); // the page may have closed meanwhile
    },
  );
  return {
    starts,
    release() {
      holding = false;
      waiting.splice(0).forEach((go) => go());
    },
  };
}

async function open(page: Page, backend: Backend, f: Fixture) {
  await page.goto(backend.origin + "/editor" + hash(f));
  await expect(page.getByRole("heading", { name: "Version 1" })).toBeVisible();
}

/** Name and size of every file in the version's OPFS directory ([] when it has none). */
const chunks = (page: Page, f: Fixture) =>
  page.evaluate(async (name) => {
    const out: [string, number][] = [];
    try {
      const d = await (await navigator.storage.getDirectory()).getDirectoryHandle(name);
      for await (const [n, h] of (d as unknown as { entries(): AsyncIterable<[string, FileSystemFileHandle]> }).entries()) out.push([n, (await h.getFile()).size]);
    } catch {
      /* no directory */
    }
    return out.sort();
  }, dir(f));

const expected = (f: Fixture) =>
  Array.from({ length: Math.ceil(f.size / CHUNK) }, (_, i) => ["c" + String(i).padStart(5, "0"), Math.min(f.size, (i + 1) * CHUNK) - i * CHUNK] as [string, number]);

const time = (page: Page) => page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime);

/** The video is playing: currentTime moves past `from` + 0.5 s without an error. */
async function playsFrom(page: Page, from: number) {
  await expect.poll(() => time(page), { message: "currentTime advances" }).toBeGreaterThan(from + 0.5);
  await expect(page.locator("video")).toHaveJSProperty("error", null);
}

async function seekAndPlay(page: Page, to: number) {
  // play() too: on a slow run the 12 s video may have reached its end, and an ended video stays paused
  await page.locator("video").evaluate((v: HTMLVideoElement, t) => {
    v.currentTime = t;
    return v.play();
  }, to);
  await playsFrom(page, to);
}

/** Nothing reached the backend for /editor/media: every byte the <video> got came through the worker. */
const noMediaHits = (backend: Backend) => expect(backend.log.filter((l) => l.includes("/editor/media/"))).toEqual([]);

const downloaded = (page: Page) => expect(page.getByText("Downloaded", { exact: true })).toBeVisible({ timeout: 30_000 });

test("the service worker plays and seeks by range", async ({ page, backend, drive }) => {
  expect(VOD.size).toBeGreaterThan(2 * CHUNK);
  await holdDownload(page, drive, 0); // nothing on disk: every byte is a worker range from Drive
  drive.rate = 8_000_000; // slower than the browser reads ahead, so a seek past it is a new range
  await open(page, backend, VOD);
  await page.getByRole("button", { name: "Start watching now" }).click();
  await expect(page.locator("video")).toHaveAttribute("src", `/editor/media/${VOD.iterationId}`);
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await playsFrom(page, 0);

  const before = drive.log.length;
  await seekAndPlay(page, 9); // ~9/12 of the file, far past what is buffered
  expect(drive.log.slice(before).some((r) => r.start > 0.6 * VOD.size && r.status === 206)).toBe(true);
  await seekAndPlay(page, 1); // and back
  expect(drive.log.every((r) => r.auth)).toBe(true);
  expect(await chunks(page, VOD)).toEqual([]);
  noMediaHits(backend);
});

test("a finished download plays from OPFS with Drive gone", async ({ page, backend, drive }) => {
  await open(page, backend, VOD);
  await downloaded(page);
  expect(await chunks(page, VOD)).toEqual(expected(VOD));

  await drive.close();
  const driveCalls = drive.log.length;
  await page.reload(); // a fresh page and worker message, still nothing but the disk
  await downloaded(page);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await playsFrom(page, 0);
  await seekAndPlay(page, 9);
  expect(drive.log.length).toBe(driveCalls);
  noMediaHits(backend);
});

test("a download cut off by closing the tab resumes where it stopped", async ({ context, backend, drive }) => {
  const first = await context.newPage();
  const cut = await holdDownload(first, drive, CHUNK);
  await open(first, backend, VOD);
  await expect.poll(() => chunks(first, VOD)).toEqual(expected(VOD).slice(0, 1));
  await expect.poll(() => cut.starts).toContain(CHUNK); // chunk 1 is in flight
  await first.close();

  const second = await context.newPage();
  const resumed = await holdDownload(second, drive, Infinity);
  await open(second, backend, VOD);
  await downloaded(second);
  expect(await chunks(second, VOD)).toEqual(expected(VOD));
  expect(resumed.starts).toEqual(expected(VOD).slice(1).map((_, i) => (i + 1) * CHUNK)); // never chunk 0 again
  expect(drive.log.filter((r) => r.start === 0)).toHaveLength(1);
});

test("Start watching now streams before the download finishes", async ({ page, backend, drive }) => {
  const hold = await holdDownload(page, drive, CHUNK);
  await open(page, backend, VOD);
  await expect(page.getByText(/Loading v1 · .* GB · \d+%/)).toBeVisible();
  await page.getByRole("button", { name: "Start watching now" }).click();
  await playsFrom(page, 0);
  await seekAndPlay(page, 7); // inside chunk 1, which the download has not written
  expect((await chunks(page, VOD)).map(([n]) => n)).toEqual(["c00000"]);

  hold.release(); // the download carries on under the playing video
  await expect.poll(() => chunks(page, VOD), { timeout: 30_000 }).toEqual(expected(VOD));
  await seekAndPlay(page, 2); // and plays on, now from disk
  noMediaHits(backend);
});

test("a clip under one chunk downloads and plays", async ({ page, backend, drive }) => {
  expect(CLIP.size).toBeLessThan(CHUNK);
  await open(page, backend, CLIP);
  await downloaded(page);
  expect(await chunks(page, CLIP)).toEqual([["c00000", CLIP.size]]);
  expect(drive.log.filter((r) => r.id === CLIP.fileId)).toEqual([{ id: CLIP.fileId, start: 0, end: CLIP.size - 1, status: 206, auth: true }]);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await playsFrom(page, 0);
  await seekAndPlay(page, 4);
  noMediaHits(backend);
});
