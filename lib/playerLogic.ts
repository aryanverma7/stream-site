import { CHUNK_BYTES, chunkLength } from "./opfsMedia";

/** Byte ranges of the chunks present, neighbours merged. */
export function downloadedRanges(present: boolean[], size: number): [number, number][] {
  const out: [number, number][] = [];
  present.forEach((p, i) => {
    if (!p) return;
    const start = i * CHUNK_BYTES;
    const end = start + chunkLength(size, i);
    const last = out[out.length - 1];
    if (last && last[1] === start) last[1] = end;
    else out.push([start, end]);
  });
  return out;
}

/** Route time first, else the saved position unless it is near the end, else the start. */
export function startPosition(seekS: number | undefined, positionS: number | null | undefined, duration: number): number {
  if (seekS !== undefined) return Math.min(Math.max(seekS, 0), duration);
  return typeof positionS === "number" && positionS > 0 && positionS < duration - 5 ? positionS : 0;
}

export const SPEEDS = [0.25, 0.5, 1, 1.5, 2];

export function fpsOf(checks: { fps?: { value?: unknown } } | null | undefined): number {
  const f = checks?.fps?.value;
  return typeof f === "number" && f > 0 ? f : 60;
}

const MIME: Record<string, string> = { mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska" };
export const mimeOf = (filename: string) => MIME[filename.split(".").pop()?.toLowerCase() ?? ""] ?? "video/mp4";
