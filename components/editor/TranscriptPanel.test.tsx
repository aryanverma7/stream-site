import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TranscriptPanel, activeLine } from "./TranscriptPanel";
import { editorBackend } from "@/lib/testUtils";

const SEGS = [
  { start: 0, end: 4, text: "haan toh shuru karte hain" },
  { start: 65, end: 70, text: "yeh clip mast hai" },
];

describe("TranscriptPanel", () => {
  afterEach(() => vi.restoreAllMocks());

  it("none shows Make transcript; a click POSTs and shows the wait", async () => {
    let status = "none";
    const fetchMock = editorBackend({
      "/iterations/5/transcript": () => ({ status, segments: null, error: null }),
      "POST /iterations/5/transcript": () => ((status = "queued"), { status }),
    });
    render(<TranscriptPanel iterationId={5} currentTime={0} />);
    fireEvent.click(await screen.findByRole("button", { name: "Make transcript" }));
    expect(await screen.findByText("Waiting for the PC")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u, i]) => u === "/api/editor/iterations/5/transcript" && i?.method === "POST")).toBe(true);
  });

  it("running shows Transcribing…", async () => {
    editorBackend({ "/iterations/5/transcript": { status: "running", segments: null, error: null } });
    render(<TranscriptPanel iterationId={5} currentTime={0} />);
    expect(await screen.findByText("Transcribing…")).toBeInTheDocument();
  });

  it("failed shows the error and Try again, which asks again", async () => {
    let status = "failed";
    editorBackend({
      "/iterations/5/transcript": () => ({ status, segments: null, error: status === "failed" ? "CUDA out of memory" : null }),
      "POST /iterations/5/transcript": () => ((status = "queued"), { status }),
    });
    render(<TranscriptPanel iterationId={5} currentTime={0} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("CUDA out of memory");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Waiting for the PC")).toBeInTheDocument();
  });

  it("done lists mm:ss lines, marks and scrolls to the spoken one, and a click seeks", async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    editorBackend({ "/iterations/5/transcript": { status: "done", segments: SEGS, error: null } });
    const onSeek = vi.fn();
    render(<TranscriptPanel iterationId={5} currentTime={66} onSeek={onSeek} />);
    const line = await screen.findByRole("button", { name: /01:05 yeh clip mast hai/ });
    expect(line).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /00:00 haan/ })).not.toHaveAttribute("aria-current");
    expect(scroll).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /00:00 haan/ }));
    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it("activeLine: none between lines or before the first", () => {
    expect(activeLine(SEGS, 2)).toBe(0);
    expect(activeLine(SEGS, 10)).toBe(-1);
    expect(activeLine(SEGS, 69.9)).toBe(1);
    expect(activeLine([], 3)).toBe(-1);
  });
});
