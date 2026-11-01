/**
 * Open comments as markers an NLE can import: a CMX3600 EDL for DaVinci
 * Resolve (Timelines > Import > Timeline Markers from EDL, onto the open
 * timeline with colour, length and note) and an FCP7 XML for Premiere Pro
 * (File > Import; Premiere makes a new sequence carrying the markers, without colours).
 * Pure strings, so every format is pinned by a golden test.
 */
import type { Comment } from "./useComments";

export interface MarkerInput {
  comments: Comment[];
  fps: number;
  /** The NLE timeline's first frame, "hh:mm:ss:ff" (Resolve's default is 01:00:00:00). */
  startTc: string;
  title: string;
}

interface Marker {
  name: string;
  note: string;
  kind: Comment["kind"];
  start: number; // frames from the timeline start
  length: number; // frames, at least 1
}

const RESOLVE_COLOR: Record<Comment["kind"], string> = { fix: "ResolveColorRed", question: "ResolveColorYellow", keep: "ResolveColorGreen" };
const KIND: Record<Comment["kind"], string> = { fix: "Fix", question: "Question", keep: "Keep" };
const NTSC = [23.976, 29.97, 59.94];

/** 59.94 counts as 60 frames a second in timecode (non-drop-frame). */
export const nominal = (fps: number) => Math.max(1, Math.round(fps));
const isNtsc = (fps: number) => NTSC.some((n) => Math.abs(n - fps) < 0.01);

export function parseTc(tc: string, fps: number): number | null {
  const m = /^(\d{1,2}):(\d{2}):(\d{2})[:;](\d{2})$/.exec(tc.trim());
  if (!m) return null;
  const [h, mi, s, f] = m.slice(1).map(Number);
  const n = nominal(fps);
  if (mi > 59 || s > 59 || f >= n) return null;
  return ((h * 60 + mi) * 60 + s) * n + f;
}

export function formatTc(frames: number, fps: number): string {
  const n = nominal(fps);
  const pad = (x: number) => String(x).padStart(2, "0");
  const f = frames % n;
  const total = Math.floor(frames / n);
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}:${pad(f)}`;
}

/** One line: no newlines, no `|` (Resolve's field separator), no leading digit (Resolve misreads it). */
const clean = (s: string) => {
  const one = s.replace(/\s+/g, " ").replace(/\|/g, "/").trim();
  return /^\d/.test(one) ? `_${one}` : one;
};

/** Only open comments with a time on this version: carried ones have no time here, general ones none at all. */
export function markersOf(comments: Comment[], fps: number): Marker[] {
  const n = nominal(fps);
  return comments
    .filter((c) => !c.resolved && !c.carried && c.start_s !== null)
    .sort((a, b) => (a.start_s as number) - (b.start_s as number))
    .map((c) => {
      const start = Math.round((c.start_s as number) * n);
      const end = c.end_s === null ? start : Math.round(c.end_s * n);
      const replies = c.replies.map((r) => `${r.author}: ${r.body}`).join(" / ");
      return {
        name: `${KIND[c.kind]} · ${c.author}`,
        note: replies ? `${c.body} / ${replies}` : c.body,
        kind: c.kind,
        start,
        length: Math.max(1, end - start),
      };
    });
}

export function toEdl({ comments, fps, startTc, title }: MarkerInput): string {
  const base = parseTc(startTc, fps) ?? 0;
  // shortcut: non-drop-frame only; a 59.94 DF timeline drifts ~0.06 s a minute, add a DF switch if the editor reports it
  const lines = [`TITLE: ${clean(title)}`, "FCM: NON-DROP FRAME", ""];
  markersOf(comments, fps).forEach((m, i) => {
    const a = formatTc(base + m.start, fps);
    const b = formatTc(base + m.start + 1, fps);
    lines.push(`${String(i + 1).padStart(3, "0")}  001      V     C        ${a} ${b} ${a} ${b}  `);
    lines.push(` |C:${RESOLVE_COLOR[m.kind]} |M:${clean(`${m.name} - ${m.note}`)} |D:${m.length}`);
    lines.push("");
  });
  return lines.join("\n");
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function toXmeml({ comments, fps, startTc, title }: MarkerInput): string {
  const n = nominal(fps);
  const rate = `<rate><timebase>${n}</timebase><ntsc>${isNtsc(fps) ? "TRUE" : "FALSE"}</ntsc></rate>`;
  const markers = markersOf(comments, fps);
  const duration = Math.max(1, ...markers.map((m) => m.start + m.length));
  const start = parseTc(startTc, fps) ?? 0;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<!DOCTYPE xmeml>",
    '<xmeml version="5">',
    "<sequence>",
    `<name>${xml(title)}</name>`,
    `<duration>${duration}</duration>`,
    rate,
    `<timecode>${rate}<string>${formatTc(start, fps)}</string><frame>${start}</frame><displayformat>NDF</displayformat></timecode>`,
    "<media><video><track/></video><audio><track/></audio></media>",
    ...markers.map(
      (m) =>
        `<marker><name>${xml(m.name)}</name><comment>${xml(m.note)}</comment><in>${m.start}</in><out>${m.length > 1 ? m.start + m.length : -1}</out></marker>`,
    ),
    "</sequence>",
    "</xmeml>",
    "",
  ].join("\n");
}
