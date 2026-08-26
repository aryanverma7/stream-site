import { describe, expect, it, vi, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { OfflineRecommendations } from "./OfflineRecommendations";
import { asFetchMock } from "@/lib/testUtils";

describe("OfflineRecommendations", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows a loading state initially", () => {
    global.fetch = asFetchMock(vi.fn(() => new Promise(() => {})));
    const { getByText } = render(<OfflineRecommendations />);
    expect(getByText(/loading recommendations/i)).toBeTruthy();
  });

  it("renders a card per video, linking out to the real YouTube URL", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            videos: [
              { id: "abc123", title: "5 Bombs in Ranked", thumbnail: "https://img.youtube.com/abc123.jpg", url: "https://www.youtube.com/watch?v=abc123" },
            ],
          }),
      }),
    );

    const { getByText, container } = render(<OfflineRecommendations />);

    await waitFor(() => expect(getByText("5 Bombs in Ranked")).toBeTruthy());

    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://www.youtube.com/watch?v=abc123");
    expect(link?.getAttribute("target")).toBe("_blank");
  });

  it("renders nothing (not an error) when there are no videos configured", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ videos: [] }),
      }),
    );

    const { container } = render(<OfflineRecommendations />);

    await waitFor(() => expect(container.querySelector("a")).toBeNull());
  });
});
