import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useLiveStatus } from "./useLiveStatus";
import { asFetchMock } from "./testUtils";

describe("useLiveStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("starts as null (loading) before the first check resolves", () => {
    global.fetch = asFetchMock(vi.fn(() => new Promise(() => {}))); // never resolves
    const { result } = renderHook(() => useLiveStatus());
    expect(result.current).toBeNull();
  });

  it("becomes true when the backend reports live", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ live: true }),
      }),
    );
    const { result } = renderHook(() => useLiveStatus());

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("becomes false when the backend reports offline", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ live: false }),
      }),
    );
    const { result } = renderHook(() => useLiveStatus());

    await waitFor(() => expect(result.current).toBe(false));
  });

  it("defaults to false (not stuck loading, not a crash) when the fetch fails", async () => {
    global.fetch = asFetchMock(vi.fn().mockRejectedValue(new Error("network error")));
    const { result } = renderHook(() => useLiveStatus());

    await waitFor(() => expect(result.current).toBe(false));
  });

  it("polls again after the interval elapses", async () => {
    // Fake timers ONLY in this test, and only advanced via the async
    // variant, which correctly flushes the pending promise microtasks in
    // between ticks - waitFor's own internal polling needs real timers,
    // which is why the other tests above don't use fake ones at all.
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ live: false }),
    });
    global.fetch = asFetchMock(fetchMock);

    renderHook(() => useLiveStatus(5000));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(5000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
