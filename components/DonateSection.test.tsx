import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { DonateSection } from "./DonateSection";

describe("DonateSection", () => {
  it("links to the correct real Streamlabs URL", () => {
    const { getByText } = render(<DonateSection />);
    const link = getByText("Donate on Streamlabs");

    expect(link.getAttribute("href")).toBe("https://streamlabs.com/dualbladex");
  });

  it("opens in a new tab, not navigating away from the site", () => {
    const { getByText } = render(<DonateSection />);
    const link = getByText("Donate on Streamlabs");

    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("includes rel=noopener noreferrer - required security attributes for target=_blank links", () => {
    const { getByText } = render(<DonateSection />);
    const link = getByText("Donate on Streamlabs");

    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });
});
