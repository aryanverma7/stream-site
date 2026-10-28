import { describe, expect, it, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { CheckBadges } from "./IterationCard";
import type { Checks } from "@/lib/useTape";

describe("CheckBadges", () => {
  afterEach(() => vi.restoreAllMocks());

  it("says 'Checks pending' when nothing was measured yet", () => {
    expect(render(<CheckBadges checks={null} />).container.textContent).toBe("Checks pending");
  });

  it("shows each state with the value in the tooltip, and anything odd as unknown", () => {
    const checks = { resolution: { state: "pass", value: "1920x1080" }, fps: { state: "bogus", value: 59.94 } } as unknown as Checks;
    const { getByText } = render(<CheckBadges checks={checks} />);
    expect(getByText("Resolution pass").getAttribute("title")).toBe("Resolution: 1920x1080");
    expect(getByText("Frame rate unknown").getAttribute("title")).toBe("Frame rate: 59.94");
    expect(getByText("Bitrate unknown").getAttribute("title")).toBe("Bitrate: not measured");
  });
});
