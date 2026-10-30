import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { createRoot } from "react-dom/client";
import { Bell } from "./Bell";
import { VodReadyPopup } from "./VodReadyPopup";
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

    // The oldest unseen (8) is a comment: the high-water marker cannot pass it, so nothing is marked.
    fireEvent.click(getByRole("button", { name: "Dismiss" }));
    expect(queryByRole("dialog")).toBeNull();
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock.mock.calls.some(([u]) => u === "/api/editor/notifications/seen")).toBe(false);
  });

  it("Dismiss marks seen only through the oldest run of vod_ready, never past an unseen comment", async () => {
    // Unseen, newest first: 9 vod_ready, 8 comment, 7 vod_ready, 6 vod_ready.
    const fetchMock = editorBackend({
      "/notifications": { items: [ev(9, "vod_ready"), ev(8, "comment_added"), ev(7, "vod_ready"), ev(6, "vod_ready")], unseen: 4 },
      "POST /notifications/seen": { ok: true },
    });
    const { findByRole, getByRole } = render(<Bell role="editor" />);
    expect((await findByRole("dialog")).textContent).toContain("3 new uploads are ready");
    fireEvent.click(getByRole("button", { name: "Dismiss" }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([u]) => u === "/api/editor/notifications/seen")!;
      expect(JSON.parse(String(call[1]!.body))).toEqual({ up_to_id: 7 });
    });
  });

  it("one Esc closes only the popup, not the bell panel under it", async () => {
    // Feed never arrives before the panel opens; then it does, and the popup lands on top.
    let resolve!: (v: unknown) => void;
    editorBackend({ "/notifications": () => new Promise((r) => (resolve = r)), "POST /notifications/seen": { ok: true } });
    const { getByRole, findByRole, queryByRole, getByText } = render(<Bell role="editor" />);
    fireEvent.click(getByRole("button", { name: /Notifications/ }));
    expect(getByText("Nothing yet.")).toBeTruthy();
    resolve({ items: [ev(9, "vod_ready")], unseen: 1 });
    await findByRole("dialog");
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(queryByRole("dialog")).toBeNull();
    expect(queryByRole("link", { name: /Stream 9 VOD is ready/ })).toBeTruthy();
  });

  it("Esc works the moment the dialog is in the DOM, before any later task runs", async () => {
    // A real (non-act) render: the dialog's DOM and its Esc listener must land in the same commit,
    // or a key pressed right after it appears (what findByRole + keyDown does) is missed.
    const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const prev = g.IS_REACT_ACT_ENVIRONMENT;
    g.IS_REACT_ACT_ENVIRONMENT = false;
    const markSeen = vi.fn(() => Promise.resolve());
    const bell = { items: [ev(9, "vod_ready")], unseen: 1, loaded: true, markSeen };
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    try {
      const pressed = new Promise<void>((done) => {
        const mo = new MutationObserver(() => {
          if (!host.querySelector('[role="dialog"]')) return;
          mo.disconnect();
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
          done();
        });
        mo.observe(host, { childList: true, subtree: true });
      });
      root.render(<VodReadyPopup bell={bell} />);
      await pressed;
      expect(markSeen).toHaveBeenCalledWith(9);
    } finally {
      root.unmount();
      host.remove();
      g.IS_REACT_ACT_ENVIRONMENT = prev;
    }
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
