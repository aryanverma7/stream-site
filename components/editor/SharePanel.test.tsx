import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { editorBackend } from "@/lib/testUtils";
import { GuestNotesPanel, SharePanel, left } from "./SharePanel";

const LINK = { id: 4, iteration_id: 7, tape_id: 2, project_id: 1, tape: "Clutch", version: 3, expires_at: Date.now() / 1000 + 4320 };

describe("SharePanel", () => {
  it("defaults to 2 hours, shows the new link once, and lists this version's live links with Revoke", async () => {
    let made: unknown;
    const api = editorBackend({
      "POST /iterations/7/share": (b: unknown) => ((made = b), { url: "https://hub/s#TOKEN", expires_at: 2_000_000_000 }),
      "/share-links": { links: [LINK, { ...LINK, id: 5, iteration_id: 8 }] },
      "POST /share-links/4/revoke": { revoked: true },
    });
    const { container } = render(<SharePanel iterationId={7} version={3} />);
    expect(screen.getByLabelText(/Expires after/)).toHaveValue("2");
    fireEvent.click(screen.getByRole("button", { name: "Make link" }));
    expect(await screen.findByLabelText("Share link")).toHaveValue("https://hub/s#TOKEN");
    expect(made).toEqual({ hours: 2 });
    expect(await screen.findAllByRole("button", { name: "Revoke" })).toHaveLength(1);
    const details = container.querySelector("details")!;
    details.open = false;
    fireEvent(details, new Event("toggle"));
    expect(screen.queryByLabelText("Share link")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(api.mock.calls.some(([u, i]) => u === "/api/editor/share-links/4/revoke" && i?.method === "POST")).toBe(true));
  });

  it("formats the time left", () => {
    expect(left(10 + 72 * 60, 10)).toBe("1 h 12 m");
    expect(left(10 + 5 * 60, 10)).toBe("5 m");
    expect(left(10 + 3 * 1440 * 60 + 120 * 60, 10)).toBe("3 d 2 h");
  });
});

describe("GuestNotesPanel", () => {
  const notes = {
    guests: [
      { name: "Rahul", notes: [{ id: 1, name: "Rahul", kind: "fix", start_s: 4, end_s: null, body: "slow", created_at: 1 }, { id: 2, name: "Rahul", kind: "keep", start_s: null, end_s: null, body: "nice", created_at: 2 }] },
      { name: "Priya", notes: [{ id: 3, name: "Priya", kind: "question", start_s: 9, end_s: 12, body: "why", created_at: 3 }] },
    ],
  };

  it("renders nothing when nobody left a note", async () => {
    const api = editorBackend({ "/iterations/7/guest-notes": { guests: [] } });
    const { container } = render(<GuestNotesPanel iterationId={7} onApproved={() => {}} />);
    await waitFor(() => expect(api).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("approves everything from one guest, seeks on a time, and tells the player to reload comments", async () => {
    let sent: unknown;
    editorBackend({ "/iterations/7/guest-notes": notes, "POST /guest-notes/approve": (b: unknown) => ((sent = b), { approved: 2 }) });
    const onApproved = vi.fn();
    const onSeek = vi.fn();
    render(<GuestNotesPanel iterationId={7} onSeek={onSeek} onApproved={onApproved} />);
    expect(await screen.findByText("Guest notes (3)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "0:04" }));
    expect(onSeek).toHaveBeenCalledWith(4);
    fireEvent.click(screen.getByLabelText("Select all from Rahul"));
    fireEvent.click(screen.getByRole("button", { name: "Approve selected" }));
    await waitFor(() => expect(onApproved).toHaveBeenCalled());
    expect(sent).toEqual({ ids: [1, 2] });
  });
});
