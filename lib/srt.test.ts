import { describe, expect, it } from "vitest";
import { srtName, srtTime, toSrt } from "./srt";

describe("srt", () => {
  it("formats SubRip times past an hour", () => {
    expect(srtTime(0)).toBe("00:00:00,000");
    expect(srtTime(3725.0456)).toBe("01:02:05,046");
  });

  it("numbers the cues with CRLF line ends and gives a zero-length cue one second", () => {
    expect(toSrt([{ start: 0, end: 2.5, text: "ye clutch dekho" }, { start: 3661, end: 3661, text: "GG" }])).toBe(
      "1\r\n00:00:00,000 --> 00:00:02,500\r\nye clutch dekho\r\n\r\n2\r\n01:01:01,000 --> 01:01:02,000\r\nGG\r\n",
    );
  });

  it("makes a safe file name", () => {
    expect(srtName("Main cut v3")).toBe("Main cut v3.srt");
    expect(srtName('a/b:c*?"<>|d v1')).toBe("a b c d v1.srt");
    expect(srtName("  ")).toBe("transcript.srt");
  });

  it("never lets a line break end a cue early", () => {
    expect(toSrt([{ start: 0, end: 1, text: "one\n\n  two \r\n" }])).toBe("1\r\n00:00:00,000 --> 00:00:01,000\r\none\r\ntwo\r\n");
  });
});
