import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { editorBackend } from "@/lib/testUtils";
import { CompareView } from "./CompareView";

const media = { state: "downloading", present: [true], doneBytes: 1, total: 2, error: null as string | null, getLink: vi.fn() };
const worker = { ready: true, error: null as string | null, provide: vi.fn(async () => {}) };
const mediaSpy = vi.fn();
vi.mock("@/lib/useMediaFile", () => ({ useMediaFile: (...a: unknown[]) => (mediaSpy(...a), media) }));
vi.mock("@/lib/useMediaWorker", async () => ({ ...(await vi.importActual<object>("@/lib/useMediaWorker")), useMediaWorker: () => worker }));
const sync = vi.fn(() => () => {});
vi.mock("@/lib/compareSync", () => ({ syncVideos: (...a: unknown[]) => sync(...(a as [])) }));

const it_ = (id: number, version: number, status = "ready") => ({ id, version, status, filename: `v${version}.mp4`, size: 2, drive_file_id: `F${id}`, checks: null });
const serve = (...its: ReturnType<typeof it_>[]) => editorBackend({ "/tapes/2": { tape: { id: 2, name: "Jett" }, iterations: its } });

beforeEach(() => {
  worker.provide.mockClear();
  mediaSpy.mockClear();
  sync.mockClear();
  HTMLMediaElement.prototype.pause = vi.fn();
});

describe("CompareView", () => {
  it("downloads both, protecting each other, then plays them synced with sound from the left", async () => {
    serve(it_(5, 2), it_(7, 3));
    render(<CompareView projectId={1} tapeId={2} leftId={7} rightId={5} />);
    await screen.findByText("v3 ↔ v2");
    expect(mediaSpy).toHaveBeenCalledWith({ id: 7, drive_file_id: "F7", size: 2 }, 1, 5);
    expect(mediaSpy).toHaveBeenCalledWith({ id: 5, drive_file_id: "F5", size: 2 }, 1, 7);
    fireEvent.click(screen.getByRole("button", { name: "Play side by side" }));
    const left = (await screen.findByLabelText("v3")) as HTMLVideoElement;
    const right = screen.getByLabelText("v2") as HTMLVideoElement;
    expect(worker.provide.mock.calls.map((c) => (c as unknown[])[0])).toEqual([7, 5]);
    expect(left.getAttribute("src")).toBe("/editor/media/7");
    await waitFor(() => expect(sync).toHaveBeenCalledWith(left, right));
    expect(left.muted).toBe(false);
    expect(right.muted).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Sound: left (v3)" }));
    expect(left.muted).toBe(true);
    expect(right.muted).toBe(false);
  });

  it("says so when one of the two is not uploaded", async () => {
    serve(it_(5, 2, "uploading"), it_(7, 3));
    render(<CompareView projectId={1} tapeId={2} leftId={7} rightId={5} />);
    expect(await screen.findByText(/Both versions must be uploaded/)).toBeInTheDocument();
  });

  it("Swap sides puts the right one on the left", async () => {
    serve(it_(5, 2), it_(7, 3));
    render(<CompareView projectId={1} tapeId={2} leftId={7} rightId={5} />);
    expect(await screen.findByRole("link", { name: "Swap sides" })).toHaveAttribute("href", "#/p/1/t/2/v/5/vs/7");
  });

  it("shows the codec bar on the pane this browser cannot decode", async () => {
    serve(it_(5, 2), it_(7, 3));
    render(<CompareView projectId={1} tapeId={2} leftId={7} rightId={5} />);
    fireEvent.click(await screen.findByRole("button", { name: "Play side by side" }));
    const right = (await screen.findByLabelText("v2")) as HTMLVideoElement;
    Object.defineProperty(right, "error", { value: { code: 4 } });
    fireEvent.error(right);
    expect(await screen.findAllByRole("alert")).toHaveLength(1);
  });
});
