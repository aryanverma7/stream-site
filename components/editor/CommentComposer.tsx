"use client";

import { useState } from "react";
import { formatTime, parseTime } from "@/lib/timecode";
import type { Draft } from "@/lib/useComments";
import { useAttachmentUploads } from "@/lib/useAttachmentUploads";
import { AttachmentPicker, attachHandlers } from "./Attachments";

const field = "border border-seam bg-ink px-2 py-1 text-sm";
const btn = "label border border-seam px-2 py-1 text-[11px] text-phosphor hover:border-field disabled:opacity-40";

/**
 * New comment: timed (start, optional end) or general (no times).
 * Esc cancels and stops here, so the shell does not also zoom out.
 */
export function CommentComposer({
  iterationId,
  start,
  end,
  getNow,
  onSubmit,
  onCancel,
}: {
  /** Where pasted or picked images upload to. */
  iterationId: number;
  /** null: a general comment. */
  start: number | null;
  end?: number | null;
  getNow(): number;
  onSubmit(draft: Draft): void;
  onCancel(): void;
}) {
  const [kind, setKind] = useState<Draft["kind"]>("fix");
  const [body, setBody] = useState("");
  const [startText, setStartText] = useState(start === null ? "" : formatTime(start, true));
  const [endText, setEndText] = useState(end == null ? "" : formatTime(end, true));
  const [error, setError] = useState<string | null>(null);
  const uploads = useAttachmentUploads(iterationId);
  // A new start/end (a range dragged, C again) replaces the times and keeps what was typed.
  const [times, setTimes] = useState([start, end ?? null]);
  if (times[0] !== start || times[1] !== (end ?? null)) {
    setTimes([start, end ?? null]);
    setStartText(start === null ? "" : formatTime(start, true));
    setEndText(end == null ? "" : formatTime(end, true));
  }

  function submit() {
    let s: number | null = null;
    let e: number | null = null;
    if (start !== null) {
      s = parseTime(startText);
      if (s === null) return setError("Start time isn't a time like 3:42.5");
      if (endText.trim()) {
        e = parseTime(endText);
        if (e === null) return setError("End time isn't a time like 3:42.5");
        if (e <= s) return setError("End must be after start");
      }
    }
    if (!body.trim()) return setError("Write something first");
    if (uploads.blocking) return setError("Wait for the images to finish, or remove the failed one");
    setError(null);
    onSubmit({ kind, body: body.trim(), start_s: s, end_s: e, ...(uploads.ids.length && { attachment_ids: uploads.ids }) });
    uploads.clear();
  }

  return (
    <form
      aria-label={start === null ? "General comment" : "Comment"}
      className="space-y-2 border border-field bg-bezel p-3"
      {...attachHandlers(uploads)}
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
      onKeyDown={(ev) => {
        if (ev.key === "Escape") {
          ev.preventDefault();
          ev.stopPropagation();
          onCancel();
        } else if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
          ev.preventDefault();
          submit();
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="label text-[11px]">
          Kind{" "}
          <select className={field} value={kind} onChange={(e) => setKind(e.target.value as Draft["kind"])}>
            <option value="fix">Fix</option>
            <option value="keep">Keep</option>
            <option value="question">Question</option>
          </select>
        </label>
        {start !== null && (
          <>
            <label className="label text-[11px]">
              Start <input className={`${field} w-20 font-mono`} value={startText} onChange={(e) => setStartText(e.target.value)} />
            </label>
            <label className="label text-[11px]">
              End <input className={`${field} w-20 font-mono`} value={endText} placeholder="optional" onChange={(e) => setEndText(e.target.value)} />
            </label>
            <button type="button" className={btn} onClick={() => setEndText(formatTime(getNow(), true))}>
              Set end to now
            </button>
          </>
        )}
      </div>
      <textarea
        autoFocus
        aria-label="Comment text"
        className={`${field} h-24 w-full`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <AttachmentPicker uploads={uploads} />
      {error && <p role="alert" className="text-rec">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className={btn} disabled={uploads.blocking}>
          Add comment
        </button>
        <button type="button" className={btn} onClick={onCancel}>
          Cancel
        </button>
        <span className="text-[11px] text-dim self-center">Ctrl+Enter sends</span>
      </div>
    </form>
  );
}
