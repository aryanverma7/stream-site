import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAdminStatus } from "./useAdminStatus";
import { asFetchMock } from "./testUtils";

const mockStatus = {
  streamerbot_connected: true,
  widget_connections: { total: 2, roulette: 1, badge: 0, spotify: 1 },
  obs_websocket_connected: null,
  ocr_loop_running: null,
  cloudflare_tunnel_up: null,
};

describe("useAdminStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

  it("requests with credentials: same-origin, relying on the existing session cookie", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockStatus) });
    global.fetch = asFetchMock(fetchMock);

    renderHook(() => useAdminStatus());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/status", { credentials: "same-origin" });
  });
});
