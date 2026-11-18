"use client";

import { codecLabel, codecProbe } from "@/lib/mp4Codec";
import type { Checks } from "@/lib/useTape";

const canPlayHere = (mime: string) => (typeof document === "undefined" ? "maybe" : document.createElement("video").canPlayType(mime));

/**
 * Why this browser cannot show the version, or null. Either this browser's
 * own <video> failed to decode it, or the uploader's could not and this one
 * says it cannot either (so nobody waits for a 4 GB download to find out).
 */
export function playbackProblem(checks: Checks | null, viewerFailed: boolean, canPlay: (mime: string) => string = canPlayHere): string | null {
  const codec = checks && typeof checks.codec === "string" ? checks.codec : null;
  const probe = codecProbe(codec);
  const failed = viewerFailed || (checks?.playable === false && probe !== null && canPlay(probe) === "");
  if (!failed) return null;
  return codecLabel(codec) === "H.265"
    ? "This browser can't play H.265, open it in Chrome"
    : "This browser can't play this video's format, open it in Chrome";
}

/**
 * Whether a <video> error is the codec. Browsers report MEDIA_ERR_SRC_NOT_SUPPORTED (4) for a failed
 * first load too (an expired Drive link, offline, a quota 403), so code 4 counts only when this browser
 * also says it cannot play the file's codec; everything else is a load failure with its own message.
 */
export function isCodecError(codec: unknown, code: number | undefined, canPlay: (mime: string) => string = canPlayHere): boolean {
  const probe = codecProbe(typeof codec === "string" ? codec : null);
  return code === 4 && probe !== null && canPlay(probe) === "";
}

/** Pinned on top of the video (its parent is `relative`), not dismissable. */
export function PlaybackBar({ problem, overlay = true }: { problem: string | null; overlay?: boolean }) {
  if (!problem) return null;
  return (
    <p role="alert" className={`${overlay ? "absolute inset-x-0 top-0 z-10" : ""} bg-rec px-3 py-2 text-sm font-bold text-ink`}>
      {problem}
    </p>
  );
}
