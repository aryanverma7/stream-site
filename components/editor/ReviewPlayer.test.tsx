import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { editorBackend } from "@/lib/testUtils";
import { ReviewPlayer } from "./ReviewPlayer";

const GB = 1024 ** 3;
const media = { state: "downloading", present: [true, false], doneBytes: 1.2 * GB, total: 3.4 * GB, error: null as string | null, getLink: vi.fn() };
const worker = { ready: true, error: null as string | null, provide: vi.fn(async () => {}) };
const mediaSpy = vi.fn();
vi.mock("@/lib/useMediaFile", () => ({ useMediaFile: (...a: unknown[]) => (mediaSpy(...a), media) }));
vi.mock("@/lib/useMediaWorker", async () => ({
  ...(await vi.importActual<object>("@/lib/useMediaWorker")),
  useMediaWorker: () => worker,
}));

const IT = { id: 7, version: 3, filename: "cut.mp4", size: 3.4 * GB, drive_file_id: "F1", checks: null };
let backend: ReturnType<typeof editorBackend>;
let time = 0;
let paused = true;
const play = vi.fn();
const pause = vi.fn();

function serve(extra: Record<string, unknown> = {}, comments: unknown[] = []) {
  backend = editorBackend({ "/iterations/7": { iteration: IT, comments, position_s: 100, ...extra }, "PUT /iterations/7/position": { ok: true } });
}
const puts = () => backend.mock.calls.filter((c) => c[1]?.method === "PUT");

beforeEach(() => {
  time = 0;
  paused = true;
  const proto = HTMLMediaElement.prototype;
  Object.defineProperty(proto, "currentTime", { configurable: true, get: () => time, set: (v: number) => void (time = v) });
  Object.defineProperty(proto, "duration", { configurable: true, get: () => 600 });
  Object.defineProperty(proto, "paused", { configurable: true, get: () => paused });
  proto.play = play.mockImplementation(async () => void (paused = false));
  proto.pause = pause.mockImplementation(() => void (paused = true));
  Object.assign(media, { state: "downloading", error: null, doneBytes: 1.2 * GB });
  Object.assign(worker, { ready: true, error: null });
  worker.provide.mockClear();
  serve();
});
afterEach(() => vi.useRealTimers());

async function open(props: Partial<React.ComponentProps<typeof ReviewPlayer>> = {}, now?: () => number) {
  const r = render(<ReviewPlayer projectId={1} tapeId={2} iterationId={7} role="editor" username="cutter" now={now} {...props} />);
  await screen.findByText("Version 3");
  return r;
}
async function watch() {
  fireEvent.click(screen.getByRole("button", { name: "Start watching now" }));
  const video = await waitFor(() => {
    const v = document.querySelector("video");
    expect(v).not.toBeNull();
    return v as HTMLVideoElement;
  });
  return video;
}
const loaded = (v: HTMLVideoElement) => fireEvent.loadedMetadata(v);

describe("ReviewPlayer", () => {
  it("shows download progress; Play only when complete, Start watching now otherwise", async () => {
    await open();
    expect(screen.getByText("Loading v3 · 1.2 of 3.4 GB · 35%")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    expect(screen.getByRole("button", { name: "Start watching now" })).toBeEnabled();
  });

  it("offers Play at 100%", async () => {
    media.state = "complete";
    await open();
    expect(screen.getByRole("button", { name: "Play" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Start watching now" })).toBeNull();
  });

  it("provides the version before setting the video src through the worker", async () => {
    await open();
    const v = await watch();
    expect(worker.provide).toHaveBeenCalledWith(7, expect.objectContaining({ projectId: 1, fileId: "F1", mime: "video/mp4" }));
    expect(v.getAttribute("src")).toBe("/editor/media/7");
    expect(v).not.toHaveAttribute("controls");
  });

  it("disables the button until the worker is ready, hinting a reload if it stays late", async () => {
    worker.ready = false;
    vi.useFakeTimers();
    render(<ReviewPlayer projectId={1} tapeId={2} iterationId={7} role="editor" username="u" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByRole("button", { name: "Start watching now" })).toBeDisabled();
    expect(screen.queryByText("Reload the page to enable playback")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getByText("Reload the page to enable playback")).toBeInTheDocument();
  });

  it("allows watching with a storage note when the browser cannot hold it", async () => {
    Object.assign(media, { state: "error", error: "Not enough browser storage: needs 3.4 GB, 1.0 GB free" });
    await open();
    expect(screen.getByText("Streaming only: not enough browser storage to save it")).toBeInTheDocument();
    expect(screen.getByText("Not enough browser storage: needs 3.4 GB, 1.0 GB free")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start watching now" })).toBeEnabled();
  });

  it("shows other errors with Try again and the worker's error", async () => {
    Object.assign(media, { state: "error", error: "Download failed" });
    worker.error = "no worker";
    await open();
    expect(screen.getByText("Download failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("rounds the percentage down, so 100% means complete", async () => {
    Object.assign(media, { doneBytes: 3.39 * GB });
    await open();
    expect(screen.getByText("Loading v3 · 3.4 of 3.4 GB · 99%")).toBeInTheDocument();
  });

  it("Play on a downloaded version needs no link and starts playing once the position is applied", async () => {
    media.state = "complete";
    await open();
    play.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    const v = await waitFor(() => {
      const el = document.querySelector("video");
      expect(el).not.toBeNull();
      return el as HTMLVideoElement;
    });
    expect(worker.provide).toHaveBeenCalledWith(7, expect.objectContaining({ downloaded: true }));
    expect(play).not.toHaveBeenCalled();
    loaded(v);
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    expect(time).toBe(100);
  });

  it("never saves position 0 before the resume point is applied", async () => {
    const r = await open();
    await watch();
    r.unmount();
    expect(puts()).toHaveLength(0);
  });

  it("Cancel goes back to the tape", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(window.location.hash).toBe("#/p/1/t/2");
  });

  it("seeks to seekS over the saved position, to the saved position otherwise, and to 0 near the end", async () => {
    await open({ seekS: 42 });
    loaded(await watch());
    await waitFor(() => expect(time).toBe(42));
  });
  it("resumes from the saved position", async () => {
    await open();
    loaded(await watch());
    await waitFor(() => expect(time).toBe(100));
  });
  it("starts at 0 when the saved position is near the end", async () => {
    serve({ position_s: 597 });
    await open();
    loaded(await watch());
    await waitFor(() => expect(time).toBe(0));
  });

  it("passes only timed, non-carried comments as markers", async () => {
    serve({}, [
      { id: 1, kind: "fix", start_s: 83, end_s: null, resolved: false, carried: false },
      { id: 2, kind: "fix", start_s: 90, end_s: null, resolved: false, carried: true },
      { id: 3, kind: "keep", start_s: null, end_s: null, resolved: false, carried: false },
    ]);
    await open();
    await watch();
    expect(screen.getAllByRole("button", { name: /^Fix at / }).map((b) => b.getAttribute("aria-label"))).toEqual(["Fix at 1:23"]);
  });

  it("C pauses and opens the composer at the current time; G opens a general one; Esc closes", async () => {
    await open();
    const v = await watch();
    loaded(v);
    paused = false;
    time = 83.4;
    fireEvent.keyDown(document.body, { key: "c" });
    expect(pause).toHaveBeenCalled();
    expect(await screen.findByLabelText("Start")).toHaveValue("1:23.4");
    fireEvent.keyDown(screen.getByLabelText("Comment text"), { key: "Escape" });
    expect(screen.queryByLabelText("Comment text")).toBeNull();
    fireEvent.keyDown(document.body, { key: "g" });
    expect(await screen.findByRole("form", { name: "General comment" })).toBeInTheDocument();
  });

  it("Esc closes the composer before the key sheet", async () => {
    await open();
    loaded(await watch());
    fireEvent.keyDown(document.body, { key: "g" });
    await screen.findByLabelText("Comment text");
    fireEvent.keyDown(document.body, { key: "?" });
    await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByLabelText("Comment text")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).toBeNull();
  });

  it("saves the position at most every 10 s on an injected clock", async () => {
    let t = 1_000_000;
    await open({}, () => t);
    const v = await watch();
    loaded(v);
    paused = false;
    time = 11;
    fireEvent.timeUpdate(v);
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(JSON.parse(String(puts()[0][1]?.body))).toEqual({ position_s: 11 });
    t += 5000;
    fireEvent.timeUpdate(v);
    fireEvent.pause(v);
    expect(puts()).toHaveLength(1);
    t += 5000;
    time = 22;
    fireEvent.timeUpdate(v);
    await waitFor(() => expect(puts()).toHaveLength(2));
  });

  it("`,` pauses and steps one frame (1/60 when fps is unknown); speed cycles", async () => {
    await open();
    const v = await watch();
    loaded(v);
    await waitFor(() => expect(time).toBe(100));
    paused = false;
    fireEvent.keyDown(document.body, { key: "," });
    expect(pause).toHaveBeenCalled();
    expect(time).toBeCloseTo(100 - 1 / 60);
    const speed = screen.getByRole("button", { name: "Speed" });
    expect(speed).toHaveTextContent("1×");
    fireEvent.click(speed);
    expect(speed).toHaveTextContent("1.5×");
    fireEvent.keyDown(document.body, { key: ">" });
    expect(speed).toHaveTextContent("2×");
    expect(v.playbackRate).toBe(2);
    fireEvent.click(speed);
    expect(speed).toHaveTextContent("0.25×");
  });

  it("Space after clicking the timeline plays; keys work from the comment list, not from its reply field", async () => {
    serve({}, [{ id: 1, kind: "fix", author: "s", body: "b", start_s: 83, end_s: null, created_at: 1, updated_at: 1, resolved: false, carried: false, replies: [] }]);
    await open();
    loaded(await watch());
    paused = true;
    play.mockClear();
    fireEvent.keyDown(screen.getByRole("slider"), { key: " " });
    expect(play).toHaveBeenCalledTimes(1);
    const goTo = await screen.findByRole("button", { name: "Go to 1:23" });
    fireEvent.keyDown(goTo, { key: "?" });
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    pause.mockClear();
    fireEvent.keyDown(goTo, { key: " " }); // playing now: Space on the go-to control pauses
    expect(pause).toHaveBeenCalledTimes(1);
    paused = true;
    play.mockClear();
    fireEvent.keyDown(screen.getByLabelText("Reply to s"), { key: "k" });
    expect(play).not.toHaveBeenCalled();
  });

  it("C leaves fullscreen before opening the composer", async () => {
    await open();
    loaded(await watch());
    const exit = vi.fn(async () => {});
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => document.body });
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exit });
    fireEvent.keyDown(document.body, { key: "c" });
    expect(exit).toHaveBeenCalled();
    expect(await screen.findByLabelText("Comment text")).toBeInTheDocument();
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => null });
  });

  it("selecting a range while composing keeps the typed text and kind, and updates the times", async () => {
    await open();
    loaded(await watch());
    time = 20;
    fireEvent.keyDown(document.body, { key: "c" });
    fireEvent.change(await screen.findByLabelText("Comment text"), { target: { value: "too long" } });
    fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "question" } });
    const bar = screen.getByRole("slider");
    bar.getBoundingClientRect = () => ({ left: 0, width: 600, top: 0, height: 10, right: 600, bottom: 10, x: 0, y: 0, toJSON() {} });
    fireEvent.mouseDown(bar, { clientX: 30, shiftKey: true });
    fireEvent.mouseMove(window, { clientX: 60 });
    fireEvent.mouseUp(window);
    await waitFor(() => expect(screen.getByLabelText("Start")).toHaveValue("0:30.0"));
    expect(screen.getByLabelText("End")).toHaveValue("1:00.0");
    expect(screen.getByLabelText("Comment text")).toHaveValue("too long");
    expect(screen.getByLabelText("Kind")).toHaveValue("question");
  });

  it("Try again after a playback error reloads the video", async () => {
    await open();
    const v = await watch();
    fireEvent.error(v);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.queryByText("The video could not be played")).toBeNull();
    expect(document.querySelector("video")).not.toBe(v);
  });

  it("ignores keys when focus is on something outside the player", async () => {
    await open();
    await watch();
    const out = document.body.appendChild(document.createElement("button"));
    fireEvent.keyDown(out, { key: "?" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(screen.getByRole("button", { name: "Speed" }), { key: "?" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    out.remove();
  });

  it("offers nothing to play before the upload finished", async () => {
    serve({ iteration: { ...IT, drive_file_id: null } });
    await open();
    expect(screen.getByText("This version isn't uploaded yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start watching now|^Play$/ })).toBeNull();
    expect(worker.provide).not.toHaveBeenCalled();
  });

  it("shows errors while playing, keeping Download reachable", async () => {
    await open();
    const v = await watch();
    fireEvent.error(v);
    expect(screen.getByText("The video could not be played")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download" })).toBeInTheDocument();
  });

  it("? opens the key sheet; Esc closes it without the shell's zoom-out, then passes through", async () => {
    await open();
    await watch();
    const zoomOut = vi.fn();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && zoomOut();
    window.addEventListener("keydown", onKey);
    fireEvent.keyDown(document.body, { key: "?" });
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(zoomOut).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(zoomOut).toHaveBeenCalledTimes(1);
    window.removeEventListener("keydown", onKey);
  });

  describe("compare and the card's Add comment", () => {
    const withTape = (t: Record<string, unknown>) =>
      editorBackend({ "/iterations/7": { iteration: IT, comments: [], position_s: 100 }, "PUT /iterations/7/position": { ok: true }, ...t });
    const tapeOf = (...v: [number, number, string][]) => ({ "/tapes/2": { tape: { id: 2 }, iterations: v.map(([id, version, status]) => ({ id, version, status })) } });
    beforeEach(() => {
      window.location.hash = "";
      sessionStorage.clear();
    });

    it("V goes to the previous ready version at the current time, and hands it to useMediaFile", async () => {
      withTape(tapeOf([5, 2, "ready"], [6, 4, "uploading"], [7, 3, "ready"]));
      await open();
      await waitFor(() => expect(mediaSpy).toHaveBeenLastCalledWith(expect.anything(), 1, 5));
      expect(screen.getByText("Comparing v2 ↔ v3 · V to switch")).toBeInTheDocument();
      loaded(await watch());
      time = 12.5;
      fireEvent.keyDown(document.body, { key: "v" });
      expect(window.location.hash).toBe("#/p/1/t/2/v/5@12.5");
    });

    it("never starts the download without the partner, and V while the tape loads does nothing", async () => {
      withTape(tapeOf([5, 2, "ready"], [7, 3, "ready"]));
      mediaSpy.mockClear();
      await open();
      await waitFor(() => expect(mediaSpy).toHaveBeenLastCalledWith(expect.anything(), 1, 5));
      for (const c of mediaSpy.mock.calls) if (c[0] !== null) expect(c[2]).toBe(5);
      cleanup();
      const fake = editorBackend({ "/iterations/7": { iteration: IT, comments: [], position_s: 100 } });
      global.fetch = ((u: string, i?: RequestInit) => (u.includes("/tapes/") ? new Promise(() => {}) : fake(u, i))) as unknown as typeof fetch;
      mediaSpy.mockClear();
      render(<ReviewPlayer projectId={1} tapeId={2} iterationId={7} role="editor" username="u" />);
      await screen.findByText("Version 3");
      fireEvent.keyDown(document.body, { key: "v" });
      expect(screen.queryByText("No earlier version to compare")).toBeNull();
      expect(mediaSpy.mock.calls.every((c) => c[0] === null)).toBe(true);
    });

    it("V while playing opens the other version playing at the same time", async () => {
      withTape(tapeOf([5, 2, "ready"], [7, 3, "ready"]));
      await open();
      loaded(await watch());
      paused = false;
      time = 12.5;
      fireEvent.keyDown(document.body, { key: "v" });
      expect(sessionStorage.getItem("editor.resumePlaying")).toMatch(/^5:\d+$/);
      cleanup();
      play.mockClear();
      worker.provide.mockClear();
      editorBackend({ "/iterations/5": { iteration: { ...IT, id: 5, version: 2 }, comments: [], position_s: 100 }, ...tapeOf([5, 2, "ready"], [7, 3, "ready"]) });
      render(<ReviewPlayer projectId={1} tapeId={2} iterationId={5} seekS={12.5} role="editor" username="cutter" />);
      await screen.findByText("Version 2");
      await waitFor(() => expect(sessionStorage.getItem("editor.resumePlaying")).toBeNull());
      await waitFor(() => expect(worker.provide).toHaveBeenCalled());
      loaded(await waitFor(() => document.querySelector("video") as HTMLVideoElement));
      await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
      expect(time).toBe(12.5);
    });

    it("V while paused does not set the resume flag", async () => {
      withTape(tapeOf([5, 2, "ready"], [7, 3, "ready"]));
      await open();
      loaded(await watch());
      paused = true; // Start watching now played it; the person paused
      fireEvent.keyDown(document.body, { key: "v" });
      expect(sessionStorage.getItem("editor.resumePlaying")).toBeNull();
    });

    it("V with no earlier version shows a toast and stays", async () => {
      withTape(tapeOf([7, 3, "ready"]));
      await open();
      loaded(await watch());
      fireEvent.keyDown(document.body, { key: "v" });
      expect(await screen.findByText("No earlier version to compare")).toBeInTheDocument();
      expect(window.location.hash).toBe("");
    });

    it("opens the composer once at the resume time when the card set the flag, then clears it", async () => {
      sessionStorage.setItem("editor.openComposer", "7");
      await open({ seekS: 42 });
      expect(sessionStorage.getItem("editor.openComposer")).toBeNull();
      loaded(await watch());
      expect(await screen.findByRole("button", { name: /Save|Add|Post|Send/i })).toBeInTheDocument();
      expect(time).toBe(42);
    });

    it("a flag for another version, or a resume older than 30 s, does nothing and is cleared", async () => {
      sessionStorage.setItem("editor.openComposer", "9");
      sessionStorage.setItem("editor.resumePlaying", "7:1000");
      await open({}, () => 1000 + 31_000);
      await waitFor(() => expect(sessionStorage.getItem("editor.openComposer")).toBeNull());
      expect(sessionStorage.getItem("editor.resumePlaying")).toBeNull();
      await new Promise((r) => setTimeout(r, 20));
      expect(worker.provide).not.toHaveBeenCalled(); // no automatic start
      loaded(await watch());
      expect(screen.queryByLabelText("Comment text")).toBeNull();
    });

    it("a version that fails to load clears the flags and offers Try again under a heading", async () => {
      sessionStorage.setItem("editor.openComposer", "7");
      let fail = true;
      const good = editorBackend({ "/iterations/7": { iteration: IT, comments: [], position_s: 100 } });
      global.fetch = ((u: string, i?: RequestInit) =>
        fail && u.endsWith("/iterations/7") ? Promise.resolve({ ok: false, status: 502, json: async () => ({ error: "Bad gateway" }) }) : good(u, i)) as unknown as typeof fetch;
      render(<ReviewPlayer projectId={1} tapeId={2} iterationId={7} role="editor" username="cutter" />);
      expect(await screen.findByRole("heading", { name: "This version could not be opened" })).toBeInTheDocument();
      expect(screen.getByText("Bad gateway")).toBeInTheDocument();
      expect(sessionStorage.getItem("editor.openComposer")).toBeNull();
      fail = false;
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(await screen.findByText("Version 3")).toBeInTheDocument();
    });

    it("leaving while the version loads drops its flag", async () => {
      sessionStorage.setItem("editor.openComposer", "7");
      global.fetch = (() => new Promise(() => {})) as unknown as typeof fetch;
      const r = render(<ReviewPlayer projectId={1} tapeId={2} iterationId={7} role="editor" username="cutter" />);
      r.unmount();
      await new Promise((res) => setTimeout(res, 0));
      expect(sessionStorage.getItem("editor.openComposer")).toBeNull();
    });
  });

  describe("audit fixes", () => {
    it("storage-only: Try again after a playback error reloads the video", async () => {
      Object.assign(media, { state: "error", error: "Not enough browser storage: needs 3.4 GB, 1.0 GB free" });
      await open();
      const v = await watch();
      fireEvent.error(v);
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      const again = document.querySelector("video");
      expect(again).not.toBeNull(); // still playing: the element was reloaded, not the whole player
      expect(again).not.toBe(v);
      expect(screen.queryByRole("button", { name: "Start watching now" })).toBeNull();
    });

    it("a reloaded video shows Play and keeps the chosen speed", async () => {
      await open();
      const v = await watch();
      loaded(v);
      fireEvent.play(v);
      fireEvent.click(screen.getByRole("button", { name: "Speed" })); // 1.5×
      fireEvent.error(v);
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      const v2 = document.querySelector("video") as HTMLVideoElement;
      expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
      loaded(v2);
      expect(v2.playbackRate).toBe(1.5);
    });

    it("selecting a range in fullscreen leaves fullscreen and pauses", async () => {
      await open();
      loaded(await watch());
      fireEvent.keyDown(document.body, { key: "c" });
      await screen.findByLabelText("Comment text");
      const exit = vi.fn(async () => {});
      Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => document.body });
      Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exit });
      pause.mockClear();
      const bar = screen.getByRole("slider");
      bar.getBoundingClientRect = () => ({ left: 0, width: 600, top: 0, height: 10, right: 600, bottom: 10, x: 0, y: 0, toJSON() {} });
      fireEvent.mouseDown(bar, { clientX: 30, shiftKey: true });
      fireEvent.mouseMove(window, { clientX: 60 });
      fireEvent.mouseUp(window);
      expect(exit).toHaveBeenCalled();
      expect(pause).toHaveBeenCalled();
      Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => null });
    });

    it("shows the comments while the version downloads, without seeking, and posts /seen once across Try again", async () => {
      serve({}, [{ id: 1, kind: "fix", author: "s", body: "trim the intro", start_s: 83, end_s: null, created_at: 1, updated_at: 1, resolved: false, carried: false, replies: [] }]);
      const fetchMock = backend;
      Object.assign(media, { state: "error", error: "Download failed" });
      await open();
      expect(await screen.findByText("trim the intro")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Go to 1:23" })).toBeDisabled();
      const seen = () => fetchMock.mock.calls.filter((c) => c[1]?.method === "POST" && String(c[0]).endsWith("/seen")).length;
      await waitFor(() => expect(seen()).toBe(1));
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      await screen.findByText("trim the intro");
      await new Promise((r) => setTimeout(r, 10));
      expect(seen()).toBe(1);
    });

    it("says what it is waiting for while the download retries", async () => {
      Object.assign(media, { retrying: "Drive is not connected" });
      await open();
      expect(screen.getByText("Waiting for the Mac Mini / Drive: Drive is not connected")).toBeInTheDocument();
      Object.assign(media, { retrying: null });
    });

    it("holds shared locks on its project and version until it closes", async () => {
      const held: string[] = [];
      const request = vi.fn(async (name: string, _o: unknown, cb: () => Promise<void>) => {
        held.push(name);
        await cb();
        held.splice(held.indexOf(name), 1);
      });
      Object.defineProperty(navigator, "locks", { configurable: true, value: { request, query: async () => ({ held: [] }) } });
      const r = await open();
      expect(request).toHaveBeenCalledWith("opfs-project-1", { mode: "shared" }, expect.any(Function));
      expect(held.sort()).toEqual(["opfs-project-1", "opfs-version-it-1-7-F1"]);
      r.unmount();
      await waitFor(() => expect(held).toEqual([]));
      delete (navigator as unknown as { locks?: unknown }).locks;
    });
  });
});
