import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useSiteConfig } from "./useSiteConfig";
import { asFetchMock } from "./testUtils";

describe("useSiteConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in a loading state with no links", () => {
    global.fetch = asFetchMock(vi.fn(() => new Promise(() => {})));
    const { result } = renderHook(() => useSiteConfig());
    expect(result.current.loading).toBe(true);
    expect(result.current.socialLinks).toEqual({});
  });

  it("returns the social links from the backend once loaded", async () => {
    const mockLinks = {
      twitch: "https://www.twitch.tv/dualbladex",
      youtube: "https://www.youtube.com/@DualBladeX",
      instagram: "https://www.instagram.com/dualbladex7/",
      discord: "https://discord.gg/jqAqSfrqYY",
    };
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ social_links: mockLinks }),
      }),
    );

    const { result } = renderHook(() => useSiteConfig());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.socialLinks).toEqual(mockLinks);
  });

  it("gracefully returns empty links, not a crash, when the fetch fails", async () => {
    global.fetch = asFetchMock(vi.fn().mockRejectedValue(new Error("network error")));

    const { result } = renderHook(() => useSiteConfig());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.socialLinks).toEqual({});
  });

  it("handles a response missing social_links entirely, without crashing", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({}),
      }),
    );

    const { result } = renderHook(() => useSiteConfig());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.socialLinks).toEqual({});
  });
});
