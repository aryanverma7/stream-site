import { describe, expect, it, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { BELL_POLL_MS, useBell } from "./useBell";
import { editorBackend } from "./testUtils";

const ITEM = { id: 7, at: 1, actor: "cutter", kind: "iteration_ready", summary: "v2 is up", project_id: 1, tape_id: 2, iteration_id: 3 };

describe("useBell", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("loads the feed with no after= and reports unseen", async () => {
    const fetchMock = editorBackend({ "/notifications": { items: [ITEM], unseen: 1 } });
    const { result } = renderHook(() => useBell());
    await waitFor(() => expect(result.current.unseen).toBe(1));
    expect(result.current.items[0].id).toBe(7);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/editor/notifications");
  });

  it("polls every 60 s while visible, not while hidden, and at once on coming back", async () => {
    vi.useFakeTimers();
    const fetchMock = editorBackend({ "/notifications": { items: [], unseen: 0 } });
    renderHook(() => useBell());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(BELL_POLL_MS));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const vis = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(() => vi.advanceTimersByTimeAsync(BELL_POLL_MS * 3));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vis.mockReturnValue("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("marks seen up to an id, then re-reads the count", async () => {
    let unseen = 1;
    const fetchMock = editorBackend({
      "/notifications": () => ({ items: [ITEM], unseen }),
      "POST /notifications/seen": () => {
        unseen = 0;
        return { ok: true };
      },
    });
    const { result } = renderHook(() => useBell());
    await waitFor(() => expect(result.current.unseen).toBe(1));
    await act(() => result.current.markSeen(7));
    expect(result.current.unseen).toBe(0);
    const call = fetchMock.mock.calls.find(([u, i]) => u === "/api/editor/notifications/seen" && i?.method === "POST")!;
    expect(JSON.parse(String(call[1]!.body))).toEqual({ up_to_id: 7 });
  });
});
