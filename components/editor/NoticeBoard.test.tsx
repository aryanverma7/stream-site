import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor, within } from "@testing-library/react";
import { HomeView } from "./HomeView";
import { editorBackend } from "@/lib/testUtils";

const NOTICES = [
  { id: 2, text: "<b>GTA 6</b> is out:\nall effort goes to clips", created_by: "aryan", created_at: 1764000000, updated_at: 1764000000, seen_at: null },
  { id: 1, text: "Older", created_by: "aryan", created_at: 1763000000, updated_at: 1763000100, seen_at: 1763500000 },
];
const HOME = { vods_ready: [], deletes_to_confirm: [], open_edits: [], notices: NOTICES };
const sent = (m: ReturnType<typeof editorBackend>, method: string, path: string) =>
  m.mock.calls.filter(([u, i]) => u === `/api/editor${path}` && i?.method === method).map(([, i]) => (i?.body ? JSON.parse(String(i.body)) : null));

describe("NoticeBoard", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the editor each notice as plain text, newest first, with Got it until pressed", async () => {
    const m = editorBackend({ "/home": HOME, "POST /notices/2/seen": { ...NOTICES[0], seen_at: 1764000500 } });
    const { findAllByRole, getByRole, queryByRole, container } = render(<HomeView role="editor" username="cutter" />);
    const items = await findAllByRole("listitem");
    expect(items[0].querySelector("p")!.textContent).toBe(NOTICES[0].text);
    expect(container.querySelector("b")).toBeNull(); // text, never HTML
    expect(items[1].textContent).toMatch(/Older/);
    expect(within(items[1]).getByText("Seen")).toBeTruthy();
    expect(queryByRole("textbox", { name: "New notice" })).toBeNull();
    expect(queryByRole("button", { name: "Delete" })).toBeNull();
    fireEvent.click(getByRole("button", { name: "Got it" }));
    await waitFor(() => expect(sent(m, "POST", "/notices/2/seen")).toHaveLength(1));
  });

  it("is hidden from the editor when there are no notices", async () => {
    editorBackend({ "/home": { ...HOME, notices: [] } });
    const { findByText, queryByText } = render(<HomeView role="editor" username="cutter" />);
    await findByText("Nothing new.");
    expect(queryByText("Notices")).toBeNull();
  });

  it("lets the streamer post, change and delete, and shows when the editor saw each", async () => {
    const m = editorBackend({
      "/home": HOME,
      "POST /notices": { id: 3 },
      "PATCH /notices/1": { id: 1 },
      "DELETE /notices/2": { deleted: true },
    });
    const { findByRole, getAllByRole, getByRole, getByText } = render(<HomeView role="admin" username="aryan" />);
    fireEvent.change(await findByRole("textbox", { name: "New notice" }), { target: { value: "Clips this month" } });
    fireEvent.click(getByRole("button", { name: "Post notice" }));
    await waitFor(() => expect(sent(m, "POST", "/notices")).toEqual([{ text: "Clips this month" }]));

    expect(getByText("Not seen yet")).toBeTruthy();
    expect(getByText(/^Seen /)).toBeTruthy();

    fireEvent.click(getAllByRole("button", { name: "Change" })[1]);
    fireEvent.change(getByRole("textbox", { name: "Notice text" }), { target: { value: "Older, fixed" } });
    fireEvent.click(getByRole("button", { name: "Save" }));
    await waitFor(() => expect(sent(m, "PATCH", "/notices/1")).toEqual([{ text: "Older, fixed" }]));

    fireEvent.click(getAllByRole("button", { name: "Delete" })[0]);
    fireEvent.click(within(await findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(sent(m, "DELETE", "/notices/2")).toHaveLength(1));
  });
});
