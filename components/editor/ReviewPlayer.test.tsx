import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { editorBackend } from "@/lib/testUtils";
import { ReviewPlayer } from "./ReviewPlayer";

const GB = 1024 ** 3;
const media = { state: "downloading", present: [true, false], doneBytes: 1.2 * GB, total: 3.4 * GB, error: null as string | null, getLink: vi.fn() };
const worker = { ready: true, error: null as string | null, provide: vi.fn(async () => {}) };
vi.mock("@/lib/useMediaFile", () => ({ useMediaFile: () => media }));
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
    expect(screen.getByRole("button", { name: "Start watching now" })).toBeEnabled();
  });

  it("shows other errors with Try again and the worker's error", async () => {
    Object.assign(media, { state: "error", error: "Download failed" });
    worker.error = "no worker";
    await open();
    expect(screen.getByText("Download failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
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
});
