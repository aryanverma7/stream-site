import { describe, expect, it, vi, afterEach } from "vitest";
import { act, render, fireEvent, waitFor, within } from "@testing-library/react";
import { ProjectsView } from "./ProjectsView";
import { editorBackend } from "@/lib/testUtils";

const vod = {
  id: 12, name: "Ranked grind", stream_date: "2026-10-27", kind: "vod", vod_status: "ready", vod_file_id: "FILE_vod",
  vod_filename: "ranked.mp4", download_clicked_at: null, tape_count: 2, has_new: true, created_at: 50, reel_tape_id: null, duration_s: null,
};
const clip = (id: number, created_at: number, reel: number, extra = {}) => ({
  id, name: `Clip ${id}`, kind: "clip", vod_status: "ready", created_at, reel_tape_id: reel, duration_s: 42, tape_count: 1, has_new: false,
  vod_file_id: `FILE_c${id}`, vod_filename: `c${id}.mp4`, download_clicked_at: null, ...extra,
});
const limbo = (target_id: number) => ({ id: 2, kind: "project", target_id, label: "x", requested_by: "aryan", delete_at: 1, remaining_seconds: 600, status: "pending" });
const reel = (id: number, project_id: number, sources: number[]) => ({
  id, name: `Reel ${id}`, kind: "reel", status: "cutting", project_id, source_project_ids: sources,
});

function base(extra: Record<string, unknown> = {}) {
  return editorBackend({
    "/projects": { projects: [clip(4, 40, 61), vod, clip(3, 20, 60)] },
    "/projects/3": { tapes: [reel(60, 3, [3])] },
    "/projects/4": { tapes: [reel(61, 4, [4])] },
    "/deletions": { pending: [] },
    ...extra,
  });
}

describe("ProjectsView", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists clips oldest first", async () => {
    base();
    const { findAllByRole } = render(<ProjectsView role="admin" username="aryan" />);
    const boxes = await findAllByRole("checkbox");
    expect(boxes.map((b) => b.getAttribute("aria-label"))).toEqual(["Select Clip 3", "Select Clip 4"]);
  });

  it("combines the selected clips by name, and shows the server's refusal", async () => {
    const fetchMock = base({
      "POST /clips/combine": { status: 400, body: { error: "Reel 60 already has a version - clips can only be combined before that" } },
    });
    vi.spyOn(window, "prompt").mockReturnValue("Best of October");
    const { findByLabelText, getByLabelText, getByRole, findByRole } = render(<ProjectsView role="editor" username="cutter" />);

    fireEvent.click(await findByLabelText("Select Clip 3"));
    fireEvent.click(getByLabelText("Select Clip 4"));
    fireEvent.click(getByRole("button", { name: /Combine/ }));

    expect((await findByRole("alert")).textContent).toMatch("already has a version");
    const call = fetchMock.mock.calls.find(([u]) => u === "/api/editor/clips/combine")!;
    expect(JSON.parse(String(call[1]!.body))).toEqual({ project_ids: [3, 4], name: "Best of October" });
  });

  it("shows a combined reel as 'used in' with one Uncombine, on the hosting clip", async () => {
    base({
      "/projects": { projects: [clip(4, 40, 60), clip(3, 20, 60)] },
      "/projects/3": { tapes: [reel(60, 3, [3, 4])] },
      "/projects/4": { tapes: [] },
    });
    const { findAllByText, getAllByRole } = render(<ProjectsView role="admin" username="aryan" />);
    expect(await findAllByText("used in")).toHaveLength(2);
    expect(getAllByRole("button", { name: "Uncombine" })).toHaveLength(1);
  });

  it("downloads the VOD from a real new-tab link to Google, recording the click without waiting for it", async () => {
    const fetchMock = base({ "POST /projects/12/download": { drive_url: "https://drive.google.com/file/d/FILE_vod/view" } });
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign });
    const { findByRole } = render(<ProjectsView role="editor" username="cutter" />);

    const link = await findByRole("link", { name: "Download VOD" });
    const card = within(link.closest("li") as HTMLElement);
    expect(link.getAttribute("href")).toBe("https://drive.usercontent.google.com/download?id=FILE_vod&export=download");
    expect([link.getAttribute("target"), link.getAttribute("rel")]).toEqual(["_blank", "noopener noreferrer"]);
    fireEvent.click(link);
    // Synchronously inside the click, so the browser still treats the link as the user's gesture.
    const call = fetchMock.mock.calls.find(([u]) => u === "/api/editor/projects/12/download");
    expect(call?.[1]).toMatchObject({ method: "POST", credentials: "same-origin", keepalive: true });
    expect(assign).not.toHaveBeenCalled();
    const drive = card.getByRole("link", { name: /Open in Drive/ });
    expect(drive.getAttribute("href")).toBe("https://drive.google.com/file/d/FILE_vod/view");
    expect(drive.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("gives each clip its own Download, Open in Drive and, after the editor's download, Delete", async () => {
    const fetchMock = base({
      "/projects": { projects: [clip(4, 40, 61), clip(3, 20, 60, { download_clicked_at: 9 })] },
      "POST /deletions": { request_id: 1 },
    });
    const { findAllByRole, getByLabelText, getByRole } = render(<ProjectsView role="editor" username="cutter" />);
    const [c3, c4] = (await findAllByRole("listitem")).slice(-2).map((li) => within(li));
    expect(c3.getByRole("link", { name: "Download clip" }).getAttribute("href")).toBe("https://drive.usercontent.google.com/download?id=FILE_c3&export=download");
    expect(c3.getByRole("link", { name: /Open in Drive/ }).getAttribute("href")).toBe("https://drive.google.com/file/d/FILE_c3/view");
    expect(c4.queryByRole("button", { name: "Delete clip file" })).toBeNull(); // not downloaded by the editor yet
    fireEvent.click(c4.getByRole("link", { name: "Download clip" }));
    expect(fetchMock.mock.calls.some(([u, i]) => u === "/api/editor/projects/4/download" && i?.method === "POST")).toBe(true);

    fireEvent.click(c3.getByRole("button", { name: "Delete clip file" }));
    fireEvent.change(getByLabelText("Type the name to confirm"), { target: { value: "c3.mp4" } });
    fireEvent.click(getByRole("button", { name: "Delete in an hour" }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([u, i]) => u === "/api/editor/deletions" && i?.method === "POST")!;
      expect(JSON.parse(String(call[1]!.body))).toEqual({ kind: "vod", target_id: 3, confirm: "c3.mp4" });
    });
  });

  it("a clip in delete limbo cannot be downloaded, deleted, combined or uncombined", async () => {
    base({
      "/projects": { projects: [clip(4, 40, 60, { download_clicked_at: 9 }), clip(3, 20, 60, { download_clicked_at: 9 })] },
      "/projects/3": { tapes: [reel(60, 3, [3, 4])] },
      "/projects/4": { tapes: [] },
      "/deletions": { pending: [limbo(3)] },
    });
    const { findByText, getByLabelText, getAllByRole, queryByRole } = render(<ProjectsView role="admin" username="aryan" />);
    const c3 = within((await findByText("Deleting in 10 min")).closest("li") as HTMLElement);
    expect((getByLabelText("Select Clip 3") as HTMLInputElement).disabled).toBe(true);
    expect((getByLabelText("Select Clip 4") as HTMLInputElement).disabled).toBe(false);
    expect(queryByRole("button", { name: "Uncombine" })).toBeNull();
    expect((c3.getByRole("button", { name: "Download clip" }) as HTMLButtonElement).disabled).toBe(true);
    expect(c3.queryByRole("button", { name: "Delete clip file" })).toBeNull();
    expect(getAllByRole("button", { name: "Delete clip file" })).toHaveLength(1); // Clip 4's
  });

  it("a clip whose file delete goes live is unselectable, marked Being deleted, and drops out of the Combine count", async () => {
    vi.useFakeTimers({ toFake: ["setInterval"] });
    try {
      let pending: unknown[] = [];
      base({
        "/projects": { projects: [clip(5, 50, 62), clip(4, 40, 61), clip(3, 20, 60)] },
        "/projects/5": { tapes: [reel(62, 5, [5])] },
        "/deletions": () => ({ pending }),
      });
      const { findByLabelText, getByLabelText, getByRole, findByText } = render(<ProjectsView role="admin" username="aryan" />);
      fireEvent.click(await findByLabelText("Select Clip 3"));
      fireEvent.click(getByLabelText("Select Clip 4"));
      fireEvent.click(getByLabelText("Select Clip 5"));
      expect(getByRole("button", { name: "Combine 3" })).toBeTruthy();
      pending = [{ ...limbo(5), kind: "vod" }];
      await act(() => vi.advanceTimersByTimeAsync(30_000));
      const box = getByLabelText("Select Clip 5") as HTMLInputElement;
      expect(box.disabled).toBe(true);
      expect(box.checked).toBe(false);
      expect(within((await findByText("Being deleted")).closest("li") as HTMLElement).getByLabelText("Select Clip 5")).toBe(box);
      expect(getByRole("button", { name: "Combine 2" })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("hides Rename and the VOD delete from the editor before their download", async () => {
    base();
    const { findByRole, queryByRole } = render(<ProjectsView role="editor" username="cutter" />);
    await findByRole("link", { name: "Download VOD" });
    expect(queryByRole("button", { name: "Rename" })).toBeNull();
    expect(queryByRole("button", { name: "Delete VOD" })).toBeNull();
  });

  it("shows the streamer Rename, and a refusal from the server", async () => {
    base({ "PATCH /projects/12": { status: 403, body: { error: "Only the streamer can do this." } } });
    vi.spyOn(window, "prompt").mockReturnValue("New name");
    const { findByRole } = render(<ProjectsView role="admin" username="aryan" />);
    fireEvent.click(await findByRole("button", { name: "Rename" }));
    expect((await findByRole("alert")).textContent).toBe("Only the streamer can do this.");
  });

  it("shows a pending VOD delete with its countdown and Undo; Undo brings the VOD back on screen", async () => {
    // delete_at is the Mac Mini's clock and here it is decades off: the countdown must ignore it.
    let pending = [{ id: 9, kind: "vod", target_id: 12, label: "ranked.mp4", requested_by: "cutter", delete_at: 1, remaining_seconds: 42 * 60 - 1, status: "pending" }];
    let vodStatus = "deleting";
    const fetchMock = base({
      "/projects": () => ({ projects: [{ ...vod, vod_status: vodStatus, download_clicked_at: 10 }] }),
      "/deletions": () => ({ pending }),
      "POST /deletions/9/undo": () => {
        pending = [];
        vodStatus = "ready";
        return { request_id: 9, status: "cancelled" };
      },
    });
    const { findByText, findByRole, queryByRole, queryByText } = render(<ProjectsView role="editor" username="cutter" />);

    const badge = (await findByText("Deleting in 42 min")).closest("[role=status]") as HTMLElement;
    // vod_status is "deleting", so there is no Download to press at all.
    expect(queryByRole("button", { name: "Download VOD" })).toBeNull();
    expect(queryByRole("button", { name: "Delete VOD" })).toBeNull();
    fireEvent.click(within(badge).getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(queryByText("Deleting in 42 min")).toBeNull());
    expect(fetchMock.mock.calls.some(([u]) => u === "/api/editor/deletions/9/undo")).toBe(true);
    expect(await findByRole("link", { name: "Download VOD" })).toBeTruthy();
    expect(queryByText("VOD deleting")).toBeNull();
  });

  it("offers the editor no Undo on the streamer's delete", async () => {
    base({ "/deletions": { pending: [{ id: 2, kind: "project", target_id: 12, label: "Ranked grind", requested_by: "aryan", delete_at: 1, remaining_seconds: 600, status: "pending" }] } });
    const { findByText, queryByRole, unmount } = render(<ProjectsView role="editor" username="cutter" />);
    await findByText("Deleting in 10 min");
    expect(queryByRole("button", { name: "Undo" })).toBeNull();
    unmount();

    const admin = render(<ProjectsView role="admin" username="aryan" />);
    await admin.findByText("Deleting in 10 min");
    expect(admin.getByRole("button", { name: "Undo" })).toBeTruthy();
  });

  it("disables Download while a project delete is pending", async () => {
    base({ "/deletions": { pending: [{ id: 2, kind: "project", target_id: 12, label: "Ranked grind", requested_by: "aryan", delete_at: 1, remaining_seconds: 600, status: "pending" }] } });
    const { findByText, getByRole } = render(<ProjectsView role="admin" username="aryan" />);
    await findByText("Deleting in 10 min");
    expect((getByRole("button", { name: "Download VOD" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
