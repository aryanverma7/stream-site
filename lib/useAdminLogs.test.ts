import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAdminLogs } from "./useAdminLogs";
import { asFetchMock } from "./testUtils";

describe("useAdminLogs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches the requested number of lines", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ lines: ["line 1", "line 2"] }),
    });
    global.fetch = asFetchMock(fetchMock);

    const { result } = renderHook(() => useAdminLogs(50));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lines).toEqual(["line 1", "line 2"]);
    expect(fetchMock).toHaveBeenCalledWith("/api/logs?lines=50", { credentials: "same-origin" });
  });

  it("defaults to 200 lines when no count is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ lines: [] }) });
    global.fetch = asFetchMock(fetchMock);

    renderHook(() => useAdminLogs());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/logs?lines=200", { credentials: "same-origin" }));
  });

  it("sets error state on a failed request", async () => {
    global.fetch = asFetchMock(vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const { result } = renderHook(() => useAdminLogs());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
  });

  it("gracefully handles a malformed response (lines not an array)", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ lines: "oops" }) }),
    );
    const { result } = renderHook(() => useAdminLogs());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lines).toEqual([]);
  });
});
