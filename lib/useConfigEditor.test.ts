import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useConfigEditor } from "./useConfigEditor";
import { asFetchMock } from "./testUtils";

describe("useConfigEditor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches the full config on mount", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ http_port: 8765, streamlabs_access_token: "secret123" }),
      }),
    );

    const { result } = renderHook(() => useConfigEditor());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config).toEqual({ http_port: 8765, streamlabs_access_token: "secret123" });
  });

  it("sets error state when the initial fetch fails", async () => {
    global.fetch = asFetchMock(vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const { result } = renderHook(() => useConfigEditor());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
  });

  it("save() PUTs the updated config and reflects success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ http_port: 8765 }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: "ok" }) });
    global.fetch = asFetchMock(fetchMock);

    const { result } = renderHook(() => useConfigEditor());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.save({ http_port: 9000 });
    });

    expect(result.current.saveSuccess).toBe(true);
    expect(result.current.config).toEqual({ http_port: 9000 });
    expect(fetchMock).toHaveBeenLastCalledWith("/api/config", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ http_port: 9000 }),
    });
  });

  it("save() surfaces a real error message when the PUT fails, without crashing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ http_port: 8765 }) })
      .mockResolvedValueOnce({ ok: false, status: 400, json: () => Promise.resolve({ error: "Invalid JSON body" }) });
    global.fetch = asFetchMock(fetchMock);

    const { result } = renderHook(() => useConfigEditor());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.save({ http_port: 9000 });
    });

    expect(result.current.saveSuccess).toBe(false);
    expect(result.current.saveError).toBe("Invalid JSON body");
  });
});
