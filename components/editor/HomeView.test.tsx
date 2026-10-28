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
    const { findByRole, getByRole, getByText } = render(<HomeView />);
    expect(await findByRole("button", { name: "Download VOD" })).toBeTruthy();
    expect(getByRole("button", { name: "Confirm delete" })).toBeTruthy();
    expect(getByRole("link", { name: "Jett dash" }).getAttribute("href")).toBe("#/p/3/t/5");
    expect(getByText("v2 · 3 open comments")).toBeTruthy();
  });

  it("downloads through the shared flow: records the click, then Google's direct link", async () => {
    const fetchMock = editorBackend({ "/home": HOME, "POST /projects/1/download": { drive_url: "https://drive.google.com/file/d/FILE_1/view" } });
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign });
    const { findByRole } = render(<HomeView />);
    fireEvent.click(await findByRole("button", { name: "Download VOD" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://drive.usercontent.google.com/download?id=FILE_1&export=download"));
    expect(fetchMock.mock.calls.some(([u, i]) => u === "/api/editor/projects/1/download" && i?.method === "POST")).toBe(true);
  });

  it("Confirm delete opens the dialog against the VOD's file name", async () => {
    const fetchMock = editorBackend({ "/home": HOME, "POST /deletions": { request_id: 1 } });
    const { findByRole, getByLabelText, getByRole } = render(<HomeView />);
    fireEvent.click(await findByRole("button", { name: "Confirm delete" }));
    fireEvent.change(getByLabelText("Type the name to confirm"), { target: { value: "s2.mp4" } });
    fireEvent.click(getByRole("button", { name: "Delete in an hour" }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([u]) => u === "/api/editor/deletions")!;
      expect(JSON.parse(String(call[1]!.body))).toEqual({ kind: "vod", target_id: 2, confirm: "s2.mp4" });
    });
  });
});
