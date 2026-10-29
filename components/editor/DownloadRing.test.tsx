import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DownloadRing } from "./DownloadRing";

const GB = 1024 ** 3;

describe("DownloadRing", () => {
  it("labels the progress", () => {
    const { container } = render(<DownloadRing doneBytes={1.2 * GB} total={3.4 * GB} />);
    const label = "Downloaded 1.2 of 3.4 GB (35%)";
    expect(screen.getByRole("img", { name: label })).toBeInTheDocument();
    expect(screen.getByTitle(label)).toBeInTheDocument();
    expect(container.querySelector("[data-check]")).toBeNull();
  });
  it("rounds down, so 100% only shows when complete", () => {
    render(<DownloadRing doneBytes={99.6} total={100} />);
    expect(screen.getByRole("img", { name: /\(99%\)$/ })).toBeInTheDocument();
  });
  it("shows a check when complete", () => {
    const { container } = render(<DownloadRing doneBytes={3.4 * GB} total={3.4 * GB} />);
    expect(screen.getByRole("img", { name: "Downloaded · plays from this computer" })).toBeInTheDocument();
    expect(container.querySelector("[data-check]")).not.toBeNull();
  });
});
