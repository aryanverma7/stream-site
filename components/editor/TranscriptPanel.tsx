"use client";

import { useEffect, useRef } from "react";
import { clock } from "@/lib/editorApi";
import { useTranscript, type Segment } from "@/lib/useTranscript";
import { Loading } from "@/components/Loading";

const btn = "menu-pop label border-2 border-phosphor bg-ink px-2 py-1 text-[11px] text-phosphor hover:bg-phosphor hover:text-ink";

/** The index of the line being spoken at `t`: the last one started by then, while it lasts. */
export function activeLine(segments: Segment[], t: number): number {
  for (let i = segments.length - 1; i >= 0; i--) if (segments[i].start <= t) return t < segments[i].end ? i : -1;
  return -1;
}

/**
 * The version's Hinglish transcript, made by the gaming PC. Lines are
 * buttons that seek (once there is a player); the one being spoken is
 * marked and kept in view.
 */
export function TranscriptPanel({ iterationId, currentTime, onSeek }: { iterationId: number; currentTime: number; onSeek?: (s: number) => void }) {
  const tr = useTranscript(iterationId);
  const list = useRef<HTMLOListElement>(null);
  const segments = tr.segments ?? [];
  const active = onSeek ? activeLine(segments, currentTime) : -1; // nothing is being spoken before playback starts

  useEffect(() => {
    if (active < 0) return;
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.current?.children[active]?.scrollIntoView?.({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [active]);

  return (
    <section aria-label="Transcript" className="space-y-2">
      {tr.status === null && !tr.error && <Loading />}
      {tr.status === "none" && (
        <button type="button" className={btn} onClick={() => void tr.request()}>
          Make transcript
        </button>
      )}
      {tr.status === "queued" && <p className="text-amber">Waiting for the PC</p>}
      {tr.status === "running" && <p className="text-amber">Transcribing…</p>}
      {tr.error && <p role="alert" className="text-rec">{tr.error}</p>}
      {tr.status === "failed" && (
        <button type="button" className={btn} onClick={() => void tr.request()}>
          Try again
        </button>
      )}
      {tr.status === "done" && segments.length === 0 && <p className="text-dim">No speech found</p>}
      {segments.length > 0 && (
        <ol ref={list} className="max-h-[60vh] space-y-0.5 overflow-y-auto text-sm">
          {segments.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                disabled={!onSeek}
                aria-current={i === active ? "true" : undefined}
                onClick={() => onSeek?.(s.start)}
                className={`flex w-full gap-2 px-2 py-1 text-left transition-colors ${i === active ? "bg-phosphor text-ink" : "hover:bg-bezel-2"}`}
              >
                <span className={`font-mono ${i === active ? "" : "text-dim"}`}>{clock(s.start)}</span>{" "}
                <span className="break-words">{s.text}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
