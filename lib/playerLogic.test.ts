import { describe, expect, it } from "vitest";
import { CHUNK_BYTES } from "./opfsMedia";
import { downloadedRanges, fpsOf, startPosition } from "./playerLogic";

describe("playerLogic", () => {
  it("merges neighbouring present chunks and clips the last one", () => {
    const size = 3.5 * CHUNK_BYTES;
    expect(downloadedRanges([true, true, false, true], size)).toEqual([
      [0, 2 * CHUNK_BYTES],
      [3 * CHUNK_BYTES, size],
    ]);
    expect(downloadedRanges([], size)).toEqual([]);
  });
  it("chooses the start position", () => {
    expect(startPosition(30, 100, 600)).toBe(30);
    expect(startPosition(undefined, 100, 600)).toBe(100);
    expect(startPosition(undefined, 597, 600)).toBe(0);
    expect(startPosition(undefined, null, 600)).toBe(0);
    expect(startPosition(900, null, 600)).toBe(600);
  });
  it("reads fps or falls back to 60", () => {
    expect(fpsOf({ fps: { value: 30 } })).toBe(30);
    expect(fpsOf({ fps: { value: "x" } })).toBe(60);
    expect(fpsOf(null)).toBe(60);
  });
});
