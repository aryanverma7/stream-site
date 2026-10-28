import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { Bell } from "./Bell";
import { editorBackend } from "@/lib/testUtils";

const ev = (id: number, kind: string, project_id: number | null = id) => ({
  id, at: 1, actor: "agent", kind, summary: `Stream ${id} VOD is ready`, project_id, tape_id: null, iteration_id: null,
});
// Newest first; the two newest are unseen, so the vod_ready at id 5 is old news.
const FEED = { items: [ev(9, "vod_ready"), ev(8, "comment_added"), ev(5, "vod_ready")], unseen: 2 };

describe("VodReadyPopup", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the editor only the unseen vod_ready items, and Dismiss marks them seen", async () => {
    const fetchMock = editorBackend({ "/notifications": FEED, "POST /notifications/seen": { ok: true } });
    const { findByRole, getByRole, queryByRole } = render(<Bell role="editor" />);
    const dialog = await findByRole("dialog");
    expect(dialog.textContent).toContain("1 new upload is ready");
    expect(getByRole("link", { name: "Stream 9 VOD is ready" }).getAttribute("href")).toBe("#/p/9");
    expect(queryByRole("link", { name: "Stream 5 VOD is ready" })).toBeNull();

    fireEvent.click(getByRole("button", { name: "Dismiss" }));
    expect(queryByRole("dialog")).toBeNull();
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([u]) => u === "/api/editor/notifications/seen")!;
      expect(JSON.parse(String(call[1]!.body))).toEqual({ up_to_id: 9 });
    });
  });

  it("counts several", async () => {
    editorBackend({ "/notifications": { items: [ev(9, "vod_ready"), ev(7, "vod_ready")], unseen: 2 } });
    const { findByRole } = render(<Bell role="editor" />);
    expect((await findByRole("dialog")).textContent).toContain("2 new uploads are ready");
  });

  it("never shows for the streamer", async () => {
    const fetchMock = editorBackend({ "/notifications": FEED });
    const { findByRole, queryByRole } = render(<Bell role="admin" />);
    await findByRole("button", { name: "Notifications (2 unseen)" });
    expect(queryByRole("dialog")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
