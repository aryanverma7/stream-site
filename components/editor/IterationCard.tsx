"use client";

import { useEffect, useRef, useState } from "react";
import { duration, editorApi } from "@/lib/editorApi";
import { routeHash } from "@/lib/useHashRoute";
import { useTransfers } from "@/lib/useTransfers";
import { useRunChecks } from "@/lib/useRunChecks";
import type { Checks, CheckState, Iteration } from "@/lib/useTape";
import type { Tape, TapeStatus } from "@/lib/useProject";
import { StatusSelect } from "./StatusLabel";
import { DownloadLink, OpenInDrive } from "./DriveLinks";
import { useAsk } from "./AskDialog";

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
          <span key={key} title={`${label}: ${value}`} className={`label inline-block -skew-x-6 border-2 px-1.5 py-0.5 text-[10px] ${TONE[state]}`}>
            {label} {state}
          </span>
        );
      })}
    </span>
  );
}

/** The measured length (spec: duration is shown, not checked); nothing when it was not measured. */
function Duration({ checks }: { checks: Checks | null }) {
  const s = checks && typeof checks === "object" ? checks.duration_s : null;
  return typeof s === "number" && Number.isFinite(s) && s > 0 ? <span className="osd text-lg text-dim">{duration(s)}</span> : null;
}

export function Thumbnail({ iteration }: { iteration: Iteration }) {
  return iteration.has_thumbnail ? (
    // eslint-disable-next-line @next/next/no-img-element -- static export, backend-served JPEG
    <img src={`/api/editor/iterations/${iteration.id}/thumbnail`} alt="" className="aspect-video w-full bg-ink object-cover" />
  ) : (
    <div className="noise aspect-video w-full opacity-15" aria-hidden />
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

const btn = "menu-pop label border-2 border-phosphor bg-ink px-2 py-1 text-[11px] text-phosphor hover:bg-phosphor hover:text-ink disabled:opacity-40";

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
  onChanged,
}: {
  iteration: Iteration;
  tape: Tape;
  role: "admin" | "editor";
  onStatus: (s: TapeStatus) => void;
  /** A delete covering this version is in its undo hour. */
  locked: boolean;
  /** The version changed on the server (an upload was cancelled): refetch the tape. */
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ask = useAsk();
  const [cancelError, setCancelError] = useState<string | null>(null);
  const ready = iteration.status === "ready";
  // An upload this tab is sending has its own Cancel in the Transfers panel; the card's is for an orphan
  // (closed tab, other computer), which otherwise blocks the tape's deletes for 8 days.
  const sendingHere = useTransfers().some((t) => t.tapeId === tape.id && t.version === iteration.version && t.state !== "done" && t.state !== "failed");
  const cancelUpload = async () => {
    const yes = await ask.confirm({
      title: `Cancel the upload of v${iteration.version}?`,
      message: "Dropping the same file again later picks it up.",
      confirmLabel: "Cancel upload",
      cancelLabel: "Keep it",
      danger: true,
    });
    if (!yes) return;
    setCancelError(null);
    try {
      await editorApi(`/iterations/${iteration.id}/abandon`, { method: "POST" });
      onChanged?.();
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "Could not cancel the upload");
    }
  };
  // No checks on a ready version: its tab closed while checking, or reconcile completed it. Pick the file again.
  const checks = useRunChecks(iteration, tape.kind, onChanged);
  const picker = useRef<HTMLInputElement>(null);
  const canRunChecks = ready && !iteration.checks && !sendingHere;
  const play = routeHash({ view: "iteration", projectId: tape.project_id, tapeId: tape.id, iterationId: iteration.id });
  return (
    <article className="slab slab-sm group relative p-[3px]">
      <Thumbnail iteration={iteration} />
      <div className="space-y-2 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="osd text-2xl">v{iteration.version}</h4>
          <Duration checks={iteration.checks} />
          {!ready && <span className="label text-[11px] text-amber">{iteration.status}</span>}
          <button type="button" aria-expanded={open} aria-label={`v${iteration.version} menu`} onClick={() => setOpen(!open)} className={btn}>
            ⋯
          </button>
        </div>
        <CheckBadges checks={iteration.checks} />
        {canRunChecks && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btn} disabled={checks.running} onClick={() => picker.current?.click()}>
              {checks.running ? "Checking…" : "Run checks"}
            </button>
            <span className="text-[11px] text-dim">Pick {iteration.filename} again; it stays on this computer.</span>
            <input
              ref={picker}
              type="file"
              accept="video/*"
              hidden
              aria-label={`File for v${iteration.version}'s checks`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = ""; // the same file can be picked again after a refusal
                if (f) void checks.run(f);
              }}
            />
          </div>
        )}
        {checks.error && (
          <p role="alert" className="text-xs text-rec">
            {checks.error}
          </p>
        )}
        {ready && <CommentSummary iterationId={iteration.id} />}
        {cancelError && (
          <p role="alert" className="text-xs text-rec">
            {cancelError}
          </p>
        )}
        <div className={`${open ? "flex" : "hidden"} flex-wrap items-center gap-2 group-hover:flex group-focus-within:flex`}>
          {ready && (
            <a href={play} className={btn}>
              Play
            </a>
          )}
          {ready && (
            <button
              type="button"
              className={btn}
              onClick={() => {
                try {
                  sessionStorage.setItem("editor.openComposer", String(iteration.id)); // only that version opens it
                } catch {
                  /* the player just opens without the composer */
                }
                window.location.hash = play;
              }}
            >
              Add comment
            </button>
          )}
          <StatusSelect name={tape.name} status={tape.status} role={role} onChange={onStatus} />
          {iteration.status === "uploading" && !sendingHere && (
            <button type="button" className={btn} onClick={cancelUpload}>
              Cancel this upload
            </button>
          )}
          {ready && iteration.drive_file_id && (
            <DownloadLink fileId={iteration.drive_file_id} disabled={locked} className={btn}>
              Download
            </DownloadLink>
          )}
        </div>
      </div>
      {ask.dialog}
    </article>
  );
}

/**
 * The version route until Plan 5B's player: details, Download and Open in
 * Drive, both built from the file id (no media-link, so no token in the page).
 */
export function IterationDetails({ iterationId }: { iterationId: number }) {
  const [it, setIt] = useState<Iteration | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    editorApi<{ iteration: Iteration }>(`/iterations/${iterationId}`)
      .then(({ iteration }) => live && setIt(iteration))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [iterationId]);

  return (
    <section className="space-y-4">
      <h2 tabIndex={-1} className="stencil tilt slam text-4xl">
        {it ? `Version ${it.version}` : "Version"}
      </h2>
      {error && <p className="text-rec">{error}</p>}
      {it && (
        <div className="slab relative grid gap-4 p-4 sm:grid-cols-[minmax(0,24rem)_1fr]">
          <Thumbnail iteration={it} />
          <div className="space-y-3 text-sm">
            <p className="font-mono break-all">{it.filename}</p>
            <p className="text-dim">
              {it.uploaded_at ? `Uploaded ${new Date(it.uploaded_at * 1000).toLocaleString()}` : `Upload ${it.status}`}
            </p>
            <Duration checks={it.checks} />
            <CheckBadges checks={it.checks} />
            {it.status === "ready" && it.drive_file_id && (
              <div className="flex flex-wrap items-center gap-3">
                <DownloadLink fileId={it.drive_file_id} className={btn}>
                  Download
                </DownloadLink>
                <OpenInDrive fileId={it.drive_file_id} />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
