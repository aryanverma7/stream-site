import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Comment } from "@/lib/useComments";
import { ExportMarkers } from "./ExportMarkers";

const c = (over: Partial<Comment> = {}): Comment =>
  ({
    id: 1, kind: "fix", author: "aryan", body: "cut", start_s: 3.2, end_s: null, created_at: 1, updated_at: 1,
    resolved: false, carried: false, origin_iteration_id: 1, origin_version: 1, replies: [], ...over,
  }) as Comment;

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

function capture() {
  const blobs: Blob[] = [];
  URL.createObjectURL = vi.fn((b: Blob) => (blobs.push(b), "blob:x"));
  URL.revokeObjectURL = vi.fn();
  const names: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    names.push(this.download);
  });
  return { blobs, names };
}

describe("ExportMarkers", () => {
  it("fills the frame rate from the check, downloads an EDL, and remembers the start", async () => {
    const { blobs, names } = capture();
    render(<ExportMarkers comments={[c()]} fps={59.94} title="Jett dash v2" />);
    expect(screen.getByLabelText("Frame rate")).toHaveValue("59.94");
    fireEvent.change(screen.getByLabelText("Timeline start"), { target: { value: "00:00:00:00" } });
    fireEvent.click(screen.getByRole("button", { name: "DaVinci Resolve (.edl)" }));
    expect(names).toEqual(["Jett dash v2 markers.edl"]);
    expect(await blobs[0].text()).toContain("00:00:03:12");
    expect(JSON.parse(localStorage.getItem("editor.markerExport")!)).toEqual({ fps: 59.94, startTc: "00:00:00:00" });
  });

  it("offers the remembered start next time and downloads Premiere XML", () => {
    localStorage.setItem("editor.markerExport", JSON.stringify({ fps: 30, startTc: "00:59:58:00" }));
    const { names } = capture();
    render(<ExportMarkers comments={[c()]} fps={null} title="t" />);
    expect(screen.getByLabelText("Frame rate")).toHaveValue("30");
    expect(screen.getByLabelText("Timeline start")).toHaveValue("00:59:58:00");
    fireEvent.click(screen.getByRole("button", { name: "Premiere Pro (.xml)" }));
    expect(names).toEqual(["t markers.xml"]);
  });

  it("is disabled with nothing timed and open, and on a bad timecode", () => {
    const { rerender } = render(<ExportMarkers comments={[c({ resolved: true }), c({ start_s: null })]} fps={60} title="t" />);
    expect(screen.getByText("No open comments with a time")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "DaVinci Resolve (.edl)" })).toBeDisabled();
    rerender(<ExportMarkers comments={[c()]} fps={60} title="t" />);
    fireEvent.change(screen.getByLabelText("Timeline start"), { target: { value: "1:00" } });
    expect(screen.getByRole("button", { name: "Premiere Pro (.xml)" })).toBeDisabled();
  });
});
