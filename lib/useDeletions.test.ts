import { describe, expect, it, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { DELETIONS_POLL_MS, minutesLeft, useDeletions } from "./useDeletions";
import { editorBackend } from "./testUtils";

const REQ = { id: 9, kind: "vod", target_id: 12, label: "vod.mp4", requested_by: "cutter", delete_at: 1, remaining_seconds: 600, status: "pending" };

describe("minutesLeft", () => {
  it("rounds up to whole minutes and stops at zero", () => {
    expect(minutesLeft(1000_000, 1000_000 - 61_000)).toBe(2);
    expect(minutesLeft(1000_000, 1000_000 - 60_000)).toBe(1);
    expect(minutesLeft(1000_000, 1000_000 + 5_000)).toBe(0);
  });
});

describe("useDeletions", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("finds a request by kind and target", async () => {
    editorBackend({ "/deletions": { pending: [REQ] } });
    const { result } = renderHook(() => useDeletions());
    await waitFor(() => expect(result.current.find("vod", 12)?.id).toBe(9));
    expect(result.current.find("project", 12)).toBeUndefined();
  });

  it("counts down from the server's remaining_seconds, not its clock", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(5_000_000);
    editorBackend({ "/deletions": { pending: [REQ] } });
    const { result } = renderHook(() => useDeletions());
    await waitFor(() => expect(result.current.pending).toHaveLength(1));
    // delete_at (1, in 1970) would read as "0 min"; 600 s from when the poll landed is 10.
    expect(result.current.pending[0].ends_at_ms).toBe(5_000_000 + 600_000);
    expect(minutesLeft(result.current.pending[0].ends_at_ms)).toBe(10);
  });

  it("calls onChange when a request appears or goes, not on the first load", async () => {
    vi.useFakeTimers();
    let pending = [REQ];
    editorBackend({ "/deletions": () => ({ pending }) });
    const onChange = vi.fn();
    renderHook(() => useDeletions(onChange));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(onChange).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(DELETIONS_POLL_MS));
    expect(onChange).not.toHaveBeenCalled();
    pending = [];
    await act(() => vi.advanceTimersByTimeAsync(DELETIONS_POLL_MS));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("polls every 30 s while visible, and not while hidden", async () => {
    vi.useFakeTimers();
    const fetchMock = editorBackend({ "/deletions": { pending: [] } });
    renderHook(() => useDeletions());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(DELETIONS_POLL_MS));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(() => vi.advanceTimersByTimeAsync(DELETIONS_POLL_MS));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("undoes and refetches", async () => {
    let pending = [REQ];
    const fetchMock = editorBackend({
      "/deletions": () => ({ pending }),
      "POST /deletions/9/undo": () => {
        pending = [];
        return { request_id: 9, status: "cancelled" };
      },
    });
    const { result } = renderHook(() => useDeletions());
    await waitFor(() => expect(result.current.pending).toHaveLength(1));

    await act(() => result.current.undo(9));
    expect(result.current.pending).toEqual([]);
    expect(fetchMock.mock.calls.map(([u, i]) => `${i?.method ?? "GET"} ${u}`)).toContain("POST /api/editor/deletions/9/undo");
  });
});
