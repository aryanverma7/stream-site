/**
 * What the browser can tell about a new version before anyone watches it:
 * resolution, frame rate and overall bitrate, graded against the spec, plus
 * a JPEG thumbnail. Anything it cannot measure is null and grades
 * "unknown" - never a pass. The DOM work is kept thin; the arithmetic is
 * in pure functions so it can be tested without a video decoder.
 */

import { mp4Info } from "./mp4Codec";

export interface Measure {
  width: number | null;
  height: number | null;
  duration_s: number | null;
  fps: number | null;
  bitrate_mbps: number | null;
  /** The MP4's video sample entry ("hvc1", "avc1"...), null when unreadable. */
  codec?: string | null;
  /** Whether the uploader's browser could show a picture; null when it was never asked. */
  playable?: boolean | null;
}

type State = "pass" | "warn" | "fail" | "unknown";
export interface GradedChecks {
  resolution: { state: State; value: string | null };
  fps: { state: State; value: number | null };
  bitrate: { state: State; value: string | null };
  duration_s: number | null;
  codec: string | null;
  playable: boolean | null;
}

export const THUMBNAIL_MAX_BYTES = 262144;
const COMMON_FPS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60];

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Only 60 fps passes (the streamer's rule): >= 59.9, so 59.94 counts as 60;
 * anything lower, 29.97 and 30 included, fails. Bitrate is the whole file's (audio included), hence the "≈".
 */
export function grade(m: Measure): GradedChecks {
  const sized = !!m.width && !!m.height;
  // The backend holds every version to its kind's shape (videos horizontal, clips and reels vertical), so the shape picks the target.
  const [tw, th] = sized && m.height! > m.width! ? [1080, 1920] : [1920, 1080];
  return {
    resolution: sized
      ? { state: m.width! >= tw && m.height! >= th ? "pass" : "warn", value: `${m.width}x${m.height}` }
      : { state: "unknown", value: null },
    fps: { state: m.fps === null ? "unknown" : m.fps >= 59.9 ? "pass" : "fail", value: m.fps },
    bitrate:
      m.bitrate_mbps === null
        ? { state: "unknown", value: null }
        : { state: m.bitrate_mbps >= 50 ? "pass" : "fail", value: `≈ ${m.bitrate_mbps.toFixed(1)} Mbps` },
    duration_s: m.duration_s,
    codec: m.codec ?? null,
    playable: m.playable ?? null,
  };
}

/**
 * Frame rate from the media times of consecutive presented frames. The
 * median gap, not the count over the span, so a frame the compositor
 * dropped does not drag 60 down to 59. Null under 10 frames.
 */
export function fpsFrom(mediaTimes: number[]): number | null {
  if (mediaTimes.length < 10) return null;
  const gaps = mediaTimes
    .slice(1)
    .map((t, i) => t - mediaTimes[i])
    .filter((g) => g > 0)
    .sort((a, b) => a - b);
  if (!gaps.length) return null;
  const fps = 1 / gaps[Math.floor(gaps.length / 2)];
  const near = COMMON_FPS.reduce((a, b) => (Math.abs(b - fps) < Math.abs(a - fps) ? b : a));
  return Math.abs(near - fps) <= 0.5 ? near : round1(fps);
}

/** The canvas as a JPEG within the backend's limit, lowering quality until it fits; null if it never does. */
export async function jpegUnder(canvas: HTMLCanvasElement): Promise<Blob | null> {
  for (const q of [0.85, 0.7, 0.55, 0.4, 0.25, 0.1]) {
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", q));
    if (blob && blob.size <= THUMBNAIL_MAX_BYTES) return blob;
  }
  return null;
}

class Unreadable extends Error {
  constructor() {
    super("The browser cannot read this video");
  }
}

function once(v: HTMLVideoElement, name: string, ms = 15000) {
  return new Promise<void>((ok, no) => {
    const t = setTimeout(() => no(new Error(`Timed out waiting for ${name}`)), ms);
    v.addEventListener(name, () => (clearTimeout(t), ok()), { once: true });
    v.addEventListener("error", () => (clearTimeout(t), no(new Unreadable())), { once: true });
  });
}

/**
 * A muted, near-invisible <video> on an object URL. It is in the document
 * because a detached video is never composited, and requestVideoFrameCallback
 * only fires for frames that are.
 */
async function withVideo<T>(file: File, read: (v: HTMLVideoElement) => Promise<T>): Promise<T> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none";
  document.body.append(v);
  try {
    v.src = url;
    await once(v, "loadedmetadata");
    return await read(v);
  } finally {
    v.pause();
    v.remove();
    URL.revokeObjectURL(url);
  }
}

async function seek(v: HTMLVideoElement, t: number) {
  v.currentTime = t;
  await once(v, "seeked");
}

/** ~2 s of muted playback from 10% in (past any intro slate), timing each frame. */
async function measureFps(v: HTMLVideoElement): Promise<number | null> {
  if (!("requestVideoFrameCallback" in v)) return null;
  await seek(v, v.duration * 0.1);
  const times: number[] = [];
  let counting = true;
  const tick: VideoFrameRequestCallback = (_, meta) => {
    times.push(meta.mediaTime);
    if (counting) v.requestVideoFrameCallback(tick);
  };
  v.requestVideoFrameCallback(tick);
  await v.play();
  await new Promise((r) => setTimeout(r, 2000));
  counting = false;
  v.pause();
  return fpsFrom(times);
}

/** `p`, or null once `ms` pass first; the timer is cleared either way. */
function capped<T>(p: Promise<T | null>, ms: number): Promise<T | null> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<null>((r) => (t = setTimeout(() => r(null), ms)))]).finally(() => clearTimeout(t));
}

/**
 * The browser's measure of `file`; a file it cannot decode is `playable: false`, never an error, so it still uploads.
 * Size and duration the browser cannot give come from the MP4/MOV header (ProRes, some HEVC .mov).
 */
export async function measureMedia(file: File): Promise<Measure> {
  const head = await mp4Info(file);
  const codec = head?.codec ?? null;
  let m: Measure;
  try {
    m = await measureWith(file);
  } catch {
    // Unreadable, or metadata that never loads: the header may still know.
    m = { width: null, height: null, duration_s: null, fps: null, bitrate_mbps: null };
  }
  const playable = m.width !== null;
  if (!playable && head?.width && head.height) [m.width, m.height] = [head.width, head.height];
  m.duration_s ??= head?.duration_s ?? null;
  return { ...m, codec, playable };
}

function measureWith(file: File): Promise<Measure> {
  return withVideo(file, async (v) => {
    const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null;
    return {
      width: v.videoWidth || null,
      height: v.videoHeight || null,
      duration_s: d, // unrounded: the backend decides clip vs project on it
      // play() can wait forever on a file the browser half-understands; the upload must not.
      fps:
        d === null || !v.videoWidth
          ? null
          : await capped(measureFps(v).catch(() => null), 10000),
      // No decodable picture: the size/duration would grade the audio (or nothing) as video bitrate.
      bitrate_mbps: d === null || !v.videoWidth ? null : round1((file.size * 8) / d / 1e6),
    };
  });
}

const base64 = (blob: Blob) =>
  new Promise<string>((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1]);
    r.onerror = () => no(r.error);
    r.readAsDataURL(blob);
  });

/** A frame from 10% in (at least 1 s), at most 640 px wide, as base64 JPEG; null for a file with no picture. */
export function thumbnail(file: File): Promise<string | null> {
  return withVideo(file, async (v) => {
    if (!v.videoWidth || !Number.isFinite(v.duration)) return null;
    await seek(v, Math.min(Math.max(1, v.duration * 0.1), v.duration));
    const c = document.createElement("canvas");
    c.width = Math.min(640, v.videoWidth);
    c.height = Math.round((v.videoHeight * c.width) / v.videoWidth);
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    const blob = await jpegUnder(c);
    return blob && base64(blob);
  });
}
