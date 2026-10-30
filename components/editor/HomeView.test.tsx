import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { HomeView } from "./HomeView";
import { editorBackend } from "@/lib/testUtils";

const project = (id: number, extra = {}) => ({
  id, name: `Stream ${id}`, stream_date: "2026-10-27", kind: "vod", vod_status: "ready", vod_file_id: `FILE_${id}`,
  vod_filename: `s${id}.mp4`, download_clicked_at: null, ...extra,
});
const HOME = {
  vods_ready: [project(1)],
  deletes_to_confirm: [project(2, { download_clicked_at: 5 })],
  open_tapes: [{ tape: { id: 5, project_id: 3, name: "Jett dash", status: "changes_asked" }, project_name: "Stream 3", latest_iteration_id: 8, latest_version: 2, open_comments: 3 }],
};

describe("HomeView", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders each bucket with its action", async () => {
    editorBackend({ "/home": HOME });
    const { findByRole, getByRole, getByText } = render(<HomeView role="editor" username="cutter" />);
    expect(await findByRole("link", { name: "Download VOD" })).toBeTruthy();
    expect(getByRole("button", { name: "Confirm delete" })).toBeTruthy();
    expect(getByRole("link", { name: "Jett dash" }).getAttribute("href")).toBe("#/p/3/t/5");
    expect(getByText("v2 · 3 open comments")).toBeTruthy();
  });

  it("downloads from a real new-tab link to Google, recording the click without waiting for it", async () => {
    const fetchMock = editorBackend({ "/home": HOME, "POST /projects/1/download": { drive_url: "x" } });
    const { findByRole, getByRole } = render(<HomeView role="editor" username="cutter" />);
    const link = await findByRole("link", { name: "Download VOD" });
    expect(link.getAttribute("href")).toBe("https://drive.usercontent.google.com/download?id=FILE_1&export=download");
    expect(link.getAttribute("target")).toBe("_blank");
    fireEvent.click(link);
    expect(fetchMock.mock.calls.some(([u, i]) => u === "/api/editor/projects/1/download" && i?.method === "POST" && i.keepalive)).toBe(true);
    expect(getByRole("link", { name: /Open in Drive/ }).getAttribute("href")).toBe("https://drive.google.com/file/d/FILE_1/view");
  });

  it("shows a live VOD delete on a ready VOD, and disables its Download", async () => {
    editorBackend({
      "/home": HOME,
      "/deletions": { pending: [{ id: 3, kind: "vod", target_id: 1, label: "s1.mp4", requested_by: "aryan", delete_at: 1, remaining_seconds: 600, status: "pending" }] },
    });
    const { findByText, getByRole, queryByRole } = render(<HomeView role="editor" username="cutter" />);
    await findByText("Deleting in 10 min");
    expect((getByRole("button", { name: "Download VOD" }) as HTMLButtonElement).disabled).toBe(true);
    expect(queryByRole("link", { name: "Download VOD" })).toBeNull();
  });

  it("hides every project in project-delete limbo, even if the backend still lists it", async () => {
    const del = (id: number, target_id: number) => ({ id, kind: "project", target_id, label: "x", requested_by: "aryan", delete_at: 1, remaining_seconds: 600, status: "pending" });
    editorBackend({ "/home": HOME, "/deletions": { pending: [del(1, 1), del(2, 2), del(3, 3)] } });
    const { findByText, queryByRole } = render(<HomeView role="editor" username="cutter" />);
    await findByText("Nothing new.");
    expect(await findByText("Nothing to confirm.")).toBeTruthy();
    expect(await findByText("No open comments.")).toBeTruthy();
    expect(queryByRole("link", { name: "Stream 1" })).toBeNull();
    expect(queryByRole("link", { name: "Jett dash" })).toBeNull();
  });

  it("Confirm delete opens the dialog against the VOD's file name", async () => {
    const fetchMock = editorBackend({ "/home": HOME, "POST /deletions": { request_id: 1 } });
    const { findByRole, getByLabelText, getByRole } = render(<HomeView role="editor" username="cutter" />);
    fireEvent.click(await findByRole("button", { name: "Confirm delete" }));
    fireEvent.change(getByLabelText("Type the name to confirm"), { target: { value: "s2.mp4" } });
    fireEvent.click(getByRole("button", { name: "Delete in an hour" }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([u, i]) => u === "/api/editor/deletions" && i?.method === "POST")!;
      expect(JSON.parse(String(call[1]!.body))).toEqual({ kind: "vod", target_id: 2, confirm: "s2.mp4" });
    });
  });
});
