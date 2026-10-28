import { describe, expect, it, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { FixListView } from "./FixListView";
import { editorBackend } from "@/lib/testUtils";

const item = (id: number, tape_id: number, comment = {}) => ({
  comment: { id, kind: "fix", body: `body ${id}`, start_s: 222.5, carried: false, origin_version: 3, created_at: id, ...comment },
  tape_id, tape_name: `Tape ${tape_id}`, project_id: 1, iteration_id: 30 + tape_id, version: 3,
});

describe("FixListView", () => {
  afterEach(() => vi.restoreAllMocks());

  it("groups by tape in order, links to the version with the start appended, and shows carried origins", async () => {
    editorBackend({
      "/fix-list": {
        items: [item(1, 2), item(2, 4, { start_s: null, kind: "question" }), item(3, 2, { carried: true, origin_version: 1, start_s: 3725 })],
      },
    });
    const { findAllByRole, getAllByRole, getByText } = render(<FixListView />);
    const headings = await findAllByRole("heading", { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(["Tape 2", "Tape 4"]);

    const links = getAllByRole("link").filter((a) => a.getAttribute("href")!.includes("/v/"));
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["v3 · 03:42 · Fix: body 1", "#/p/1/t/2/v/32@222.5"],
      ["v3 · 1:02:05 · Fix: body 3", "#/p/1/t/2/v/32@3725"],
      ["v3 · Question: body 2", "#/p/1/t/4/v/34"],
    ]);
    expect(getByText("from v1 at 1:02:05")).toBeTruthy();
  });
});
