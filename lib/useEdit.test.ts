import { describe, expect, it, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useEdit } from "./useEdit";
import { editorBackend } from "./testUtils";

describe("useEdit", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads the edit and its versions, and keeps the server's answer to a PATCH", async () => {
    const fetchMock = editorBackend({
      "/edits/5": { edit: { id: 5, name: "Main", status: "cutting" }, iterations: [{ id: 3, version: 1 }] },
      "PATCH /edits/5": (body: unknown) => ({ id: 5, name: "Main", status: (body as { status: string }).status }),
    });
    const { result } = renderHook(() => useEdit(5));
    await waitFor(() => expect(result.current.edit?.name).toBe("Main"));
    expect(result.current.iterations).toHaveLength(1);

    await act(() => result.current.update({ status: "in_review" }));
    expect(result.current.edit?.status).toBe("in_review");
    const [, init] = fetchMock.mock.calls[1];
    expect(init).toMatchObject({ method: "PATCH", body: '{"status":"in_review"}' });
  });

  it("throws a refused PATCH so the view can show it", async () => {
    editorBackend({
      "/edits/5": { edit: { id: 5, status: "final" }, iterations: [] },
      "PATCH /edits/5": { status: 403, body: { error: "Only the streamer can do this." } },
    });
    const { result } = renderHook(() => useEdit(5));
    await waitFor(() => expect(result.current.edit).not.toBeNull());
    await expect(result.current.update({ status: "cutting" })).rejects.toThrow("Only the streamer can do this.");
    expect(result.current.edit?.status).toBe("final");
  });
});
