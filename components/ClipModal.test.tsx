import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ClipModal } from "./ClipModal";

const mockClip = { filename: "ace_on_bind.mp4", url: "/clips/ace_on_bind.mp4", title: "ace on bind" };

describe("ClipModal", () => {
  beforeEach(() => {
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  });

  it("renders the clip with controls and autoplay for the fuller view", () => {
    const { container } = render(<ClipModal clip={mockClip} onClose={vi.fn()} />);
    const video = container.querySelector("video");

    expect(video?.getAttribute("src")).toBe("/clips/ace_on_bind.mp4");
    expect(video?.hasAttribute("controls")).toBe(true);
  });

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<ClipModal clip={mockClip} onClose={onClose} />);

    fireEvent.click(container.firstChild as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT close when clicking inside the video content area (event should not bubble to the backdrop)", () => {
    const onClose = vi.fn();
    const { container } = render(<ClipModal clip={mockClip} onClose={onClose} />);
    const video = container.querySelector("video")!;

    fireEvent.click(video);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when the Close button is clicked", () => {
    const onClose = vi.fn();
    const { getByText } = render(<ClipModal clip={mockClip} onClose={onClose} />);

    fireEvent.click(getByText("Close"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the Escape key is pressed", () => {
    const onClose = vi.fn();
    render(<ClipModal clip={mockClip} onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
