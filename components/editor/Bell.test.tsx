import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { Bell } from "./Bell";
import { editorBackend } from "@/lib/testUtils";

const ev = (id: number, kind: string, extra = {}) => ({
  id, at: 1_700_000_000, actor: "cutter", kind, summary: `event ${id}`, project_id: 1, tape_id: 2, iteration_id: 3, ...extra,
});

function seenBodies(fetchMock: ReturnType<typeof editorBackend>) {
  return fetchMock.mock.calls.filter(([u]) => u === "/api/editor/notifications/seen").map(([, i]) => JSON.parse(String(i!.body)));
}

describe("Bell", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the unseen count, and opening marks seen up to the newest id", async () => {
    let unseen = 2;
    const fetchMock = editorBackend({
      "/notifications": () => ({ items: [ev(9, "comment_added"), ev(8, "iteration_ready", { iteration_id: null }), ev(4, "delete_done", { project_id: null })], unseen }),
      "POST /notifications/seen": () => {
        unseen = 0;
        return { ok: true };
      },
    });
    const { findByRole, getByRole, getByText } = render(<Bell role="admin" />);
    fireEvent.click(await findByRole("button", { name: "Notifications (2 unseen)" }));

    await waitFor(() => expect(getByRole("button", { name: "Notifications (0 unseen)" })).toBeTruthy());
    expect(seenBodies(fetchMock)).toEqual([{ up_to_id: 9 }]);
    expect(getByRole("link", { name: /event 9/ }).getAttribute("href")).toBe("#/p/1/t/2/v/3");
    expect(getByRole("link", { name: /event 8/ }).getAttribute("href")).toBe("#/p/1/t/2");
    // About something no longer on screen: shown, but not a link.
    expect(getByText("event 4").closest("a")).toBeNull();
  });

  it("does not mark seen when nothing is unseen, and Esc closes the panel without bubbling", async () => {
    const fetchMock = editorBackend({ "/notifications": { items: [ev(9, "comment_added")], unseen: 0 } });
    const outer = vi.fn();
    window.addEventListener("keydown", outer);
    const { findByRole, queryByRole } = render(<Bell role="admin" />);
    fireEvent.click(await findByRole("button", { name: "Notifications (0 unseen)" }));
    expect(queryByRole("link", { name: /event 9/ })).toBeTruthy();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(queryByRole("link", { name: /event 9/ })).toBeNull();
    expect(outer).not.toHaveBeenCalled();
    window.removeEventListener("keydown", outer);
    expect(seenBodies(fetchMock)).toEqual([]);
  });
});
