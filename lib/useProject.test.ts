import { describe, expect, it, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useProject } from "./useProject";
import { editorBackend } from "./testUtils";

describe("useProject", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads the project and its edits, and refreshes on demand", async () => {
    const fetchMock = editorBackend({ "/projects/12": { project: { id: 12, name: "Ranked" }, edits: [{ id: 5 }] } });
    const { result } = renderHook(() => useProject(12));

    await waitFor(() => expect(result.current.project?.name).toBe("Ranked"));
    expect(result.current.edits).toEqual([{ id: 5 }]);
    await act(() => result.current.refresh());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports a failure", async () => {
    editorBackend({});
    const { result } = renderHook(() => useProject(12));
    await waitFor(() => expect(result.current.error).toBe("Not found"));
  });
});
