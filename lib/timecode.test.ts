import { describe, expect, it } from "vitest";
import { formatTime, parseTime } from "./timecode";

describe("timecode", () => {
  it("formats", () => {
    expect(formatTime(222.5)).toBe("3:42");
    expect(formatTime(3725)).toBe("1:02:05");
    expect(formatTime(222.54, true)).toBe("3:42.5");
    expect(formatTime(-3)).toBe("0:00");
    expect(formatTime(NaN)).toBe("0:00");
  });
  it("parses and round-trips", () => {
    expect(parseTime("3:42.5")).toBe(222.5);
    expect(parseTime("1:02:05")).toBe(3725);
    expect(parseTime("42")).toBe(42);
    expect(parseTime("bad")).toBeNull();
    expect(parseTime("3:75")).toBeNull();
    expect(parseTime(formatTime(3725))).toBe(3725);
    expect(parseTime(formatTime(222.5, true))).toBe(222.5);
  });
});
