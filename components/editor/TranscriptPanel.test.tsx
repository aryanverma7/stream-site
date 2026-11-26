import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("downloads the transcript as .srt named after the version", async () => {
    editorBackend({ "/iterations/5/transcript": { status: "done", segments: SEGS, error: null } });
    const blobs: Blob[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((b) => (blobs.push(b as Blob), "blob:x"));
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    let name = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      name = this.download;
    });
    render(<TranscriptPanel iterationId={5} currentTime={0} fileName="Main cut v3" />);
    fireEvent.click(await screen.findByRole("button", { name: "Download .srt" }));
    expect(name).toBe("Main cut v3.srt");
    expect(await blobs[0].text()).toContain("2\r\n00:01:05,000 --> 00:01:10,000\r\nyeh clip mast hai");
  });

  it("fixes a line: Save PUTs and marks it edited; Esc cancels; a refusal shows the error", async () => {
    let segs = SEGS.map((x) => ({ ...x }));
    let refuse = false;
    const fetchMock = editorBackend({
      "/iterations/5/transcript": () => ({ status: "done", segments: segs, error: null }),
      "PUT /iterations/5/transcript/lines/1": (body: { text: string }) => {
        if (refuse) return { status: 409, body: { error: "This transcript is not finished yet" } };
        segs = segs.map((x, i) => (i === 1 ? { ...x, text: body.text, edited: true } : x));
        return { status: "done", segments: segs, error: null };
      },
    });
    render(<TranscriptPanel iterationId={5} currentTime={0} />);
    fireEvent.click(await screen.findByRole("button", { name: "Fix the line at 01:05" }));
    const box = screen.getByRole("textbox", { name: "Fix the line at 01:05" });
    fireEvent.change(box, { target: { value: "yeh clip ekdum mast hai" } });
    fireEvent.keyDown(box, { key: "Escape" });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("yeh clip mast hai")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fix the line at 01:05" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "yeh clip ekdum mast hai" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(screen.getByText("yeh clip ekdum mast hai")).toBeInTheDocument();
      expect(screen.getByText("edited")).toBeInTheDocument();
    });
    expect(fetchMock.mock.calls.some(([u, i]) => u === "/api/editor/iterations/5/transcript/lines/1" && i?.method === "PUT")).toBe(true);

    refuse = true;
    fireEvent.click(screen.getByRole("button", { name: "Fix the line at 01:05" }));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(await screen.findByRole("alert")).toHaveTextContent("This transcript is not finished yet");
    expect(screen.getByRole("textbox")).toBeInTheDocument(); // still open to try again
  });

  it("while a fix is saving, nothing else can open or cancel and the box is locked", async () => {
    let answer: (v: unknown) => void = () => {};
    editorBackend({ "/iterations/5/transcript": { status: "done", segments: SEGS, error: null } });
    const plain = global.fetch;
    global.fetch = vi.fn((url: string, init?: RequestInit) =>
      init?.method === "PUT" ? new Promise((r) => (answer = r)) : plain(url, init),
    ) as unknown as typeof fetch;
    render(<TranscriptPanel iterationId={5} currentTime={0} />);
    fireEvent.click(await screen.findByRole("button", { name: "Fix the line at 01:05" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fix the line at 00:00" })).toBeDisabled();
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly");
    answer({ ok: true, status: 200, json: () => Promise.resolve({ status: "done", segments: SEGS, error: null }) });
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  });
});

