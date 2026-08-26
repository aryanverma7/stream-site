import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useVideoRecommendations } from "./useVideoRecommendations";
import { asFetchMock } from "./testUtils";

describe("useVideoRecommendations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in a loading state with no videos", () => {
    global.fetch = asFetchMock(vi.fn(() => new Promise(() => {})));
    const { result } = renderHook(() => useVideoRecommendations());
    expect(result.current.loading).toBe(true);
    expect(result.current.videos).toEqual([]);
  });

  it("returns the videos from the backend once loaded", async () => {
    const mockVideos = [
      { id: "abc123", title: "5 Bombs in Ranked", thumbnail: "https://img.youtube.com/abc123.jpg", url: "https://www.youtube.com/watch?v=abc123" },
    ];
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ videos: mockVideos }),
      }),
    );

    const { result } = renderHook(() => useVideoRecommendations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.videos).toEqual(mockVideos);
  });

  it("gracefully returns an empty list, not a crash, when the fetch fails", async () => {
    global.fetch = asFetchMock(vi.fn().mockRejectedValue(new Error("network error")));

    const { result } = renderHook(() => useVideoRecommendations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.videos).toEqual([]);
  });

  it("gracefully handles a malformed response (videos not an array)", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ videos: "not-an-array" }),
      }),
    );

    const { result } = renderHook(() => useVideoRecommendations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.videos).toEqual([]);
  });
});
