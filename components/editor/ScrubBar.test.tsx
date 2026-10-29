import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ScrubBar } from "./ScrubBar";

function setup(extra: Partial<React.ComponentProps<typeof ScrubBar>> = {}) {
  const onSeek = vi.fn();
  const onRangeSelect = vi.fn();
  render(
    <ScrubBar
      duration={200}
      current={50}
      size={1000}
      downloaded={[[0, 500]]}
      markers={[{ id: 1, start: 100, kind: "fix", active: true }]}
      onSeek={onSeek}
      onRangeSelect={onRangeSelect}
      {...extra}
    />,
  );
  const bar = screen.getByRole("slider");
  bar.getBoundingClientRect = () => ({ left: 0, width: 1000, top: 0, height: 10, right: 1000, bottom: 10, x: 0, y: 0, toJSON() {} });
  return { bar, onSeek, onRangeSelect };
}

describe("ScrubBar", () => {
  it("labels a marker with its comment's kind", () => {
    setup({ markers: [{ id: 1, start: 100, kind: "keep", active: true }, { id: 2, start: 30, kind: "question", active: true }] });
    expect(screen.getByRole("button", { name: "Keep at 1:40" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Question at 0:30" })).toBeInTheDocument();
  });
  it("click at 25% seeks to a quarter", () => {
    const { bar, onSeek } = setup();
    fireEvent.mouseDown(bar, { clientX: 250 });
    fireEvent.mouseUp(window);
    expect(onSeek).toHaveBeenCalledWith(50);
  });
  it("a plain drag scrubs", () => {
    const { bar, onSeek } = setup();
    fireEvent.mouseDown(bar, { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 500 });
    fireEvent.mouseUp(window);
    expect(onSeek).toHaveBeenLastCalledWith(100);
  });
  it("shift-drag selects a range without seeking", () => {
    const { bar, onSeek, onRangeSelect } = setup();
    fireEvent.mouseDown(bar, { clientX: 100, shiftKey: true });
    fireEvent.mouseMove(window, { clientX: 200 });
    fireEvent.mouseUp(window);
    expect(onRangeSelect).toHaveBeenCalledWith(20, 40);
    expect(onSeek).not.toHaveBeenCalled();
  });
  it("the Range handle exists only in range mode", () => {
    expect(screen.queryByText("Range")).toBeNull();
    setup({ rangeMode: true });
    expect(screen.getByText("Range")).toBeInTheDocument();
  });
  it("markers are labelled and seek on click; arrows move 5 s; the band is drawn", () => {
    const { bar, onSeek } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Fix at 1:40" }));
    expect(onSeek).toHaveBeenCalledWith(100);
    fireEvent.keyDown(bar, { key: "ArrowRight" });
    expect(onSeek).toHaveBeenLastCalledWith(55);
    expect(bar).toHaveAttribute("aria-valuenow", "50");
    expect(document.querySelector("[data-downloaded]")).toHaveAttribute("title", "Downloaded (approx.)");
  });
});
