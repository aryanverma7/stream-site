import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor, within } from "@testing-library/react";
import { ProjectsView } from "./ProjectsView";
import { editorBackend } from "@/lib/testUtils";

const vod = {
  id: 12, name: "Ranked grind", stream_date: "2026-10-27", kind: "vod", vod_status: "ready", vod_file_id: "FILE_vod",
  vod_filename: "ranked.mp4", download_clicked_at: null, tape_count: 2, has_new: true, created_at: 50, reel_tape_id: null, duration_s: null,
};
const clip = (id: number, created_at: number, reel: number) => ({
  id, name: `Clip ${id}`, kind: "clip", vod_status: "ready", created_at, reel_tape_id: reel, duration_s: 42, tape_count: 1, has_new: false,
});
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
    const { findAllByRole } = render(<ProjectsView role="admin" />);
    const boxes = await findAllByRole("checkbox");
    expect(boxes.map((b) => b.getAttribute("aria-label"))).toEqual(["Select Clip 3", "Select Clip 4"]);
  });

  it("combines the selected clips by name, and shows the server's refusal", async () => {
    const fetchMock = base({
      "POST /clips/combine": { status: 400, body: { error: "Reel 60 already has a version - clips can only be combined before that" } },
    });
    vi.spyOn(window, "prompt").mockReturnValue("Best of October");
    const { findByLabelText, getByLabelText, getByRole, findByRole } = render(<ProjectsView role="editor" />);

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
    const { findAllByText, getAllByRole } = render(<ProjectsView role="admin" />);
    expect(await findAllByText("used in")).toHaveLength(2);
    expect(getAllByRole("button", { name: "Uncombine" })).toHaveLength(1);
  });

  it("downloads the VOD: records the click, then navigates to Google's direct link", async () => {
    const fetchMock = base({
      "POST /projects/12/download": { url: "x", access_token: "SECRET", expires_in: 3000, drive_url: "https://drive.google.com/file/d/FILE_vod/view" },
    });
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign });
    const { findByRole } = render(<ProjectsView role="editor" />);

    fireEvent.click(await findByRole("button", { name: "Download VOD" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://drive.usercontent.google.com/download?id=FILE_vod&export=download"));
    expect(fetchMock.mock.calls.some(([u, i]) => u === "/api/editor/projects/12/download" && i?.method === "POST")).toBe(true);
    const drive = await findByRole("link", { name: /Open in Drive/ });
    expect(drive.getAttribute("rel")).toBe("noopener noreferrer");
    expect(document.body.innerHTML).not.toContain("SECRET");
  });

  it("hides Rename and the VOD delete from the editor before their download", async () => {
    base();
    const { findByRole, queryByRole } = render(<ProjectsView role="editor" />);
    await findByRole("button", { name: "Download VOD" });
    expect(queryByRole("button", { name: "Rename" })).toBeNull();
    expect(queryByRole("button", { name: "Delete VOD" })).toBeNull();
  });

  it("shows the streamer Rename, and a refusal from the server", async () => {
    base({ "PATCH /projects/12": { status: 403, body: { error: "Only the streamer can do this." } } });
    vi.spyOn(window, "prompt").mockReturnValue("New name");
    const { findByRole } = render(<ProjectsView role="admin" />);
    fireEvent.click(await findByRole("button", { name: "Rename" }));
    expect((await findByRole("alert")).textContent).toBe("Only the streamer can do this.");
  });

  it("shows a pending VOD delete with its countdown and Undo, and disables Download", async () => {
    const deleteAt = Date.now() / 1000 + 42 * 60 - 1;
    let pending = [{ id: 9, kind: "vod", target_id: 12, label: "ranked.mp4", requested_by: "cutter", delete_at: deleteAt, status: "pending" }];
    const fetchMock = base({
      "/projects": { projects: [{ ...vod, vod_status: "deleting", download_clicked_at: 10 }] },
      "/deletions": () => ({ pending }),
      "POST /deletions/9/undo": () => {
        pending = [];
        return { request_id: 9, status: "cancelled" };
      },
    });
    const { findByText, getByRole, queryByRole, queryByText } = render(<ProjectsView role="editor" />);

    const badge = (await findByText("Deleting in 42 min")).closest("[role=status]") as HTMLElement;
    // vod_status is "deleting", so there is no Download to press at all.
    expect(queryByRole("button", { name: "Download VOD" })).toBeNull();
    expect(queryByRole("button", { name: "Delete VOD" })).toBeNull();
    fireEvent.click(within(badge).getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(queryByText("Deleting in 42 min")).toBeNull());
    expect(fetchMock.mock.calls.some(([u]) => u === "/api/editor/deletions/9/undo")).toBe(true);
    expect(getByRole("heading", { name: "Projects" })).toBeTruthy();
  });

  it("disables Download while a project delete is pending", async () => {
    const deleteAt = Date.now() / 1000 + 600;
    base({ "/deletions": { pending: [{ id: 2, kind: "project", target_id: 12, label: "Ranked grind", requested_by: "aryan", delete_at: deleteAt, status: "pending" }] } });
    const { findByText, getByRole } = render(<ProjectsView role="admin" />);
    await findByText("Deleting in 10 min");
    expect((getByRole("button", { name: "Download VOD" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
