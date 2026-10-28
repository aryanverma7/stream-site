import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { TapeView } from "./TapeView";
import { editorBackend } from "@/lib/testUtils";

const tape = (status: string, extra = {}) => ({
  id: 5, project_id: 12, name: "Jett dash", kind: "tape", status, notes: "", files_deleted_at: null, source_project_ids: [], ...extra,
});
const iteration = (id: number, version: number) => ({
  id, tape_id: 5, version, filename: `cut${version}.mp4`, size: 1, status: "ready", drive_file_id: `FILE_${id}`,
  uploaded_at: 100, created_at: 100, checks: null, has_thumbnail: false,
});

function base(status: string, extra: Record<string, unknown> = {}) {
  return editorBackend({
    "/tapes/5": { tape: tape(status), iterations: [iteration(1, 1), iteration(2, 2)] },
    "/iterations/1": { comments: [] },
    "/iterations/2": { comments: [{ resolved: true }, { resolved: false }, { resolved: true }] },
    "/iterations/2/media-link": { url: "x", access_token: "SECRET", expires_in: 3000, drive_url: "https://drive.google.com/file/d/FILE_2/view" },
    "/deletions": { pending: [] },
    "PATCH /tapes/5": (body: unknown) => tape((body as { status?: string }).status ?? status),
    ...extra,
  });
}

const statusSelect = (getAll: (role: string, o: { name: string }) => HTMLElement[]) =>
  getAll("combobox", { name: "Status" })[0] as HTMLSelectElement;

describe("TapeView", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows versions newest first with their comment summary", async () => {
    base("in_review");
    const { findByText, getAllByRole } = render(<TapeView projectId={12} tapeId={5} role="editor" username="cutter" />);
    expect(await findByText("2 of 3 resolved")).toBeTruthy();
    expect(getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual(["v2", "v1"]);
  });

  it("never offers the editor Final, Start over or the files delete", async () => {
    base("in_review");
    const { findByRole, getAllByRole, queryByRole } = render(<TapeView projectId={12} tapeId={5} role="editor" username="cutter" />);
    await findByRole("heading", { name: "Jett dash" });
    const options = [...statusSelect(getAllByRole).options].map((o) => o.value);
    expect(options).toEqual(["cutting", "in_review", "changes_asked"]);
    expect(queryByRole("button", { name: /Start over/ })).toBeNull();
  });

  it("shows the editor a Final tape as a label, with no way out of it", async () => {
    base("final");
    const { findByRole, queryByRole, queryAllByText } = render(<TapeView projectId={12} tapeId={5} role="editor" username="cutter" />);
    await findByRole("button", { name: "Download Final" });
    expect(queryByRole("combobox", { name: "Status" })).toBeNull();
    expect(queryAllByText("Final").length).toBeGreaterThan(0);
    expect(queryByRole("button", { name: "Delete files" })).toBeNull();
  });

  it("asks the streamer before marking Final, and sends it only on yes", async () => {
    const fetchMock = base("in_review");
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { findByRole, getAllByRole } = render(<TapeView projectId={12} tapeId={5} role="admin" username="aryan" />);
    await findByRole("heading", { name: "Jett dash" });

    fireEvent.change(statusSelect(getAllByRole), { target: { value: "final" } });
    expect(confirm).toHaveBeenCalledWith("Mark Jett dash Final? You'll download it, then its files are deleted.");
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === "PATCH")).toBe(false);

    fireEvent.change(statusSelect(getAllByRole), { target: { value: "final" } });
    await findByRole("button", { name: "Download Final" });
    const patch = fetchMock.mock.calls.find(([, i]) => i?.method === "PATCH")!;
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ status: "final" });
  });

  it("shows a refused status change", async () => {
    base("in_review", { "PATCH /tapes/5": { status: 403, body: { error: "Only the streamer can do this." } } });
    const { findByRole, getAllByRole } = render(<TapeView projectId={12} tapeId={5} role="editor" username="cutter" />);
    await findByRole("heading", { name: "Jett dash" });
    fireEvent.change(statusSelect(getAllByRole), { target: { value: "cutting" } });
    expect((await findByRole("alert")).textContent).toBe("Only the streamer can do this.");
  });

  it("downloads the Final from Google's direct link for the latest version, with Drive beside it", async () => {
    base("final");
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, assign });
    const { findByRole } = render(<TapeView projectId={12} tapeId={5} role="admin" username="aryan" />);
    fireEvent.click(await findByRole("button", { name: "Download Final" }));
    expect(assign).toHaveBeenCalledWith("https://drive.usercontent.google.com/download?id=FILE_2&export=download");
    expect((await findByRole("link", { name: /Open in Drive/ })).getAttribute("target")).toBe("_blank");
    expect(document.body.innerHTML).not.toContain("SECRET");
  });

  it("lets the streamer start over on the latest version after a confirm", async () => {
    const fetchMock = base("changes_asked", { "POST /iterations/2/start-over": { resolved: 1 } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { findByRole } = render(<TapeView projectId={12} tapeId={5} role="admin" username="aryan" />);
    fireEvent.click(await findByRole("button", { name: "Start over on v2" }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([u, i]) => u === "/api/editor/iterations/2/start-over" && i?.method === "POST")).toBe(true),
    );
  });

  it("saves notes on blur", async () => {
    const fetchMock = base("cutting", { "PATCH /tapes/5": (b: unknown) => tape("cutting", b as object) });
    const { findByLabelText } = render(<TapeView projectId={12} tapeId={5} role="editor" username="cutter" />);
    const notes = await findByLabelText("Notes");
    fireEvent.change(notes, { target: { value: "Trim the intro" } });
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === "PATCH")).toBe(false);
    fireEvent.blur(notes);
    await waitFor(() => expect((notes as HTMLTextAreaElement).value).toBe("Trim the intro"));
    const patch = fetchMock.mock.calls.find(([, i]) => i?.method === "PATCH")!;
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ notes: "Trim the intro" });
  });

  it("shows a pending files delete with Undo, and Undo brings the Final block back", async () => {
    let pending = [{ id: 3, kind: "tape_files", target_id: 5, label: "Jett dash", requested_by: "aryan", delete_at: 1, remaining_seconds: 3600, status: "pending" }];
    let itStatus = "deleting";
    base("final", {
      "/tapes/5": () => ({ tape: tape("final"), iterations: [{ ...iteration(1, 1), status: itStatus }, { ...iteration(2, 2), status: itStatus }] }),
      "/deletions": () => ({ pending }),
      "POST /deletions/3/undo": () => {
        pending = [];
        itStatus = "ready";
        return { request_id: 3, status: "cancelled" };
      },
    });
    const { findByText, findByRole, getByRole, queryByRole } = render(<TapeView projectId={12} tapeId={5} role="admin" username="aryan" />);
    expect(await findByText("Deleting in 60 min")).toBeTruthy();
    // Every version is "deleting", so there is no Final to download meanwhile.
    expect(queryByRole("button", { name: "Download Final" })).toBeNull();
    expect(queryByRole("button", { name: "Delete files" })).toBeNull();

    fireEvent.click(getByRole("button", { name: "Undo" }));
    expect(await findByRole("button", { name: "Download Final" })).toBeTruthy();
    expect(queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("disables the Final download while the project's delete is pending", async () => {
    base("final", {
      "/deletions": { pending: [{ id: 4, kind: "project", target_id: 12, label: "Ranked", requested_by: "aryan", delete_at: 1, remaining_seconds: 300, status: "pending" }] },
    });
    const { findByText, getByRole } = render(<TapeView projectId={12} tapeId={5} role="admin" username="aryan" />);
    await findByText("Deleting in 5 min");
    expect((getByRole("button", { name: "Download Final" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
