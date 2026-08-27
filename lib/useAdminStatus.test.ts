import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { STATUS_POLL_INTERVAL_MS, useAdminStatus } from "./useAdminStatus";
import { asFetchMock } from "./testUtils";

const mockStatus = {
  streamerbot_connected: true,
  widget_connections: { total: 2, roulette: 1, badge: 0, spotify: 1 },
  obs_websocket_connected: null,
};

/** jsdom reports "visible" and has no way to change it from the outside. */
function setTabVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
}

describe("useAdminStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    setTabVisibility("visible");
  });

  it("starts loading and fetches immediately on mount", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockStatus) }),
    );
    const { result } = renderHook(() => useAdminStatus());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status).toEqual(mockStatus);
    expect(result.current.error).toBe(false);
  });

  it("sets error state on a failed request, without crashing", async () => {
    global.fetch = asFetchMock(vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const { result } = renderHook(() => useAdminStatus());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.status).toBeNull();
  });

  it("sets error state when the fetch itself rejects (network failure)", async () => {
    global.fetch = asFetchMock(vi.fn().mockRejectedValue(new Error("network error")));
    const { result } = renderHook(() => useAdminStatus());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
  });

  it("refresh() triggers a new fetch and updates the status again", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStatus) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockStatus, streamerbot_connected: false }),
      });
    global.fetch = asFetchMock(fetchMock);

    const { result } = renderHook(() => useAdminStatus());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status?.streamerbot_connected).toBe(true);

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.status?.streamerbot_connected).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("re-fetches on its own timer, with nobody clicking anything", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockStatus) });
    global.fetch = asFetchMock(fetchMock);

    renderHook(() => useAdminStatus());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // the mount fetch

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STATUS_POLL_INTERVAL_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not flip loading during a background poll", async () => {
    // A poll nobody asked for shouldn't make the Refresh button read
    // "Refreshing..." every five seconds forever - that looks like a fault
    // rather than like the thing working.
    vi.useFakeTimers();
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockStatus) }),
    );

    const { result } = renderHook(() => useAdminStatus());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.loading).toBe(false);

    let seenLoading = false;
    const timer = setInterval(() => {
      if (result.current.loading) seenLoading = true;
    }, 1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STATUS_POLL_INTERVAL_MS + 10);
    });
    clearInterval(timer);
    expect(seenLoading).toBe(false);
  });

  it("keeps the last good status when a background poll fails", async () => {
    // A restart on the Mac Mini shouldn't blank a panel whose last known
    // answers are still the most useful thing on screen.
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStatus) })
      .mockRejectedValue(new Error("backend restarting"));
    global.fetch = asFetchMock(fetchMock);

    const { result } = renderHook(() => useAdminStatus());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toEqual(mockStatus);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STATUS_POLL_INTERVAL_MS);
    });
    expect(result.current.error).toBe(true);
    expect(result.current.status).toEqual(mockStatus); // still there
  });

  it("does not poll while the tab is hidden", async () => {
    // This page sits behind OBS for most of a stream. Polling into a
    // Cloudflare tunnel for a panel nobody can see is pure traffic.
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockStatus) });
    global.fetch = asFetchMock(fetchMock);

    renderHook(() => useAdminStatus());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    setTabVisibility("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STATUS_POLL_INTERVAL_MS * 3);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("catches up immediately when the tab becomes visible again", async () => {
    // Whatever was being fixed on another machine happened entirely while
    // this tab was hidden, so the first thing it should show on return is
    // the result of it - not a five-second-old "disconnected".
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockStatus) });
    global.fetch = asFetchMock(fetchMock);

    renderHook(() => useAdminStatus());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    setTabVisibility("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STATUS_POLL_INTERVAL_MS * 2);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    setTabVisibility("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2); // immediately, not at the next tick
  });

  it("requests with credentials: same-origin, relying on the existing session cookie", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockStatus) });
    global.fetch = asFetchMock(fetchMock);

    renderHook(() => useAdminStatus());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/status", { credentials: "same-origin" });
  });
});
