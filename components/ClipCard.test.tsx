import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ClipCard } from "./ClipCard";

const mockClip = { filename: "ace_on_bind.mp4", url: "/clips/ace_on_bind.mp4", title: "ace on bind" };

describe("ClipCard", () => {
  beforeEach(() => {
    // JSDOM doesn't implement real video playback - play()/pause() throw
    // "Not implemented" by default unless explicitly mocked.
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
  });

  it("renders the video with the correct source and the clip's title", () => {
    const { container, getByText } = render(<ClipCard clip={mockClip} onExpand={vi.fn()} />);
    const video = container.querySelector("video");

    expect(video?.getAttribute("src")).toBe("/clips/ace_on_bind.mp4");
    expect(getByText("ace on bind")).toBeTruthy();
  });

  it("plays the video on hover", () => {
    const { container } = render(<ClipCard clip={mockClip} onExpand={vi.fn()} />);
    const button = container.querySelector("button")!;

    fireEvent.mouseEnter(button);

    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it("pauses and resets to the first frame when the pointer leaves", () => {
    const { container } = render(<ClipCard clip={mockClip} onExpand={vi.fn()} />);
    const button = container.querySelector("button")!;
    const video = container.querySelector("video")!;

    fireEvent.mouseEnter(button);
    fireEvent.mouseLeave(button);

    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    expect(video.currentTime).toBe(0);
  });

  it("calls onExpand with the clip's data when clicked", () => {
    const onExpand = vi.fn();
    const { container } = render(<ClipCard clip={mockClip} onExpand={onExpand} />);
    const button = container.querySelector("button")!;

    fireEvent.click(button);

    expect(onExpand).toHaveBeenCalledWith(mockClip);
  });
});
