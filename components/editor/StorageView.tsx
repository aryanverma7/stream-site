"use client";

import { useState } from "react";
import { useStorage, type StorageFile } from "@/lib/useStorage";
import { useProjects, type Project } from "@/lib/useProjects";
import { useDeletions, type DeleteKind } from "@/lib/useDeletions";
import { routeHash } from "@/lib/useHashRoute";
import { PendingDelete } from "./PendingDelete";
import { DeleteDialog } from "./DeleteDialog";

const btn = "label border border-seam px-3 py-1.5 text-xs text-phosphor hover:border-field disabled:opacity-40";
const del = `${btn} border-rec text-rec`;
const panel = "space-y-2 border border-seam bg-bezel p-4";

export const size = (b: number | null) => (b === null ? "?" : b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${(b / 1e6).toFixed(1)} MB`);
const when = (t: number | null) => (t === null ? "never" : new Date(t * 1000).toLocaleString());
// storage_view labels an iteration "<tape name> v<version>"; the tape's name is what a delete confirms.
const tapeName = (f: StorageFile) => f.label.replace(/ v\d+$/, "");

type Deleting = { kind: DeleteKind; targetId: number; label: string; title: string };

/** The streamer's view of everything on Drive, the clock gate and the Discord outbox. */
export function StorageView({ username }: { username: string }) {
  const { storage, drive, error, refresh, resetClock } = useStorage();
  const projects = useProjects();
  const deletions = useDeletions(() => {
    refresh();
    projects.refresh();
  });
  const me = { username, role: "admin" as const };
  const [deleting, setDeleting] = useState<Deleting | null>(null);

  const byId = new Map<number, Project>([...projects.vods, ...projects.clips].map((p) => [p.id, p]));
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
      <h2 tabIndex={-1} className="stencil text-4xl">
        Storage
      </h2>
      {error && (
        <p role="alert" className="text-rec">
          {error}
        </p>
      )}

      {paused !== null && (
        <div role="alert" className="space-y-2 border border-amber p-4 text-amber">
          <p>
            The Mac Mini&apos;s clock is behind the last time it saw (since {when(paused)}), so deletes, reminders and backups are paused.
          </p>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Trust the Mac Mini's clock again? Pending deletes get at most an hour from now.")) resetClock();
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
          {storage && (
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
              <li key={r.id} className="flex flex-wrap items-center gap-3 border border-seam bg-bezel px-4 py-3">
                <span className="font-bold">{r.label}</span>
                <span className="text-xs text-dim">by {r.requested_by}</span>
                <PendingDelete request={r} onUndo={deletions.undo} me={me} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {storage && (
        <div className="space-y-2">
          <h3 className="label text-sm text-dim">App files</h3>
          {groups.size === 0 && <p className="text-sm text-dim">No files on Drive.</p>}
          {[...groups].map(([pid, files]) => {
            const p = byId.get(pid);
            const vod = files.find((f) => f.kind === "vod");
            const tapes = new Map<number, StorageFile[]>();
            for (const f of files) if (f.tape_id !== null) tapes.set(f.tape_id, [...(tapes.get(f.tape_id) ?? []), f]);
            return (
              <div key={pid} className={panel}>
                <div className="flex flex-wrap items-center gap-3">
                  <a href={routeHash({ view: "project", projectId: pid })} className="font-bold hover:underline">
                    {p?.name ?? `Project ${pid}`}
                  </a>
                  <span className="text-xs text-dim">{size(files.reduce((n, f) => n + (f.size ?? 0), 0))}</span>
                  {p && <span className="ml-auto">{deleteEntry("project", pid, p.name, `Delete ${p.name}`, "Delete project")}</span>}
                </div>
                {vod && (
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span>VOD</span>
                    <span className="text-xs text-dim">{size(vod.size)}</span>
                    {p && (vod.status === "ready" || deletions.find("vod", pid)) && (
                      <span className="ml-auto">{deleteEntry("vod", pid, p.vod_filename, `Delete ${p.name}'s VOD`, "Delete VOD")}</span>
                    )}
                  </div>
                )}
                {[...tapes].map(([tid, tfiles]) => {
                  const name = tapeName(tfiles[0]);
                  return (
                    <div key={tid} className="flex flex-wrap items-center gap-3 text-sm">
                      <a href={routeHash({ view: "tape", projectId: pid, tapeId: tid })} className="hover:underline">
                        {name}
                      </a>
                      <span className="text-xs text-dim">
                        {tfiles.map((f) => `${f.label.slice(name.length + 1)} ${size(f.size)}`).join(" · ")}
                      </span>
                      <span className="ml-auto">{deleteEntry("tape_files", tid, name, `Delete ${name}'s files`, "Delete files")}</span>
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
    </section>
  );
}
