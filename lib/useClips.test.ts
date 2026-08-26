import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useClips } from "./useClips";
import { asFetchMock } from "./testUtils";

describe("useClips", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in a loading state with no clips", () => {
    global.fetch = asFetchMock(vi.fn(() => new Promise(() => {})));
    const { result } = renderHook(() => useClips());
    expect(result.current.loading).toBe(true);
    expect(result.current.clips).toEqual([]);
  });

  it("returns the clips from the backend once loaded", async () => {
    const mockClips = [
      { filename: "ace_on_bind.mp4", url: "/clips/ace_on_bind.mp4", title: "ace on bind" },
    ];
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ clips: mockClips }),
      }),
    );

    const { result } = renderHook(() => useClips());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.clips).toEqual(mockClips);
  });

  it("gracefully returns an empty list, not a crash, when the fetch fails", async () => {
    global.fetch = asFetchMock(vi.fn().mockRejectedValue(new Error("network error")));

    const { result } = renderHook(() => useClips());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.clips).toEqual([]);
  });

  it("gracefully handles a malformed response (clips not an array)", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ clips: "not-an-array" }),
      }),
    );

    const { result } = renderHook(() => useClips());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.clips).toEqual([]);
  });
});
