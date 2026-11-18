import { describe, expect, it } from "vitest";
import { codecLabel, codecProbe, mp4VideoCodec } from "./mp4Codec";

const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const box = (type: string, ...payload: number[][]) => {
  const body = payload.flat();
  return [...u32(8 + body.length), ...ascii(type), ...body];
};
const hdlr = (handler: string) => box("hdlr", [0, 0, 0, 0], [0, 0, 0, 0], ascii(handler), new Array(12).fill(0), [0]);
const stsd = (entry: string) => box("stsd", [0, 0, 0, 0], u32(1), box(entry, new Array(8).fill(0)));
const trak = (handler: string, entry: string) => box("trak", box("mdia", hdlr(handler), box("minf", box("stbl", stsd(entry)))));
const ftyp = box("ftyp", ascii("isom"), u32(0));

const file = (...parts: (number[] | Blob)[]) => new Blob(parts.map((p) => (p instanceof Blob ? p : new Uint8Array(p))));

describe("mp4VideoCodec", () => {
  it("reads the video track's entry when moov sits after a large mdat", async () => {
    const mdat = [...u32(8 + 100_000), ...ascii("mdat")];
    const f = file(ftyp, mdat, new Blob([new Uint8Array(100_000)]), box("moov", trak("soun", "mp4a"), trak("vide", "hvc1")));
    expect(await mp4VideoCodec(f)).toBe("hvc1");
  });

  it("reads avc1 with moov first", async () => {
    expect(await mp4VideoCodec(file(ftyp, box("moov", trak("vide", "avc1"))))).toBe("avc1");
  });

  it("follows a 64-bit largesize box", async () => {
    const big = [...u32(1), ...ascii("free"), 0, 0, 0, 0, ...u32(16 + 4), 0, 0, 0, 0];
    expect(await mp4VideoCodec(file(ftyp, big, box("moov", trak("vide", "avc1"))))).toBe("avc1");
  });

  it("is null for garbage, a file with no video track, and an empty file", async () => {
    expect(await mp4VideoCodec(file(ascii("not a video at all, really")))).toBeNull();
    expect(await mp4VideoCodec(file(ftyp, box("moov", trak("soun", "mp4a"))))).toBeNull();
    expect(await mp4VideoCodec(new Blob([]))).toBeNull();
  });
});

describe("codecLabel / codecProbe", () => {
  it("names H.265 for both HEVC entries, null for unknown", () => {
    expect(codecLabel("hvc1")).toBe("H.265");
    expect(codecLabel("hev1")).toBe("H.265");
    expect(codecLabel("avc1")).toBe("H.264");
    expect(codecLabel("xyz1")).toBeNull();
    expect(codecLabel(null)).toBeNull();
    expect(codecProbe("hvc1")).toContain("hvc1.");
  });
});
