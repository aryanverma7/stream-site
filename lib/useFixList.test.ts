import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useFixList } from "./useFixList";
import { editorBackend } from "./testUtils";

const item = (id: number, tape_id: number) => ({
  comment: { id, kind: "fix", body: `c${id}`, start_s: null, carried: false, origin_version: 1, created_at: id },
  tape_id, tape_name: `T${tape_id}`, project_id: 1, iteration_id: 10 + tape_id, version: 1,
});

describe("useFixList", () => {
  afterEach(() => vi.restoreAllMocks());

  it("groups by tape in first-appearance order, keeping the server's order inside each", async () => {
    editorBackend({ "/fix-list": { items: [item(1, 5), item(2, 6), item(3, 5)] } });
    const { result } = renderHook(() => useFixList());
    await waitFor(() => expect(result.current.groups).toHaveLength(2));
    expect(result.current.groups.map((g) => g.map((i) => i.comment.id))).toEqual([[1, 3], [2]]);
  });
});
