import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { CheckBadges, IterationCard, IterationDetails } from "./IterationCard";
import type { Checks, Iteration } from "@/lib/useTape";
import type { Tape } from "@/lib/useProject";
import { editorBackend } from "@/lib/testUtils";

const it2 = (over: Partial<Iteration> = {}): Iteration => ({
  id: 2, tape_id: 5, version: 2, filename: "cut2.mp4", size: 1, status: "ready", drive_file_id: "FILE_2",
  uploaded_at: 100, created_at: 100, checks: { duration_s: 3725.4 } as Checks, has_thumbnail: false, ...over,
});
const tape = { id: 5, project_id: 12, name: "Jett dash", kind: "tape", status: "in_review" } as unknown as Tape;

describe("CheckBadges", () => {
  afterEach(() => vi.restoreAllMocks());

  it("says 'Checks pending' when nothing was measured yet", () => {
    expect(render(<CheckBadges checks={null} />).container.textContent).toBe("Checks pending");
  });

  it("shows each state with the value in the tooltip, and anything odd as unknown", () => {
    const checks = { resolution: { state: "pass", value: "1920x1080" }, fps: { state: "bogus", value: 59.94 } } as unknown as Checks;
    const { getByText } = render(<CheckBadges checks={checks} />);
    expect(getByText("Resolution pass").getAttribute("title")).toBe("Resolution: 1920x1080");
    expect(getByText("Frame rate unknown").getAttribute("title")).toBe("Frame rate: 59.94");
    expect(getByText("Bitrate unknown").getAttribute("title")).toBe("Bitrate: not measured");
  });
});

describe("IterationCard", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the duration and downloads from a new-tab link to Google", () => {
    editorBackend({ "/iterations/2": { comments: [] } });
    const { getByText, getByRole } = render(<IterationCard iteration={it2()} tape={tape} role="editor" onStatus={() => {}} locked={false} />);
    expect(getByText("1:02:05")).toBeTruthy();
    const link = getByRole("link", { name: "Download" });
    expect(link.getAttribute("href")).toBe("https://drive.usercontent.google.com/download?id=FILE_2&export=download");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("shows m:ss under an hour, and a disabled Download while a delete is live", () => {
    editorBackend({ "/iterations/2": { comments: [] } });
    const { getByText, getByRole } = render(<IterationCard iteration={it2({ checks: { duration_s: 222 } as Checks })} tape={tape} role="editor" onStatus={() => {}} locked />);
    expect(getByText("3:42")).toBeTruthy();
    expect((getByRole("button", { name: "Download" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("IterationCard Cancel this upload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("an orphaned upload can be cancelled by either role after a confirm, then the tape refreshes", async () => {
    const fetchMock = editorBackend({ "POST /iterations/2/abandon": { id: 2, status: "abandoned" } });
    const onChanged = vi.fn();
    const { getByRole, findByRole, queryByRole } = render(<IterationCard iteration={it2({ status: "uploading" })} tape={tape} role="editor" onStatus={() => {}} locked={false} onChanged={onChanged} />);
    const abandons = () => fetchMock.mock.calls.filter(([u, i]) => u === "/api/editor/iterations/2/abandon" && i?.method === "POST");
    fireEvent.click(getByRole("button", { name: "Cancel this upload" }));
    fireEvent.click(await findByRole("button", { name: "Keep it" }));
    await waitFor(() => expect(queryByRole("alertdialog")).toBeNull());
    expect(abandons()).toHaveLength(0);
    fireEvent.click(getByRole("button", { name: "Cancel this upload" }));
    expect(getByRole("alertdialog", { name: "Cancel the upload of v2?" })).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Cancel upload" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(abandons()).toHaveLength(1);
  });

  it("is not offered on a ready version, nor for an upload this tab is sending", async () => {
    editorBackend({ "/iterations/2": { comments: [] } });
    const ready = render(<IterationCard iteration={it2()} tape={tape} role="admin" onStatus={() => {}} locked={false} />);
    expect(ready.queryByRole("button", { name: "Cancel this upload" })).toBeNull();
    ready.unmount();
    localStorage.setItem("editor.uploads", JSON.stringify([{ tapeId: 5, projectId: 12, name: "x.mp4", size: 1, lastModified: 1, iterationId: 2, version: 2, uploadUrl: "u", sent: 0 }]));
    vi.resetModules(); // the transfers store reads storage once
    const { IterationCard: Card } = await import("./IterationCard");
    const mine = render(<Card iteration={it2({ status: "uploading" })} tape={tape} role="admin" onStatus={() => {}} locked={false} />);
    expect(mine.queryByRole("button", { name: "Cancel this upload" })).toBeNull();
  });
});

describe("IterationCard Add comment", () => {
  it("sets the one-shot flag and goes to the version", () => {
    editorBackend({ "/iterations/2": { comments: [] } });
    sessionStorage.clear();
    const { getByRole } = render(<IterationCard iteration={it2()} tape={tape} role="editor" onStatus={() => {}} locked={false} />);
    fireEvent.click(getByRole("button", { name: "Add comment" }));
    expect(sessionStorage.getItem("editor.openComposer")).toBe("2");
    expect(window.location.hash).toBe("#/p/12/t/5/v/2");
  });
});

describe("IterationDetails", () => {
  it("builds Download and Open in Drive from the file id, never asking for a media link, and shows the duration", async () => {
    const fetchMock = editorBackend({ "/iterations/2": { iteration: it2(), comments: [] } });
    const { findByRole, getByRole, getByText } = render(<IterationDetails iterationId={2} />);
    expect((await findByRole("link", { name: "Download" })).getAttribute("href")).toBe("https://drive.usercontent.google.com/download?id=FILE_2&export=download");
    expect(getByRole("link", { name: /Open in Drive/ }).getAttribute("href")).toBe("https://drive.google.com/file/d/FILE_2/view");
    expect(getByText("1:02:05")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("media-link"))).toBe(false);
  });
});
