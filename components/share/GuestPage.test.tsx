import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GuestPage, tokenFromHash } from "./GuestPage";

const TOKEN = "tok_" + "a".repeat(40);
const VIEW = { title: "Clutch v2", file_id: "FILE1", api_key: "PUBKEY", expires_at: 2_000_000_000, duration_s: 90, codec: "avc1", playable: true };
let calls: [string, RequestInit | undefined][] = [];
let answer: (path: string, body: Record<string, unknown>) => { status: number; body: unknown };

beforeEach(() => {
  localStorage.clear();
  calls = [];
  answer = (path) => (path === "/api/share/view" ? { status: 200, body: VIEW } : { status: 201, body: { id: 1 } });
  window.location.hash = "#" + TOKEN;
  global.fetch = vi.fn(async (path: string, init?: RequestInit) => {
    calls.push([path, init]);
    const a = answer(path, JSON.parse(String(init?.body ?? "{}")));
    return { ok: a.status < 300, status: a.status, json: async () => a.body };
  }) as unknown as typeof fetch;
});
afterEach(() => vi.restoreAllMocks());

const bodies = (path: string) => calls.filter(([p]) => p === path).map(([, i]) => JSON.parse(String(i?.body)));

describe("GuestPage", () => {
  it("sends the token only in a request body and plays the file from Google with the public key", async () => {
    render(<GuestPage />);
    await screen.findByText("Clutch v2");
    expect(bodies("/api/share/view")).toEqual([{ token: TOKEN }]);
    expect(calls.every(([p]) => !p.includes(TOKEN))).toBe(true);
    expect(document.querySelector("video")?.getAttribute("src")).toBe("https://www.googleapis.com/drive/v3/files/FILE1?alt=media&key=PUBKEY");
    expect(JSON.stringify({ ...localStorage })).not.toContain(TOKEN);
  });

  it("says the link expired on a 404, or with no token at all", async () => {
    answer = () => ({ status: 404, body: { error: "This link has expired or was revoked." } });
    const { unmount } = render(<GuestPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This link has expired. Ask DualBladeX for a new one.");
    unmount();
    window.location.hash = "";
    render(<GuestPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("expired");
  });

  it("posts a note with a client id and shows it under Your notes; the name is remembered", async () => {
    render(<GuestPage />);
    await screen.findByText("Clutch v2");
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Rahul" } });
    fireEvent.click(screen.getByRole("radio", { name: "Question" }));
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "why here?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send note" }));
    await waitFor(() => expect(bodies("/api/share/notes")).toHaveLength(1));
    const sent = bodies("/api/share/notes")[0];
    expect(sent).toMatchObject({ token: TOKEN, name: "Rahul", kind: "question", body: "why here?", start_s: 0 });
    expect(sent.client_id).toMatch(/^[a-f0-9]{32}$/);
    expect(await screen.findByText("why here?")).toBeInTheDocument();
    expect(localStorage.getItem("share.name")).toBe('"Rahul"');
  });

  it("keeps a note that could not be sent and resends it with the same id when back online", async () => {
    let down = true;
    answer = (path) => (path === "/api/share/view" ? { status: 200, body: VIEW } : down ? { status: 502, body: {} } : { status: 201, body: { id: 1 } });
    render(<GuestPage />);
    await screen.findByText("Clutch v2");
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Rahul" } });
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "later" } });
    fireEvent.click(screen.getByRole("button", { name: "Send note" }));
    expect(await screen.findByText("Not sent yet")).toBeInTheDocument();
    down = false;
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(screen.queryByText("Not sent yet")).toBeNull());
    const ids = bodies("/api/share/notes").map((b) => b.client_id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it("reads the token from the fragment", () => {
    expect(tokenFromHash("#abc%2Ddef")).toBe("abc-def");
  });
});
