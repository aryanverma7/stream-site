"use client";

import { useEffect, useRef, useState } from "react";
import { clock } from "@/lib/editorApi";
import { useTranscript, type Segment } from "@/lib/useTranscript";
import { Loading } from "@/components/Loading";
import { srtName, toSrt } from "@/lib/srt";

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
export function TranscriptPanel({ iterationId, currentTime, onSeek, fileName = "transcript" }: { iterationId: number; currentTime: number; onSeek?: (s: number) => void; fileName?: string }) {
  const tr = useTranscript(iterationId);
  const [editing, setEditing] = useState<{ index: number; text: string; error: string | null; saving: boolean } | null>(null);

  const download = () => {
    const url = URL.createObjectURL(new Blob([toSrt(tr.segments ?? [])], { type: "application/x-subrip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = srtName(fileName);
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const save = async () => {
    if (!editing || editing.saving) return;
    setEditing({ ...editing, saving: true, error: null });
    const error = await tr.saveLine(editing.index, editing.text);
    setEditing(error ? { ...editing, saving: false, error } : null);
  };
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
      {tr.status === "done" && segments.length > 0 && (
        <button type="button" className={btn} onClick={download}>
          Download .srt
        </button>
      )}
      {segments.length > 0 && (
        <ol ref={list} className="max-h-[60vh] space-y-0.5 overflow-y-auto text-sm">
          {segments.map((s, i) => (
            <li key={i} className="group flex items-start gap-1">
              {editing?.index === i ? (
                <div className="w-full space-y-1 px-2 py-1">
                  <span className="font-mono text-dim">{clock(s.start)}</span>
                  <textarea
                    aria-label={`Fix the line at ${clock(s.start)}`}
                    autoFocus
                    value={editing.text}
                    maxLength={2000}
                    onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void save();
                      } else if (e.key === "Escape") {
                        e.stopPropagation(); // Esc here cancels the fix, not the route
                        setEditing(null);
                      }
                    }}
                    className="block w-full border-2 border-phosphor bg-ink p-1 text-sm text-paper"
                  />
                  {editing.error && <p role="alert" className="text-rec">{editing.error}</p>}
                  <div className="flex gap-2">
                    <button type="button" className={btn} disabled={editing.saving} onClick={() => void save()}>
                      {editing.saving ? "Saving…" : "Save"}
                    </button>
                    <button type="button" className={btn} onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={!onSeek}
                    aria-current={i === active ? "true" : undefined}
                    onClick={() => onSeek?.(s.start)}
                    className={`flex w-full gap-2 px-2 py-1 text-left transition-colors ${i === active ? "bg-phosphor text-ink" : "hover:bg-bezel-2"}`}
                  >
                    <span className={`font-mono ${i === active ? "" : "text-dim"}`}>{clock(s.start)}</span>{" "}
                    <span className="break-words">{s.text}</span>
                    {s.edited && <span className="ml-auto shrink-0 self-center text-[10px] uppercase text-dim">edited</span>}
                  </button>
                  <button
                    type="button"
                    aria-label={`Fix the line at ${clock(s.start)}`}
                    title="Fix this line"
                    onClick={() => setEditing({ index: i, text: s.text, error: null, saving: false })}
                    className="shrink-0 px-1.5 py-1 text-dim opacity-60 hover:text-phosphor group-hover:opacity-100 focus:opacity-100"
                  >
                    ✎
                  </button>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
