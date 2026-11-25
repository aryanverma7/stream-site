import { describe, expect, it } from "vitest";
import { codecLabel, codecProbe, mp4Info } from "./mp4Codec";

const mp4VideoCodec = async (f: Blob) => (await mp4Info(f))?.codec ?? null;

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

describe("mp4Info(...).codec", () => {
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

const zeros = (n: number) => new Array(n).fill(0);
/** tkhd v0: version/flags, times and ids (20), reserved etc. (16), matrix (36), width, height (16.16). */
const tkhd = (w: number, h: number, rotate90 = false) =>
  box("tkhd", zeros(24), zeros(16), [
    ...u32(rotate90 ? 0 : 0x10000), ...u32(rotate90 ? 0x10000 : 0), ...u32(0),
    ...u32(rotate90 ? 0xffff0000 : 0), ...u32(rotate90 ? 0 : 0x10000), ...u32(0),
    ...u32(0), ...u32(0), ...u32(0x40000000),
  ], u32(w * 65536), u32(h * 65536));
const mdhd = (scale: number, dur: number) => box("mdhd", zeros(4), zeros(8), u32(scale), u32(dur), zeros(4));
const mvhd = (scale: number, dur: number) => box("mvhd", zeros(4), zeros(8), u32(scale), u32(dur), zeros(80));
/** A visual sample entry: 6 reserved, data ref (2), 16 pre-defined/reserved, width, height (16-bit). */
const visual = (type: string, w: number, h: number) => box(type, zeros(24), [w >> 8, w & 255, h >> 8, h & 255], zeros(50));
const fullTrak = (parts: { tkhd?: number[]; mdhd?: number[]; entry: number[] }) =>
  box("trak", parts.tkhd ?? [], box("mdia", parts.mdhd ?? [], hdlr("vide"), box("minf", box("stbl", box("stsd", zeros(4), u32(1), parts.entry)))));

describe("mp4Info", () => {
  it("reads a ProRes .mov's size from tkhd and duration from mdhd", async () => {
    const f = file(ftyp, box("moov", mvhd(1000, 99_000), fullTrak({ tkhd: tkhd(1920, 1080), mdhd: mdhd(24000, 24000 * 125), entry: visual("apcn", 1920, 1080) })));
    expect(await mp4Info(f)).toEqual({ codec: "apcn", width: 1920, height: 1080, duration_s: 125 });
  });

  it("swaps width and height for a 90 degree rotation, as a phone shoots vertical", async () => {
    const f = file(ftyp, box("moov", fullTrak({ tkhd: tkhd(1920, 1080, true), mdhd: mdhd(600, 600 * 30), entry: visual("hvc1", 1920, 1080) })));
    expect(await mp4Info(f)).toMatchObject({ width: 1080, height: 1920, duration_s: 30 });
  });

  it("falls back to the stsd size and the mvhd duration", async () => {
    const f = file(ftyp, box("moov", mvhd(1000, 45_500), fullTrak({ entry: visual("hev1", 1080, 1920) })));
    expect(await mp4Info(f)).toEqual({ codec: "hev1", width: 1080, height: 1920, duration_s: 45.5 });
  });

  it("keeps the duration unrounded, and reads a v1 all-ones duration as unknown", async () => {
    const f = file(ftyp, box("moov", fullTrak({ mdhd: mdhd(600, 108_031), entry: visual("avc1", 1920, 1080) })));
    expect((await mp4Info(f))?.duration_s).toBeCloseTo(180.0517, 4);
    const mdhd1 = box("mdhd", [1, 0, 0, 0], zeros(16), u32(600), u32(0xffffffff), u32(0xffffffff), zeros(4));
    const g = file(ftyp, box("moov", fullTrak({ mdhd: mdhd1, entry: visual("avc1", 1920, 1080) })));
    expect((await mp4Info(g))?.duration_s).toBeNull();
  });

  it("gives nulls when the header has no size or duration", async () => {
    expect(await mp4Info(file(ftyp, box("moov", trak("vide", "avc1"))))).toEqual({ codec: "avc1", width: null, height: null, duration_s: null });
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
