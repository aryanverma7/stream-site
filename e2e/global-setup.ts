import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

export const MEDIA = path.join(__dirname, ".media");
export const OUT = path.join(__dirname, "..", "out");

/** Test videos, made once with ffmpeg: VP8 WebM, which both browsers' builds play. */
const VIDEOS: Record<string, string[]> = {
  // 12 s of noise at 50 Mbit/s: about 71 MB, so three 32 MiB chunks
  "big.webm": ["-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30,noise=alls=60:allf=t", "-t", "12", "-b:v", "50M", "-minrate", "50M", "-maxrate", "50M", "-bufsize", "10M"],
  // well under one chunk
  "clip.webm": ["-f", "lavfi", "-i", "testsrc2=size=320x180:rate=30", "-t", "6", "-b:v", "1M"],
};

export default function globalSetup() {
  if (!existsSync(path.join(OUT, "editor.html"))) throw new Error("out/editor.html is missing: run `npx next build` first (npm run test:e2e does)");
  mkdirSync(MEDIA, { recursive: true });
  for (const [name, args] of Object.entries(VIDEOS)) {
    const file = path.join(MEDIA, name);
    if (existsSync(file)) continue;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args, "-c:v", "libvpx", "-deadline", "realtime", "-cpu-used", "8", "-an", file], { stdio: "inherit" });
  }
}
