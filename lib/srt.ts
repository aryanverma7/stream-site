import type { Segment } from "./useTranscript";

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** SubRip time: HH:MM:SS,mmm. */
export function srtTime(s: number): string {
  const ms = Math.max(0, Math.round(s * 1000));
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}

/** The transcript as a SubRip (.srt) file: numbered cues, CRLF line ends. A cue that ends at or before its start lasts 1 s. */
export function toSrt(segments: Segment[]): string {
  return segments
    .map((s, i) => `${i + 1}\r\n${srtTime(s.start)} --> ${srtTime(s.end > s.start ? s.end : s.start + 1)}\r\n${s.text}\r\n`)
    .join("\r\n");
}

/** A safe file name: no path or reserved characters, never empty. */
export function srtName(base: string): string {
  const clean = base.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return `${clean || "transcript"}.srt`;
}
