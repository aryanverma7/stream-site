import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlaybackBar, isCodecError, playbackProblem } from "./PlaybackBar";

const no = () => "";
const yes = () => "probably";
const H265 = "This browser can't play H.265, open it in Chrome";

describe("playbackProblem", () => {
  it("names H.265 when this browser failed to decode an hvc1 file", () => {
    expect(playbackProblem({ codec: "hvc1" }, true, yes)).toBe(H265);
  });

  it("uses the generic line for another or unknown codec", () => {
    expect(playbackProblem({ codec: "av01" }, true, yes)).toBe("This browser can't play this video's format, open it in Chrome");
    expect(playbackProblem(null, true, yes)).toBe("This browser can't play this video's format, open it in Chrome");
  });

  it("warns before playback when the uploader could not play it and this browser says it cannot either", () => {
    expect(playbackProblem({ codec: "hev1", playable: false }, false, no)).toBe(H265);
  });

  it("says nothing when the uploader could not play it but this browser can", () => {
    expect(playbackProblem({ codec: "hvc1", playable: false }, false, yes)).toBeNull();
  });

  it("says nothing for a playable version, or unknown codec without a failure here", () => {
    expect(playbackProblem({ codec: "hvc1", playable: true }, false, no)).toBeNull();
    expect(playbackProblem({ playable: false }, false, no)).toBeNull();
  });
});

describe("isCodecError", () => {
  it("is the codec only for code 4 when this browser cannot play that codec", () => {
    expect(isCodecError("hvc1", 4, no)).toBe(true);
    expect(isCodecError("avc1", 4, yes)).toBe(false); // an expired link or a quota 403 also reports 4
    expect(isCodecError(null, 4, no)).toBe(false);
    expect(isCodecError("hvc1", 2, no)).toBe(false);
  });
});

describe("PlaybackBar", () => {
  it("is an alert pinned over the video, nothing without a problem", () => {
    const { rerender } = render(<PlaybackBar problem={H265} />);
    expect(screen.getByRole("alert")).toHaveTextContent(H265);
    expect(screen.getByRole("alert").className).toContain("absolute");
    rerender(<PlaybackBar problem={null} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
