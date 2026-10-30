"use client";

import { useState } from "react";
import { useStorage, type StorageFile } from "@/lib/useStorage";
import { useDeletions, type DeleteKind } from "@/lib/useDeletions";
import { routeHash } from "@/lib/useHashRoute";
import { PendingDelete } from "./PendingDelete";
import { DeleteDialog } from "./DeleteDialog";
import { useAsk } from "./AskDialog";

const btn = "menu-pop label border-2 border-phosphor bg-ink px-3 py-1.5 text-xs text-phosphor hover:bg-phosphor hover:text-ink disabled:opacity-40";
const del = `${btn} border-rec! text-rec! hover:bg-rec! hover:text-ink!`;
const panel = "slab relative space-y-2 p-4";

export const size = (b: number | null) => (b === null ? "?" : b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${(b / 1e6).toFixed(1)} MB`);
const when = (t: number | null) => (t === null ? "never" : new Date(t * 1000).toLocaleString());

type Deleting = { kind: DeleteKind; targetId: number; label: string; title: string };

/** The streamer's view of everything on Drive, the clock gate and the Discord outbox. */
export function StorageView({ username }: { username: string }) {
  const { storage, drive, error, refresh, resetClock } = useStorage();
  const deletions = useDeletions(() => refresh());
  const me = { username, role: "admin" as const };
  const [deleting, setDeleting] = useState<Deleting | null>(null);
  const ask = useAsk();

  const groups = new Map<number, StorageFile[]>();
  for (const f of storage?.files ?? []) groups.set(f.project_id, [...(groups.get(f.project_id) ?? []), f]);

  // A live request shows its countdown + Undo in place of the Delete button.
  const deleteEntry = (kind: DeleteKind, targetId: number, label: string, title: string, text: string) => {
    const pending = deletions.find(kind, targetId);
    if (pending) return <PendingDelete request={pending} onUndo={deletions.undo} me={me} />;
    return (
      <button type="button" onClick={() => setDeleting({ kind, targetId, label, title })} className={del}>
        {text}
      </button>
    );
  };

  const paused = storage?.scheduler.paused_since ?? null;
  const discord = storage?.discord;
  return (
    <section className="space-y-6">
      <h2 tabIndex={-1} className="stencil tilt slam text-4xl">
        Storage
      </h2>
      {(error || storage?.drive_error) && (
        <p role="alert" className="text-rec">
          {error ?? storage?.drive_error}
        </p>
      )}

      {paused !== null && (
        <div role="alert" className="space-y-2 border border-amber p-4 text-amber">
          <p>
            The Mac Mini&apos;s clock is behind the last time it saw (since {when(paused)}), so deletes, reminders and backups are paused.
          </p>
          <button
            type="button"
            onClick={async () => {
              const yes = await ask.confirm({
                title: "Trust the clock again?",
                message: "Pending deletes get at most an hour from now.",
                confirmLabel: "Trust the clock",
              });
              if (yes) resetClock();
            }}
            className={btn}
          >
            Trust the clock again
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className={panel}>
          <h3 className="label text-sm text-dim">Google Drive</h3>
          <p>{drive === null ? "…" : !drive.connected ? "Not connected" : drive.error ?? (drive.layout ? "Connected" : "Connected, folders not set up")}</p>
          {storage?.quota && (
            <p className="text-sm text-dim">
              {size(storage.quota.usage)} used
              {storage.quota.limit !== null && ` of ${size(storage.quota.limit)} · ${size(storage.quota.free)} free`}
            </p>
          )}
        </div>
        {discord && (
          <div className={panel}>
            <h3 className="label text-sm text-dim">Discord DMs</h3>
            <p>{discord.enabled ? "On" : "Off"}</p>
            <p className="text-sm text-dim">
              {discord.pending} pending · last sent {when(discord.last_sent_at)}
            </p>
            {discord.last_error && <p className="text-sm text-rec">Last error: {discord.last_error}</p>}
          </div>
        )}
      </div>

      {deletions.pending.length > 0 && (
        <div className="space-y-2">
          <h3 className="label text-sm text-dim">Pending deletes</h3>
          <ul className="grid gap-2">
            {deletions.pending.map((r) => (
              <li key={r.id} className="slab slab-sm relative flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="font-bold">{r.label}</span>
                <span className="text-xs text-dim">by {r.requested_by}</span>
                <PendingDelete request={r} onUndo={deletions.undo} me={me} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {storage?.files && (
        <div className="space-y-2">
          <h3 className="label text-sm text-dim">App files</h3>
          {groups.size === 0 && <p className="text-sm text-dim">No files on Drive.</p>}
          {[...groups].map(([pid, files]) => {
            const name = files[0].project_name;
            const vod = files.find((f) => f.kind === "vod");
            const tapes = new Map<number, StorageFile[]>();
            for (const f of files) if (f.tape_id !== null) tapes.set(f.tape_id, [...(tapes.get(f.tape_id) ?? []), f]);
            return (
              <div key={pid} className={panel}>
                <div className="flex flex-wrap items-center gap-3">
                  <a href={routeHash({ view: "project", projectId: pid })} className="font-bold hover:underline">
                    {name}
                  </a>
                  <span className="text-xs text-dim">{size(files.reduce((n, f) => n + (f.size ?? 0), 0))}</span>
                  <span className="ml-auto">{deleteEntry("project", pid, name, `Delete ${name}`, "Delete project")}</span>
                </div>
                {vod && (
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span>VOD</span>
                    <span className="text-xs text-dim">{size(vod.size)}</span>
                    {vod.vod_filename && (vod.status === "ready" || deletions.find("vod", pid)) && (
                      <span className="ml-auto">{deleteEntry("vod", pid, vod.vod_filename, `Delete ${name}'s VOD`, "Delete VOD")}</span>
                    )}
                  </div>
                )}
                {[...tapes].map(([tid, tfiles]) => {
                  const tape = tfiles[0].tape_name ?? "";
                  return (
                    <div key={tid} className="flex flex-wrap items-center gap-3 text-sm">
                      <a href={routeHash({ view: "tape", projectId: pid, tapeId: tid })} className="hover:underline">
                        {tape}
                      </a>
                      <span className="text-xs text-dim">
                        {tfiles.map((f) => `${f.label.slice(tape.length + 1)} ${size(f.size)}`).join(" · ")}
                      </span>
                      <span className="ml-auto">{deleteEntry("tape_files", tid, tape, `Delete ${tape}'s files`, "Delete files")}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {deleting && (
        <DeleteDialog
          {...deleting}
          onClose={() => setDeleting(null)}
          onDone={() => {
            setDeleting(null);
            deletions.refresh();
            refresh();
          }}
        />
      )}
      {ask.dialog}
    </section>
  );
}
