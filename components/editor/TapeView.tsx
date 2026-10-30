"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { editorApi } from "@/lib/editorApi";
import { useTape } from "@/lib/useTape";
import { useDeletions } from "@/lib/useDeletions";
import type { TapeStatus } from "@/lib/useProject";
import { StatusSelect } from "./StatusLabel";
import { IterationCard } from "./IterationCard";
import { PendingDelete } from "./PendingDelete";
import { DeleteDialog } from "./DeleteDialog";
import { useAsk } from "./AskDialog";
import { UploadDrop } from "./UploadDrop";
import { DownloadLink, OpenInDrive } from "./DriveLinks";

const btn = "menu-pop label border-2 border-phosphor bg-ink px-3 py-2 text-xs text-phosphor hover:bg-phosphor hover:text-ink disabled:opacity-40";
const field = "w-full border border-seam bg-ink px-3 py-2 text-sm text-phosphor";
const SAVE_AFTER_MS = 1_000;

export type Delay = (fn: () => void, ms: number) => () => void;
const timeout: Delay = (fn, ms) => {
  const t = setTimeout(fn, ms);
  return () => clearTimeout(t);
};

/**
 * Saves a field's draft a second after typing stops, and on unmount (leaving
 * the tape mid-edit), each draft at most once. The returned flush is for blur.
 */
function useAutosave(draft: string | null, save: (v: string) => void, delay: Delay) {
  const latest = useRef({ draft, save });
  useEffect(() => {
    latest.current = { draft, save };
  });
  const sent = useRef<string | null>(null);
  const flush = useCallback(() => {
    const { draft: d, save: s } = latest.current;
    if (d === null || d === sent.current) return;
    sent.current = d;
    s(d);
  }, []);
  useEffect(() => {
    if (draft !== null) return delay(flush, SAVE_AFTER_MS);
    sent.current = null; // editing ended: the next edit starts afresh
  }, [draft, delay, flush]);
  useEffect(() => flush, [flush]);
  return flush;
}

/** A tape: its name, notes and status, its versions newest first, and the Final download. */
export function TapeView({
  projectId,
  tapeId,
  role,
  username,
  delay = timeout,
}: {
  projectId: number;
  tapeId: number;
  role: "admin" | "editor";
  username: string;
  delay?: Delay;
}) {
  const { tape, iterations, error, refresh, update } = useTape(tapeId);
  // An Undo (or any delete appearing or finishing) changes the target too: refetch it.
  const deletions = useDeletions(() => refresh());
  const me = { username, role };
  const [actionError, setActionError] = useState<string | null>(null);
  const ask = useAsk();
  // null = not being edited, so the field shows the server's value.
  const [name, setName] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = role === "admin";
  const newestFirst = [...iterations].reverse();
  const latest = newestFirst.find((i) => i.status === "ready");
  const isFinal = tape?.status === "final";
  const filesDelete = deletions.find("tape_files", tapeId);
  const projectDelete = deletions.find("project", projectId);
  const locked = !!(filesDelete || projectDelete);

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  const setStatus = (status: TapeStatus) => run(() => update({ status }));
  const saveName = useAutosave(
    name,
    (v) => {
      const next = v.trim();
      if (tape && next && next !== tape.name) void run(() => update({ name: next }));
    },
    delay,
  );
  const saveNotes = useAutosave(
    notes,
    (v) => {
      if (tape && v !== tape.notes) void run(() => update({ notes: v }));
    },
    delay,
  );

  // One h2 in the same place loading or loaded, so the focus the shell gives it survives the load.
  const heading = (
    <h2 tabIndex={-1} className="stencil tilt slam text-4xl">
      {tape?.name ?? "Tape"}
    </h2>
  );
  if (!tape) {
    return (
      <section className="space-y-5">
        {heading}
        {error ? <p className="text-rec">{error}</p> : <p className="osd text-xl text-dim">Loading…</p>}
      </section>
    );
  }

  return (
    <section className="space-y-5">
      {heading}
      <div className="flex flex-wrap items-center gap-3">
        {filesDelete && <PendingDelete request={filesDelete} onUndo={deletions.undo} me={me} />}
        {projectDelete && <PendingDelete request={projectDelete} onUndo={deletions.undo} me={me} />}
      </div>
      {actionError && (
        <p role="alert" className="text-rec">
          {actionError}
        </p>
      )}

      <div className="slab relative grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
        <label className="space-y-1 text-xs text-dim">
          <span className="label">Name</span>
          <input
            value={name ?? tape.name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              saveName();
              setName(null);
            }}
            className={field}
          />
        </label>
        <div className="space-y-1 text-xs text-dim">
          <span className="label block">Status</span>
          <StatusSelect name={tape.name} status={tape.status} role={role} onChange={setStatus} />
        </div>
        <label className="space-y-1 text-xs text-dim sm:col-span-2">
          <span className="label">Notes</span>
          <textarea
            rows={3}
            value={notes ?? tape.notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              saveNotes();
              setNotes(null);
            }}
            className={field}
          />
        </label>
      </div>

      {isFinal && latest?.drive_file_id && !tape.files_deleted_at && (
        <div className="slab slab-ok relative flex flex-wrap items-center gap-3 p-4">
          <span className="label text-sm text-signal">Final: v{latest.version}</span>
          <DownloadLink fileId={latest.drive_file_id} disabled={locked} className={btn}>
            Download Final
          </DownloadLink>
          <OpenInDrive fileId={latest.drive_file_id} />
          {isAdmin && !locked && (
            <button type="button" onClick={() => setDeleting(true)} className={`${btn} ml-auto border-rec! text-rec! hover:bg-rec! hover:text-ink!`}>
              Delete files
            </button>
          )}
        </div>
      )}

      {isAdmin && latest && (
        <button
          type="button"
          onClick={async () => {
            const yes = await ask.confirm({
              title: `Start over on v${latest.version}?`,
              message: "Every open comment on it is marked resolved.",
              confirmLabel: "Start over",
              danger: true,
            });
            if (!yes) return;
            run(() => editorApi(`/iterations/${latest.id}/start-over`, { method: "POST" }).then(refresh));
          }}
          className={btn}
        >
          Start over on v{latest.version}
        </button>
      )}

      <UploadDrop tapeId={tapeId} projectId={projectId} kind={tape.kind} disabled={locked} onUploaded={refresh} />

      {newestFirst.length === 0 ? (
        <p className="text-sm text-dim">No versions yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {newestFirst.map((it) => (
            <IterationCard key={it.id} iteration={it} tape={tape} role={role} onStatus={setStatus} locked={locked} onChanged={refresh} />
          ))}
        </div>
      )}

      {deleting && (
        <DeleteDialog
          kind="tape_files"
          targetId={tapeId}
          label={tape.name}
          title={`Delete ${tape.name}'s files`}
          onClose={() => setDeleting(false)}
          onDone={() => {
            setDeleting(false);
            deletions.refresh();
            refresh();
          }}
        />
      )}
      {ask.dialog}
    </section>
  );
}
