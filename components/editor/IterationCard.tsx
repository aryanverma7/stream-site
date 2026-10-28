"use client";

import { useEffect, useState } from "react";
import { driveDownload, editorApi } from "@/lib/editorApi";
import { routeHash } from "@/lib/useHashRoute";
import type { Checks, CheckState, Iteration } from "@/lib/useTape";
import type { Tape, TapeStatus } from "@/lib/useProject";
import { StatusSelect } from "./StatusLabel";

const CHECKS = [
  ["resolution", "Resolution"],
  ["fps", "Frame rate"],
  ["bitrate", "Bitrate"],
] as const;
const STATES: CheckState[] = ["pass", "warn", "fail", "unknown"];
const TONE: Record<CheckState, string> = {
  pass: "border-signal text-signal",
  warn: "border-amber text-amber",
  fail: "border-rec text-rec",
  unknown: "border-seam text-dim",
};

/**
 * Pass/warn/fail/unknown per check, the measured value in the tooltip.
 * Anything missing or malformed reads "unknown" - never a pass.
 */
export function CheckBadges({ checks }: { checks: Checks | null }) {
  if (!checks || typeof checks !== "object") return <span className="text-xs text-dim">Checks pending</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {CHECKS.map(([key, label]) => {
        const c = checks[key];
        const state = c && STATES.includes(c.state as CheckState) ? (c.state as CheckState) : "unknown";
        const value = c?.value === undefined || c?.value === null ? "not measured" : String(c.value);
        return (
          <span key={key} title={`${label}: ${value}`} className={`label border px-1.5 py-0.5 text-[10px] ${TONE[state]}`}>
            {label} {state}
          </span>
        );
      })}
    </span>
  );
}

export function Thumbnail({ iteration }: { iteration: Iteration }) {
  return iteration.has_thumbnail ? (
    // eslint-disable-next-line @next/next/no-img-element -- static export, backend-served JPEG
    <img src={`/api/editor/iterations/${iteration.id}/thumbnail`} alt="" className="aspect-video w-full bg-ink object-cover" />
  ) : (
    <div className="noise aspect-video w-full opacity-30" aria-hidden />
  );
}

/** "3 of 5 resolved", from the version's own comments; fetched once, when the card mounts. */
function CommentSummary({ iterationId }: { iterationId: number }) {
  const [text, setText] = useState("");
  useEffect(() => {
    let live = true;
    editorApi<{ comments: { resolved: boolean }[] }>(`/iterations/${iterationId}`)
      .then(({ comments }) => {
        if (!live) return;
        const done = comments.filter((c) => c.resolved).length;
        setText(comments.length ? `${done} of ${comments.length} resolved` : "No comments");
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [iterationId]);
  return <span className="text-xs text-dim">{text}</span>;
}

const btn = "label border border-seam px-2 py-1 text-[11px] text-phosphor hover:border-field disabled:opacity-40";

/**
 * One version on a tape. Its menu opens on hover (and keyboard focus) on a
 * pointer, and on the ⋯ button on touch.
 */
export function IterationCard({
  iteration,
  tape,
  role,
  onStatus,
  locked,
}: {
  iteration: Iteration;
  tape: Tape;
  role: "admin" | "editor";
  onStatus: (s: TapeStatus) => void;
  /** A delete covering this version is in its undo hour. */
  locked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ready = iteration.status === "ready";
  const play = routeHash({ view: "iteration", projectId: tape.project_id, tapeId: tape.id, iterationId: iteration.id });
  return (
    <article className="group relative border border-seam bg-bezel">
      <Thumbnail iteration={iteration} />
      <div className="space-y-2 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="osd text-2xl">v{iteration.version}</h4>
          {!ready && <span className="label text-[11px] text-amber">{iteration.status}</span>}
          <button type="button" aria-expanded={open} aria-label={`v${iteration.version} menu`} onClick={() => setOpen(!open)} className={btn}>
            ⋯
          </button>
        </div>
        <CheckBadges checks={iteration.checks} />
        {ready && <CommentSummary iterationId={iteration.id} />}
        <div className={`${open ? "flex" : "hidden"} flex-wrap items-center gap-2 group-hover:flex group-focus-within:flex`}>
          {ready && (
            <a href={play} className={btn}>
              Play
            </a>
          )}
          <StatusSelect name={tape.name} status={tape.status} role={role} onChange={onStatus} />
          {ready && iteration.drive_file_id && (
            <button type="button" disabled={locked} onClick={() => driveDownload(iteration.drive_file_id!)} className={btn}>
              Download
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * The version route until Plan 5B's player: details, Download and Open in
 * Drive. The Drive link comes from media-link; its access token is dropped
 * on the floor, never kept.
 */
export function IterationDetails({ iterationId }: { iterationId: number }) {
  const [it, setIt] = useState<Iteration | null>(null);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    editorApi<{ iteration: Iteration }>(`/iterations/${iterationId}`)
      .then(({ iteration }) => {
        if (!live) return;
        setIt(iteration);
        if (iteration.status === "ready") {
          return editorApi<{ drive_url: string | null }>(`/iterations/${iterationId}/media-link`).then(
            (r) => live && setDriveUrl(r.drive_url),
          );
        }
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [iterationId]);

  return (
    <section className="space-y-4">
      <h2 tabIndex={-1} className="stencil text-4xl">
        {it ? `Version ${it.version}` : "Version"}
      </h2>
      {error && <p className="text-rec">{error}</p>}
      {it && (
        <div className="grid gap-4 border border-seam bg-bezel p-4 sm:grid-cols-[minmax(0,24rem)_1fr]">
          <Thumbnail iteration={it} />
          <div className="space-y-3 text-sm">
            <p className="font-mono break-all">{it.filename}</p>
            <p className="text-dim">
              {it.uploaded_at ? `Uploaded ${new Date(it.uploaded_at * 1000).toLocaleString()}` : `Upload ${it.status}`}
            </p>
            <CheckBadges checks={it.checks} />
            <div className="flex flex-wrap items-center gap-3">
              {it.status === "ready" && it.drive_file_id && (
                <button type="button" onClick={() => driveDownload(it.drive_file_id!)} className={btn}>
                  Download
                </button>
              )}
              {driveUrl && (
                <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-dim hover:text-phosphor">
                  Open in Drive ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
