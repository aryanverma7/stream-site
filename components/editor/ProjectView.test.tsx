import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { ProjectView } from "./ProjectView";
import { editorBackend } from "@/lib/testUtils";

const t = (id: number, name: string, status: string, open_comments: number, created_at: number) => ({
  id, project_id: 12, name, kind: "tape", status, open_comments, created_at, latest_version: 1, has_new: false, source_project_ids: [],
});
const PROJECT = {
  project: { id: 12, name: "Ranked grind", kind: "vod" },
  tapes: [t(1, "Bravo", "cutting", 0, 10), t(2, "Alpha", "in_review", 5, 20), t(3, "Charlie", "in_review", 2, 30)],
};
const names = (container: HTMLElement) => [...container.querySelectorAll("li a")].map((a) => a.textContent);

describe("ProjectView", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sorts newest first by default, by open comments or name on request, and filters by status", async () => {
    editorBackend({ "/projects/12": PROJECT, "/deletions": { pending: [] } });
    const { findByText, getByLabelText, container } = render(<ProjectView projectId={12} role="editor" />);
    await findByText("Alpha");
    expect(names(container)).toEqual(["Charlie", "Alpha", "Bravo"]);

    fireEvent.change(getByLabelText("Sort"), { target: { value: "comments" } });
    expect(names(container)).toEqual(["Alpha", "Charlie", "Bravo"]);
    fireEvent.change(getByLabelText("Sort"), { target: { value: "name" } });
    expect(names(container)).toEqual(["Alpha", "Bravo", "Charlie"]);
    fireEvent.change(getByLabelText("Filter by status"), { target: { value: "cutting" } });
    expect(names(container)).toEqual(["Bravo"]);
  });

  it("creates a tape by name, and hides Delete project from the editor", async () => {
    const fetchMock = editorBackend({ "/projects/12": PROJECT, "/deletions": { pending: [] }, "POST /projects/12/tapes": { id: 9 } });
    const { findByLabelText, getByRole, queryByRole } = render(<ProjectView projectId={12} role="editor" />);
    fireEvent.change(await findByLabelText("New tape name"), { target: { value: "Ace clutch" } });
    fireEvent.click(getByRole("button", { name: "New tape" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => i?.method === "POST")).toBe(true));
    const post = fetchMock.mock.calls.find(([, i]) => i?.method === "POST")!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({ name: "Ace clutch" });
    expect(queryByRole("button", { name: "Delete project" })).toBeNull();
  });

  it("disables New tape while the project's delete is pending, and shows it with Undo", async () => {
    editorBackend({
      "/projects/12": PROJECT,
      "/deletions": { pending: [{ id: 4, kind: "project", target_id: 12, label: "Ranked grind", requested_by: "aryan", delete_at: Date.now() / 1000 + 1800, status: "pending" }] },
    });
    const { findByText, getByLabelText, getByRole, queryByRole } = render(<ProjectView projectId={12} role="admin" />);
    await findByText("Deleting in 30 min");
    fireEvent.change(getByLabelText("New tape name"), { target: { value: "x" } });
    expect((getByRole("button", { name: "New tape" }) as HTMLButtonElement).disabled).toBe(true);
    expect(getByRole("button", { name: "Undo" })).toBeTruthy();
    expect(queryByRole("button", { name: "Delete project" })).toBeNull();
  });
});
