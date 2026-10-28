import { describe, expect, it, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useStorage } from "./useStorage";
import { editorBackend } from "./testUtils";

describe("useStorage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the Drive state when /storage fails because Drive is not connected", async () => {
    editorBackend({
      "/storage": { status: 503, body: { error: "Google Drive is not connected" } },
      "/drive/status": { connected: false, layout: false },
    });
    const { result } = renderHook(() => useStorage());
    await waitFor(() => expect(result.current.error).toBe("Google Drive is not connected"));
    expect(result.current.drive?.connected).toBe(false);
    expect(result.current.storage).toBeNull();
  });

  it("resets the clock, then re-reads", async () => {
    const fetchMock = editorBackend({
      "/storage": { quota: {}, files: [], scheduler: { paused_since: null }, discord: {} },
      "/drive/status": { connected: true, layout: true },
      "POST /scheduler/reset-clock": { sane: true },
    });
    const { result } = renderHook(() => useStorage());
    await waitFor(() => expect(result.current.storage).not.toBeNull());
    await act(() => result.current.resetClock());
    const urls = fetchMock.mock.calls.map(([u, i]) => `${i?.method ?? "GET"} ${u}`);
    expect(urls.indexOf("POST /api/editor/scheduler/reset-clock")).toBeLessThan(urls.lastIndexOf("GET /api/editor/storage"));
  });
});
