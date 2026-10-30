import { describe, expect, it, vi, afterEach } from "vitest";
import { fpsFrom, grade, jpegUnder, measureMedia, THUMBNAIL_MAX_BYTES, type Measure } from "./mediaChecks";

const m = (over: Partial<Measure> = {}): Measure => ({ width: 1920, height: 1080, duration_s: 90, fps: 60, bitrate_mbps: 55, ...over });

describe("grade", () => {
  it("passes a 1080p60 55 Mbps tape on every check", () => {
    expect(grade(m(), "tape")).toEqual({
      resolution: { state: "pass", value: "1920x1080" },
      fps: { state: "pass", value: 60 },
      bitrate: { state: "pass", value: "≈ 55.0 Mbps" },
      duration_s: 90,
    });
  });

  it("warns on a resolution under the target", () => {
    expect(grade(m({ width: 1280, height: 720 }), "tape").resolution.state).toBe("warn");
  });

  it("grades frame rate: only 60 passes (59.94 counts), 50, 30, 29.97 and 24 fail", () => {
    expect(grade(m({ fps: 60 }), "tape").fps.state).toBe("pass");
    expect(grade(m({ fps: 59.94 }), "tape").fps.state).toBe("pass");
    expect(grade(m({ fps: 59.9 }), "reel").fps.state).toBe("pass");
    for (const fps of [59.5, 50, 30, 29.97, 24]) expect(grade(m({ fps }), "tape").fps.state).toBe("fail");
  });

  it("fails a 40 Mbps bitrate", () => {
    expect(grade(m({ bitrate_mbps: 40 }), "tape").bitrate).toEqual({ state: "fail", value: "≈ 40.0 Mbps" });
  });

  it("reads an unmeasured check as unknown, never pass", () => {
    const g = grade(m({ fps: null, bitrate_mbps: null, width: null, height: null, duration_s: null }), "tape");
    expect([g.resolution.state, g.fps.state, g.bitrate.state]).toEqual(["unknown", "unknown", "unknown"]);
    expect(g.duration_s).toBeNull();
    // An audio-only file reports 0x0.
    expect(grade(m({ width: 0, height: 0 }), "tape").resolution.state).toBe("unknown");
  });

  it("holds a reel to 1080x1920, so a tape-sized reel warns", () => {
    expect(grade(m({ width: 1080, height: 1920 }), "reel").resolution.state).toBe("pass");
    expect(grade(m(), "reel").resolution.state).toBe("warn");
  });

  it("fits in the backend's 16384-byte checks limit", () => {
    expect(JSON.stringify(grade(m(), "tape")).length).toBeLessThan(16384);
  });
});

describe("fpsFrom", () => {
  const times = (fps: number, n: number, start = 9) => Array.from({ length: n }, (_, i) => start + i / fps);

  it("snaps to the nearest common rate within 0.5", () => {
    expect(fpsFrom(times(60, 120))).toBe(60);
    expect(fpsFrom(times(59.94, 120))).toBe(59.94);
    expect(fpsFrom(times(29.97, 60))).toBe(29.97);
    expect(fpsFrom(times(25, 50))).toBe(25);
  });

  it("gives one decimal for an uncommon rate", () => {
    expect(fpsFrom(times(40, 80))).toBe(40);
    expect(fpsFrom(times(37.3, 80))).toBe(37.3);
  });

  it("ignores an occasional dropped frame", () => {
    const t = times(60, 120);
    t.splice(50, 2);
    expect(fpsFrom(t)).toBe(60);
  });

  it("is null under 10 frames", () => {
    expect(fpsFrom(times(60, 9))).toBeNull();
    expect(fpsFrom([])).toBeNull();
  });
});

describe("jpegUnder", () => {
  /** A canvas whose JPEG is 400 KB at q 0.9 and shrinks with q. */
  const canvas = (bytesAt: (q: number) => number) => {
    const qs: number[] = [];
    const c = {
      toBlob: (cb: (b: Blob | null) => void, type: string, q: number) => {
        expect(type).toBe("image/jpeg");
        qs.push(q);
        cb(new Blob([new Uint8Array(bytesAt(q))]));
      },
    } as unknown as HTMLCanvasElement;
    return { c, qs };
  };

  it("lowers the quality until the JPEG is within the limit", async () => {
    const { c, qs } = canvas((q) => Math.round(q * 450_000));
    const blob = await jpegUnder(c);
    expect(blob!.size).toBeLessThanOrEqual(THUMBNAIL_MAX_BYTES);
    expect(qs.length).toBeGreaterThan(1);
    expect(qs).toEqual([...qs].sort((a, b) => b - a));
  });

  it("gives up (no thumbnail) rather than send one over the limit", async () => {
    const { c } = canvas(() => 300_000);
    expect(await jpegUnder(c)).toBeNull();
  });
});

describe("measureMedia", () => {
  afterEach(() => vi.restoreAllMocks());

  /** A <video> whose metadata loads with these properties (jsdom has no decoder). */
  function fakeVideo(props: { duration: number; videoWidth: number; videoHeight: number }) {
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const make = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = make(tag);
      if (tag !== "video") return el;
      for (const [k, v] of Object.entries(props)) Object.defineProperty(el, k, { value: v });
      (el as HTMLVideoElement).pause = () => {};
      Object.defineProperty(el, "src", { set: () => setTimeout(() => el.dispatchEvent(new Event("loadedmetadata"))) });
      return el;
    });
  }

  it("gives no bitrate for a file with no decodable video track (audio only), so it grades unknown", async () => {
    fakeVideo({ duration: 90, videoWidth: 0, videoHeight: 0 });
    const got = await measureMedia(new File([new Uint8Array(1000)], "a.mp4"));
    expect(got).toEqual({ width: null, height: null, duration_s: 90, fps: null, bitrate_mbps: null });
    expect(grade(got, "tape").bitrate.state).toBe("unknown");
  });
});
