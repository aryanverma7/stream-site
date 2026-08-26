import { describe, expect, it, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { Footer } from "./Footer";
import { asFetchMock } from "@/lib/testUtils";

describe("Footer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a link for each social platform provided by the backend", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            social_links: {
              twitch: "https://www.twitch.tv/dualbladex",
              youtube: "https://www.youtube.com/@DualBladeX",
              instagram: "https://www.instagram.com/dualbladex7/",
              discord: "https://discord.gg/jqAqSfrqYY",
            },
          }),
      }),
    );

    const { getByLabelText } = render(<Footer />);

    await waitFor(() => expect(getByLabelText("Twitch")).toBeTruthy());
    expect(getByLabelText("Twitch").getAttribute("href")).toBe("https://www.twitch.tv/dualbladex");
    expect(getByLabelText("YouTube").getAttribute("href")).toBe("https://www.youtube.com/@DualBladeX");
    expect(getByLabelText("Instagram").getAttribute("href")).toBe("https://www.instagram.com/dualbladex7/");
    expect(getByLabelText("Discord").getAttribute("href")).toBe("https://discord.gg/jqAqSfrqYY");
  });

  it("skips a platform entirely if the backend doesn't provide a link for it, rather than showing a broken link", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            social_links: { twitch: "https://www.twitch.tv/dualbladex" },
          }),
      }),
    );

    const { getByLabelText, queryByLabelText } = render(<Footer />);

    await waitFor(() => expect(getByLabelText("Twitch")).toBeTruthy());
    expect(queryByLabelText("YouTube")).toBeNull();
    expect(queryByLabelText("Instagram")).toBeNull();
    expect(queryByLabelText("Discord")).toBeNull();
  });

  it("all rendered links open in a new tab with the correct security attributes", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            social_links: { twitch: "https://www.twitch.tv/dualbladex" },
          }),
      }),
    );

    const { getByLabelText } = render(<Footer />);

    await waitFor(() => expect(getByLabelText("Twitch")).toBeTruthy());
    const link = getByLabelText("Twitch");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("renders nothing broken when there are no social links at all yet", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ json: () => Promise.resolve({ social_links: {} }) }),
    );

    const { container } = render(<Footer />);

    await waitFor(() => expect(container.querySelectorAll("a").length).toBe(0));
  });
});
