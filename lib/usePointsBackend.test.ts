import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePointsBackend } from "./usePointsBackend";
import { asFetchMock } from "./testUtils";

function statusReturning(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) });
}

describe("usePointsBackend", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the live ledger from /api/status", async () => {
    global.fetch = asFetchMock(statusReturning({ points_backend: "local" }));

    const { result } = renderHook(() => usePointsBackend());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.backend).toBe("local");
  });

  it("leaves the ledger unknown when the backend doesn't report one", async () => {
    // The Mac Mini routinely runs a backend older than the built site.
    // Guessing "api" here would offer to switch to a value that may
    // already be live, on a backend that can't honour the switch anyway.
    global.fetch = asFetchMock(statusReturning({ streamerbot_connected: true }));

    const { result } = renderHook(() => usePointsBackend());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.backend).toBeNull();
  });

  it("treats an unrecognized ledger name as unknown rather than displaying it", async () => {
    global.fetch = asFetchMock(statusReturning({ points_backend: "cloudbot" }));

    const { result } = renderHook(() => usePointsBackend());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.backend).toBeNull();
  });

  it("reports an error when the status read fails, without claiming a ledger", async () => {
    global.fetch = asFetchMock(vi.fn().mockResolvedValue({ ok: false, status: 502 }));

    const { result } = renderHook(() => usePointsBackend());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.backend).toBeNull();
    expect(result.current.error).toBe("Couldn't read which points ledger is live");
  });

  it("switchTo() sends only points_backend, so it can't clobber a secret", async () => {
    const fetchMock = statusReturning({ points_backend: "api" });
    global.fetch = asFetchMock(fetchMock);

    const { result } = renderHook(() => usePointsBackend());
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: "ok" }) });
    await act(async () => {
      await result.current.switchTo("local");
    });

    expect(fetchMock).toHaveBeenLastCalledWith("/api/config", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points_backend: "local" }),
    });
    expect(result.current.backend).toBe("local");
  });

  it("a failed switch keeps showing the ledger that is still live", async () => {
    const fetchMock = statusReturning({ points_backend: "api" });
    global.fetch = asFetchMock(fetchMock);

    const { result } = renderHook(() => usePointsBackend());
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.resolve({ error: "config write failed" }),
    });
    await act(async () => {
      await result.current.switchTo("local");
    });

    // The switch was refused, so the ledger did NOT change. Moving the
    // control to "local" would claim a change that never happened.
    expect(result.current.backend).toBe("api");
    expect(result.current.error).toBe("config write failed");
  });

  it("clears a previous error once a switch succeeds", async () => {
    const fetchMock = statusReturning({ points_backend: "api" });
    global.fetch = asFetchMock(fetchMock);

    const { result } = renderHook(() => usePointsBackend());
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchMock.mockResolvedValue({ ok: false, status: 502, json: () => Promise.resolve({ error: "nope" }) });
    await act(async () => {
      await result.current.switchTo("local");
    });
    expect(result.current.error).toBe("nope");

    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: "ok" }) });
    await act(async () => {
      await result.current.switchTo("local");
    });

    expect(result.current.error).toBeNull();
    expect(result.current.backend).toBe("local");
  });
});
