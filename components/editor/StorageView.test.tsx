import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor, within } from "@testing-library/react";
import { StorageView } from "./StorageView";
import { editorBackend } from "@/lib/testUtils";

const STORAGE = (paused: number | null = null) => ({
  quota: { limit: 15e9, usage: 6e9, free: 9e9 },
  files: [
    { kind: "vod", label: "Ranked — VOD", size: 4e9, project_id: 12, tape_id: null, status: "ready", project_name: "Ranked", vod_filename: "ranked.mp4", tape_name: null },
    { kind: "iteration", label: "Jett dash v1", size: 5e8, project_id: 12, tape_id: 5, status: "ready", project_name: "Ranked", vod_filename: null, tape_name: "Jett dash" },
    { kind: "iteration", label: "Jett dash v2", size: 6e8, project_id: 12, tape_id: 5, status: "ready", project_name: "Ranked", vod_filename: null, tape_name: "Jett dash" },
  ],
  pending_deletes: [],
  scheduler: { sane: paused === null, last_seen: 100, paused_since: paused },
  discord: { enabled: true, pending: 2, sending: 0, dropped: 0, last_error: "Discord said 403", last_sent_at: null },
});

function base(extra: Record<string, unknown> = {}) {
  return editorBackend({
    "/storage": STORAGE(),
    "/drive/status": { connected: true, layout: true },
    "/deletions": { pending: [] },
    ...extra,
  });
}

describe("StorageView", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows quota, files, Drive state and the Discord error", async () => {
    base();
    const { findByText, getByText } = render(<StorageView username="aryan" />);
    expect(await findByText("Last error: Discord said 403")).toBeTruthy();
    expect(getByText("6.0 GB used of 15.0 GB · 9.0 GB free")).toBeTruthy();
    expect(getByText("Connected")).toBeTruthy();
    expect(getByText("v1 500.0 MB · v2 600.0 MB")).toBeTruthy();
  });

  it("asks before trusting the clock again, and sends it only on yes", async () => {
    let paused: number | null = 1_700_000_000;
    const fetchMock = base({
      "/storage": () => STORAGE(paused),
      "POST /scheduler/reset-clock": () => {
        paused = null;
        return { sane: true };
      },
    });
    const { findByRole, queryByRole, getByRole } = render(<StorageView username="aryan" />);
    const button = await findByRole("button", { name: "Trust the clock again" });
    const resets = () => fetchMock.mock.calls.filter(([u]) => u === "/api/editor/scheduler/reset-clock").length;

    fireEvent.click(button);
    expect((await findByRole("alertdialog", { name: "Trust the clock again?" })).textContent).toMatch("at most an hour from now");
    fireEvent.click(getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(queryByRole("alertdialog")).toBeNull());
    expect(resets()).toBe(0);
    fireEvent.click(button);
    fireEvent.click(await findByRole("button", { name: "Trust the clock" }));
    await waitFor(() => expect(queryByRole("button", { name: "Trust the clock again" })).toBeNull());
    expect(resets()).toBe(1);
  });

  it("opens DeleteDialog for project, VOD and tape files with the names the server confirms against", async () => {
    const fetchMock = base({ "POST /deletions": { request_id: 1 } });
    const { findByRole, getByRole, getByLabelText } = render(<StorageView username="aryan" />);
    const tryDelete = async (button: string, name: string) => {
      fireEvent.click(getByRole("button", { name: button }));
      fireEvent.change(getByLabelText("Type the name to confirm"), { target: { value: name } });
      fireEvent.click(within(getByRole("dialog")).getByRole("button", { name: "Delete in an hour" }));
      await waitFor(() => expect(() => getByRole("dialog")).toThrow());
    };
    await findByRole("button", { name: "Delete project" });
    await tryDelete("Delete project", "Ranked");
    await tryDelete("Delete VOD", "ranked.mp4");
    await tryDelete("Delete files", "Jett dash");
    const bodies = fetchMock.mock.calls.filter(([u, i]) => u === "/api/editor/deletions" && i?.method === "POST").map(([, i]) => JSON.parse(String(i!.body)));
    expect(bodies).toEqual([
      { kind: "project", target_id: 12, confirm: "Ranked" },
      { kind: "vod", target_id: 12, confirm: "ranked.mp4" },
      { kind: "tape_files", target_id: 5, confirm: "Jett dash" },
    ]);
  });

  it("lists pending deletes with their countdown and Undo in place of the Delete button", async () => {
    base({ "/deletions": { pending: [{ id: 3, kind: "tape_files", target_id: 5, label: "Jett dash", requested_by: "aryan", delete_at: 1, remaining_seconds: 600, status: "pending" }] } });
    const { findAllByText, getAllByRole, queryByRole } = render(<StorageView username="aryan" />);
    expect(await findAllByText("Deleting in 10 min")).toHaveLength(2);
    expect(getAllByRole("button", { name: "Undo" })).toHaveLength(2);
    expect(queryByRole("button", { name: "Delete files" })).toBeNull();
  });

  it("keeps the clock reset and the Discord block while Drive is down", async () => {
    const fetchMock = base({
      "/storage": { ...STORAGE(1_700_000_000), quota: null, files: null, drive_error: "Google Drive isn't connected - connect it from the dashboard." },
      "/drive/status": { connected: false, layout: false },
    });
    const { findByText, getByRole, getByText, queryByText } = render(<StorageView username="aryan" />);
    expect(await findByText("Google Drive isn't connected - connect it from the dashboard.")).toBeTruthy();
    expect(getByRole("button", { name: "Trust the clock again" })).toBeTruthy();
    expect(getByText("Last error: Discord said 403")).toBeTruthy();
    expect(getByText("Not connected")).toBeTruthy();
    expect(queryByText("App files")).toBeNull();
    expect(fetchMock.mock.calls.some(([u]) => u === "/api/editor/projects")).toBe(false);
  });

  it("still shows the Drive state when /storage fails", async () => {
    base({ "/storage": { status: 503, body: { error: "Google Drive is not connected" } }, "/drive/status": { connected: false, layout: false } });
    const { findByRole, getByText } = render(<StorageView username="aryan" />);
    expect((await findByRole("alert")).textContent).toBe("Google Drive is not connected");
    expect(getByText("Not connected")).toBeTruthy();
  });
});
