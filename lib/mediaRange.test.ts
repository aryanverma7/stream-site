import { describe, expect, it } from "vitest";
import * as range from "../public/editor/media-range.js";
import { CHUNK_BYTES, chunkLength, chunkName, dirName } from "./opfsMedia";

const big = 10 * CHUNK_BYTES;

describe("media-range.js agrees with opfsMedia.ts", () => {
  it("has the same chunk size, names and lengths", () => {
    expect(range.CHUNK_BYTES).toBe(CHUNK_BYTES);
    for (const i of [0, 7, 12345]) expect(range.chunkName(i)).toBe(chunkName(i));
    expect(range.dirName(7, 3, "F_x-1")).toBe(dirName(7, 3, "F_x-1"));
    for (const [size, i] of [[big, 0], [CHUNK_BYTES + 5, 1], [100, 0]]) expect(range.chunkLength(size, i)).toBe(chunkLength(size, i));
  });
});

describe("parseRange", () => {
  it("caps an open range at one chunk", () => {
    expect(range.parseRange("bytes=0-", big)).toEqual({ start: 0, end: CHUNK_BYTES - 1 });
  });
  it("keeps a closed range", () => {
    expect(range.parseRange("bytes=100-199", big)).toEqual({ start: 100, end: 199 });
  });
  it("clamps the end to the size", () => {
    expect(range.parseRange("bytes=50-999", 100)).toEqual({ start: 50, end: 99 });
  });
  it("treats a missing header as the whole file, capped", () => {
    expect(range.parseRange(null, 100)).toEqual({ start: 0, end: 99 });
    expect(range.parseRange(null, big)).toEqual({ start: 0, end: CHUNK_BYTES - 1 });
  });
  it("refuses a start past the size or a malformed header", () => {
    expect(range.parseRange("bytes=100-", 100)).toBeNull();
    expect(range.parseRange("bytes=-500", 100)).toBeNull();
    expect(range.parseRange("bytes=9-3", 100)).toBeNull();
  });
});

describe("planRange", () => {
  it("splits across disk, Drive, disk", () => {
    const start = CHUNK_BYTES - 10;
    const end = 2 * CHUNK_BYTES + 9;
    expect(range.planRange(start, end, [true, false, true])).toEqual([
      { source: "disk", chunk: 0, from: start, to: CHUNK_BYTES - 1 },
      { source: "drive", from: CHUNK_BYTES, to: 2 * CHUNK_BYTES - 1 },
      { source: "disk", chunk: 2, from: 2 * CHUNK_BYTES, to: end },
    ]);
  });
  it("merges neighbouring missing chunks into one Drive piece", () => {
    expect(range.planRange(10, CHUNK_BYTES + 10, [false, false])).toEqual([{ source: "drive", from: 10, to: CHUNK_BYTES + 10 }]);
  });
  it("reads one chunk from disk", () => {
    expect(range.planRange(100, 199, [true])).toEqual([{ source: "disk", chunk: 0, from: 100, to: 199 }]);
  });
});
