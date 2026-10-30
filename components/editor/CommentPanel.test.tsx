import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Comment, CommentsApi } from "@/lib/useComments";
import { CommentPanel } from "./CommentPanel";

const c = (over: Partial<Comment>): Comment => ({
  id: 1, kind: "fix", author: "streamer", body: "b", start_s: 10, end_s: null, created_at: 100, updated_at: 100,
  resolved: false, carried: false, origin_iteration_id: 7, origin_version: 3, replies: [], ...over,
});
const api = (comments: Comment[], over: Partial<CommentsApi> = {}): CommentsApi =>
  ({
    role: "admin", comments, unsent: [], legacy: [], failed: [], error: null, dismissFailed: vi.fn(), sendLegacyAsMe: vi.fn(), discardLegacy: vi.fn(),
    isNew: (i: { author: string; created_at: number }) => i.author !== "me" && i.created_at > 150,
    add: vi.fn(), reply: vi.fn(), edit: vi.fn(), setResolved: vi.fn(), reload: vi.fn(), ...over,
  }) as unknown as CommentsApi;
const panel = (cm: CommentsApi, t = 0, onSeek = vi.fn()) =>
  render(<CommentPanel cm={cm} username="me" projectId={1} tapeId={2} currentTime={t} onSeek={onSeek} />);
const ids = () => [...document.querySelectorAll("[data-comment]")].map((e) => e.getAttribute("data-comment"));

describe("CommentPanel", () => {
  const set = [
    c({ id: 1, body: "carried", carried: true, origin_iteration_id: 7, origin_version: 1, start_s: 222 }),
    c({ id: 2, body: "general", start_s: null }),
    c({ id: 3, body: "late", start_s: 50 }),
    c({ id: 4, body: "early", start_s: 5, resolved: true }),
  ];

  it("orders timed, general, carried; tabs filter; header counts", () => {
    panel(api(set));
    fireEvent.click(screen.getByRole("tab", { name: "All" }));
    expect(ids()).toEqual(["4", "3", "2", "1"]);
    expect(screen.getByText("1 of 4 resolved")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Resolved" }));
    expect(ids()).toEqual(["4"]);
    fireEvent.click(screen.getByRole("tab", { name: "Open" }));
    expect(ids()).toEqual(["3", "2", "1"]);
  });

  it("highlights the item under the playhead and seeks on click", () => {
    const onSeek = vi.fn();
    const { rerender } = panel(api(set), 51, onSeek);
    expect(document.querySelector('[data-comment="3"]')).toHaveAttribute("aria-current", "true");
    rerender(<CommentPanel cm={api(set)} username="me" projectId={1} tapeId={2} currentTime={60} onSeek={onSeek} />);
    expect(document.querySelector("[aria-current]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Go to 0:50" }));
    expect(onSeek).toHaveBeenCalledWith(50);
  });

  it("carried item links to its origin, never seeks, is never highlighted", () => {
    const onSeek = vi.fn();
    panel(api(set), 222, onSeek);
    const link = screen.getByRole("link", { name: "from v1 at 3:42" });
    expect(link).toHaveAttribute("href", "#/p/1/t/2/v/7@222");
    expect(document.querySelector('[data-comment="1"]')).not.toHaveAttribute("aria-current");
    expect(within(document.querySelector('[data-comment="1"]') as HTMLElement).queryByRole("button", { name: /Go to/ })).toBeNull();
    // no time chip of its own: the 3:42 belongs to v1 and only the link says it
    expect(within(document.querySelector('[data-comment="1"]') as HTMLElement).getAllByText(/3:42/)).toHaveLength(1);
  });

  it("a failed edit keeps the editor open with the typed text; a good one closes it", async () => {
    const edit = vi.fn(async () => false);
    panel(api([c({ id: 9, author: "me", body: "old" })], { edit }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit comment"), { target: { value: "new words" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(edit).toHaveBeenCalledWith(9, { body: "new words" }));
    expect(screen.getByLabelText("Edit comment")).toHaveValue("new words");
    edit.mockResolvedValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByLabelText("Edit comment")).toBeNull());
  });

  it("editor gets no resolve checkbox; admin does", () => {
    const { unmount } = panel(api(set, { role: "editor" }));
    expect(screen.queryByRole("checkbox")).toBeNull();
    unmount();
    panel(api(set));
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
  });

  it("New shows on other people's comments and replies after the cutoff only", () => {
    panel(
      api([
        c({ id: 1, author: "streamer", created_at: 200, replies: [{ id: 5, comment_id: 1, author: "streamer", body: "r", created_at: 120 }] }),
        c({ id: 2, author: "me", created_at: 200, start_s: 20 }),
        c({ id: 3, author: "streamer", created_at: 100, start_s: 30 }),
      ]),
    );
    expect(screen.getAllByText("New")).toHaveLength(1);
  });

  it("shows unsent comments as Not sent yet", () => {
    panel(api([], { unsent: [{ client_id: "z", kind: "comment", iterationId: 7, payload: { body: "queued" }, created_at: 1 }] }));
    expect(screen.getByText("Not sent yet")).toBeInTheDocument();
    expect(screen.getByText("queued")).toBeInTheDocument();
  });

  it("shows entries from before an update with Send as me and Discard, as plain text", () => {
    const sendLegacyAsMe = vi.fn();
    const discardLegacy = vi.fn();
    const legacy = [{ client_id: "z", kind: "comment", iterationId: 7, payload: { body: "<b>old</b>" }, created_at: 1 }];
    panel(api([], { legacy, sendLegacyAsMe, discardLegacy } as unknown as Partial<CommentsApi>));
    const box = screen.getByRole("region", { name: "Unsent from before an update" });
    expect(within(box).getByText("<b>old</b>")).toBeInTheDocument();
    expect(box.querySelector("b")).toBeNull();
    fireEvent.click(within(box).getByRole("button", { name: "Send as me" }));
    expect(sendLegacyAsMe).toHaveBeenCalledWith("z");
    fireEvent.click(within(box).getByRole("button", { name: "Discard" }));
    expect(discardLegacy).toHaveBeenCalledWith("z");
  });
});
