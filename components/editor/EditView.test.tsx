import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { EditView } from "./EditView";
import { editorBackend } from "@/lib/testUtils";

const edit = (status: string, extra = {}) => ({
  id: 5, project_id: 12, name: "Jett dash", kind: "edit", status, notes: "", files_deleted_at: null, source_project_ids: [], ...extra,
});
const iteration = (id: number, version: number) => ({
  id, edit_id: 5, version, filename: `cut${version}.mp4`, size: 1, status: "ready", drive_file_id: `FILE_${id}`,
  uploaded_at: 100, created_at: 100, checks: null, has_thumbnail: false,
});

function base(status: string, extra: Record<string, unknown> = {}) {
  return editorBackend({
    "/edits/5": { edit: edit(status), iterations: [iteration(1, 1), iteration(2, 2)] },
    "/iterations/1": { comments: [] },
    "/iterations/2": { comments: [{ resolved: true }, { resolved: false }, { resolved: true }] },
    "/deletions": { pending: [] },
    "PATCH /edits/5": (body: unknown) => edit((body as { status?: string }).status ?? status),
    ...extra,
  });
}

const statusSelect = (getAll: (role: string, o: { name: string }) => HTMLElement[]) =>
  getAll("combobox", { name: "Status" })[0] as HTMLSelectElement;

describe("EditView", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows versions newest first with their comment summary", async () => {
    base("in_review");
    const { findByText, getAllByRole } = render(<EditView projectId={12} editId={5} role="editor" username="cutter" />);
    expect(await findByText("2 of 3 resolved")).toBeTruthy();
    expect(getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual(["v2", "v1"]);
  });

  it("never offers the editor Final, Start over or the files delete", async () => {
    base("in_review");
    const { findByRole, getAllByRole, queryByRole } = render(<EditView projectId={12} editId={5} role="editor" username="cutter" />);
    await findByRole("heading", { name: "Jett dash" });
    const options = [...statusSelect(getAllByRole).options].map((o) => o.value);
    expect(options).toEqual(["cutting", "in_review", "changes_asked"]);
    expect(queryByRole("button", { name: /Start over/ })).toBeNull();
  });

  it("shows the editor a Final edit as a label, with no way out of it", async () => {
    base("final");
    const { findByRole, queryByRole, queryAllByText } = render(<EditView projectId={12} editId={5} role="editor" username="cutter" />);
    await findByRole("link", { name: "Download Final" });
    expect(queryByRole("combobox", { name: "Status" })).toBeNull();
    expect(queryAllByText("Final").length).toBeGreaterThan(0);
    expect(queryByRole("button", { name: "Delete files" })).toBeNull();
  });

  it("gives only the streamer the quota switch, and sends quota_exempt", async () => {
    base("final");
    const editorView = render(<EditView projectId={12} editId={5} role="editor" username="cutter" />);
    await editorView.findByRole("heading", { name: "Jett dash" });
    expect(editorView.queryByRole("checkbox", { name: /weekly quota/ })).toBeNull();
    editorView.unmount();

    const fetchMock = base("final", { "PATCH /edits/5": (body: unknown) => edit("final", { quota_exempt: (body as { quota_exempt: boolean }).quota_exempt ? 1 : 0 }) });
    const { findByRole } = render(<EditView projectId={12} editId={5} role="admin" username="aryan" />);
    const box = (await findByRole("checkbox", { name: /weekly quota/ })) as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    await waitFor(() => expect(box.checked).toBe(false));
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ quota_exempt: true });
  });

  it("asks the streamer before marking Final, and sends it only on yes", async () => {
    const fetchMock = base("in_review");
    const { findByRole, getAllByRole, getByRole, queryByRole } = render(<EditView projectId={12} editId={5} role="admin" username="aryan" />);
    await findByRole("heading", { name: "Jett dash" });

    fireEvent.change(statusSelect(getAllByRole), { target: { value: "final" } });
    const dialog = await findByRole("alertdialog", { name: "Mark Jett dash Final?" });
    expect(dialog.textContent).toMatch("You'll download it, then its files are deleted.");
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(queryByRole("alertdialog")).toBeNull());
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === "PATCH")).toBe(false);

    fireEvent.change(statusSelect(getAllByRole), { target: { value: "final" } });
    fireEvent.click(await findByRole("button", { name: "Mark Final" }));
    expect(getByRole("heading", { name: "Jett dash" })).toBeTruthy();
    await findByRole("link", { name: "Download Final" });
    const patch = fetchMock.mock.calls.find(([, i]) => i?.method === "PATCH")!;
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ status: "final" });
  });

  it("shows a refused status change", async () => {
    base("in_review", { "PATCH /edits/5": { status: 403, body: { error: "Only the streamer can do this." } } });
    const { findByRole, getAllByRole } = render(<EditView projectId={12} editId={5} role="editor" username="cutter" />);
    await findByRole("heading", { name: "Jett dash" });
    fireEvent.change(statusSelect(getAllByRole), { target: { value: "cutting" } });
    expect((await findByRole("alert")).textContent).toBe("Only the streamer can do this.");
  });

  it("downloads the Final from a new-tab link for the latest version, with Drive beside it, and no media-link", async () => {
    const fetchMock = base("final");
    const { findByRole, getByRole } = render(<EditView projectId={12} editId={5} role="admin" username="aryan" />);
    const link = await findByRole("link", { name: "Download Final" });
    expect(link.getAttribute("href")).toBe("https://drive.usercontent.google.com/download?id=FILE_2&export=download");
    expect([link.getAttribute("target"), link.getAttribute("rel")]).toEqual(["_blank", "noopener noreferrer"]);
    const drive = getByRole("link", { name: /Open in Drive/ });
    expect(drive.getAttribute("href")).toBe("https://drive.google.com/file/d/FILE_2/view");
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("media-link"))).toBe(false);
  });

  it("lets the streamer start over on the latest version after a confirm", async () => {
    const fetchMock = base("changes_asked", { "POST /iterations/2/start-over": { resolved: 1 } });
    const { findByRole } = render(<EditView projectId={12} editId={5} role="admin" username="aryan" />);
    fireEvent.click(await findByRole("button", { name: "Start over on v2" }));
    expect(fetchMock.mock.calls.some(([u]) => u === "/api/editor/iterations/2/start-over")).toBe(false);
    fireEvent.click(await findByRole("button", { name: "Start over" }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([u, i]) => u === "/api/editor/iterations/2/start-over" && i?.method === "POST")).toBe(true),
    );
  });

  it("saves notes on blur", async () => {
    const fetchMock = base("cutting", { "PATCH /edits/5": (b: unknown) => edit("cutting", b as object) });
    const { findByLabelText } = render(<EditView projectId={12} editId={5} role="editor" username="cutter" />);
    const notes = await findByLabelText("Notes");
    fireEvent.change(notes, { target: { value: "Trim the intro" } });
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === "PATCH")).toBe(false);
    fireEvent.blur(notes);
    await waitFor(() => expect((notes as HTMLTextAreaElement).value).toBe("Trim the intro"));
    const patch = fetchMock.mock.calls.find(([, i]) => i?.method === "PATCH")!;
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ notes: "Trim the intro" });
  });

  it("saves a second after typing stops (injected clock) and once more only if changed on blur", async () => {
    const fetchMock = base("cutting", { "PATCH /edits/5": (b: unknown) => edit("cutting", b as object) });
    const timers: { fn: () => void; live: boolean }[] = [];
    const delay = (fn: () => void) => {
      const t = { fn, live: true };
      timers.push(t);
      return () => void (t.live = false);
    };
    const fire = () => timers.filter((t) => t.live).forEach((t) => ((t.live = false), t.fn()));
    const patches = () => fetchMock.mock.calls.filter(([, i]) => i?.method === "PATCH").map(([, i]) => JSON.parse(String(i!.body)));
    const { findByLabelText } = render(<EditView projectId={12} editId={5} role="editor" username="cutter" delay={delay} />);
    const notes = await findByLabelText("Notes");
    fireEvent.change(notes, { target: { value: "Trim" } });
    fireEvent.change(notes, { target: { value: "Trim the intro" } });
    expect(patches()).toEqual([]);
    fire();
    await waitFor(() => expect(patches()).toEqual([{ notes: "Trim the intro" }]));
    fireEvent.blur(notes);
    await new Promise((r) => setTimeout(r, 0));
    expect(patches()).toHaveLength(1);
  });

  it("saves an edited name when the edit is left mid-edit", async () => {
    const fetchMock = base("cutting", { "PATCH /edits/5": (b: unknown) => edit("cutting", b as object) });
    const { findByLabelText, unmount } = render(<EditView projectId={12} editId={5} role="editor" username="cutter" delay={() => () => {}} />);
    fireEvent.change(await findByLabelText("Name"), { target: { value: "Jett dash v2 " } });
    unmount();
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => i?.method === "PATCH")).toBe(true));
    const patch = fetchMock.mock.calls.find(([, i]) => i?.method === "PATCH")!;
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ name: "Jett dash v2" });
  });

  it("shows a pending files delete with Undo, and Undo brings the Final block back", async () => {
    let pending = [{ id: 3, kind: "edit_files", target_id: 5, label: "Jett dash", requested_by: "aryan", delete_at: 1, remaining_seconds: 3600, status: "pending" }];
    let itStatus = "deleting";
    base("final", {
      "/edits/5": () => ({ edit: edit("final"), iterations: [{ ...iteration(1, 1), status: itStatus }, { ...iteration(2, 2), status: itStatus }] }),
      "/deletions": () => ({ pending }),
      "POST /deletions/3/undo": () => {
        pending = [];
        itStatus = "ready";
        return { request_id: 3, status: "cancelled" };
      },
    });
    const { findByText, findByRole, getByRole, queryByRole } = render(<EditView projectId={12} editId={5} role="admin" username="aryan" />);
    expect(await findByText("Deleting in 60 min")).toBeTruthy();
    // Every version is "deleting", so there is no Final to download meanwhile.
    expect(queryByRole("button", { name: "Download Final" })).toBeNull();
    expect(queryByRole("link", { name: "Download Final" })).toBeNull();
    expect(queryByRole("button", { name: "Delete files" })).toBeNull();

    fireEvent.click(getByRole("button", { name: "Undo" }));
    expect(await findByRole("link", { name: "Download Final" })).toBeTruthy();
    expect(queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("disables the Final download while the project's delete is pending", async () => {
    base("final", {
      "/deletions": { pending: [{ id: 4, kind: "project", target_id: 12, label: "Ranked", requested_by: "aryan", delete_at: 1, remaining_seconds: 300, status: "pending" }] },
    });
    const { findByText, getByRole } = render(<EditView projectId={12} editId={5} role="admin" username="aryan" />);
    await findByText("Deleting in 5 min");
    expect((getByRole("button", { name: "Download Final" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
