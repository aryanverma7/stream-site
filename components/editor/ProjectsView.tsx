"use client";

import { useState } from "react";
import { duration, editorApi, recordDownload } from "@/lib/editorApi";
import { routeHash } from "@/lib/useHashRoute";
import { useProjects, type Project } from "@/lib/useProjects";
import { useDeletions, type DeleteRequest } from "@/lib/useDeletions";
import { StatusLabel } from "./StatusLabel";
import { PendingDelete } from "./PendingDelete";
import { DeleteDialog } from "./DeleteDialog";
import { useAsk } from "./AskDialog";
import { DownloadLink, OpenInDrive } from "./DriveLinks";

const btn = "menu-pop label border-2 border-phosphor bg-ink px-3 py-1.5 text-xs text-phosphor hover:bg-phosphor hover:text-ink disabled:opacity-40";
const card = "slab slab-sm relative flex flex-wrap items-center gap-3 px-4 py-3";

/**
 * Download, Open in Drive and Delete for a project's own file: a VOD, or a
 * clip's source (spec: clips are downloaded and deleted one by one, with the
 * normal two-step). The editor may delete only after his own Download click
 * (server-enforced); a live delete disables Download and hides Delete.
 */
function FileActions({ p, pending, role, onDownload, onDelete }: {
  p: Project;
  pending: DeleteRequest | undefined;
  role: "admin" | "editor";
  onDownload: () => void;
  onDelete: () => void;
}) {
  if (p.vod_status !== "ready" || !p.vod_file_id) return null;
  const clip = p.kind === "clip";
  return (
    <>
      <DownloadLink fileId={p.vod_file_id} disabled={!!pending} onClick={onDownload} className={btn}>
        {clip ? "Download clip" : "Download VOD"}
      </DownloadLink>
      <OpenInDrive fileId={p.vod_file_id} />
      {!pending && (role === "admin" || p.download_clicked_at !== null) && (
        <button type="button" onClick={onDelete} className={`${btn} border-rec! text-rec! hover:bg-rec! hover:text-ink!`}>
          {clip ? "Delete clip file" : "Delete VOD"}
        </button>
      )}
    </>
  );
}

/** Every project: VODs newest first, then clips oldest first with Combine / Uncombine. */
export function ProjectsView({ role, username }: { role: "admin" | "editor"; username: string }) {
  const { vods, clips, reels, error, refresh } = useProjects();
  // An Undo (or any delete appearing or finishing) changes the target too: refetch it.
  const deletions = useDeletions(() => refresh());
  const ask = useAsk();
  const me = { username, role };
  const [actionError, setActionError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [deleting, setDeleting] = useState<Project | null>(null);
  // A clip with any live delete (its file, or the whole project) cannot be combined; the server refuses it.
  const liveDelete = (id: number) => deletions.find("vod", id) ?? deletions.find("project", id);
  const chosen = selected.filter((id) => !liveDelete(id));

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  // Not awaited: the link opens on this same click. The refresh shows the editor's Delete once recorded.
  const download = (p: Project) => void recordDownload(p.id).then(refresh);

  const rename = async (p: Project) => {
    const name = await ask.prompt({ title: `Rename ${p.name}`, label: "New name", initial: p.name, confirmLabel: "Rename" });
    if (name && name !== p.name) run(() => editorApi(`/projects/${p.id}`, { method: "PATCH", body: { name } }).then(refresh));
  };

  const combine = async () => {
    const name = await ask.prompt({ title: "Combine into one reel", label: "Name for the combined reel", confirmLabel: "Combine" });
    if (!name) return;
    run(async () => {
      await editorApi("/clips/combine", { method: "POST", body: { project_ids: chosen, name } });
      setSelected([]);
      await refresh();
    });
  };

  return (
    <section className="space-y-6">
      <h2 tabIndex={-1} className="stencil tilt slam text-4xl">
        Projects
      </h2>
      {(error || actionError) && (
        <p role="alert" className="text-rec">
          {actionError ?? error}
        </p>
      )}

      <div className="space-y-2">
        <h3 className="label text-sm text-dim">VODs</h3>
        {vods.length === 0 && <p className="text-sm text-dim">No VODs yet.</p>}
        <ul className="grid gap-2">
          {vods.map((p) => {
            const pending = deletions.find("vod", p.id) ?? deletions.find("project", p.id);
            return (
              <li key={p.id} className={card}>
                <span className="osd text-lg text-dim">{p.stream_date}</span>
                <a href={routeHash({ view: "project", projectId: p.id })} className="font-bold hover:underline">
                  {p.name}
                </a>
                {p.has_new && <span className="tag bg-field text-[11px] text-ink">New</span>}
                <span className="label text-[11px] text-dim">VOD {p.vod_status}</span>
                <span className="text-xs text-dim">{p.tape_count === 1 ? "1 tape" : `${p.tape_count} tapes`}</span>
                {pending && <PendingDelete request={pending} onUndo={deletions.undo} me={me} />}
                <span className="ml-auto flex flex-wrap items-center gap-2">
                  {role === "admin" && (
                    <button type="button" onClick={() => rename(p)} className={btn}>
                      Rename
                    </button>
                  )}
                  <FileActions p={p} pending={pending} role={role} onDownload={() => download(p)} onDelete={() => setDeleting(p)} />
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h3 className="label text-sm text-dim">Clips</h3>
          <button type="button" disabled={chosen.length < 2} onClick={combine} className={`${btn} ml-auto`}>
            Combine{chosen.length >= 2 ? ` ${chosen.length}` : ""}
          </button>
        </div>
        {clips.length === 0 && <p className="text-sm text-dim">No clips yet.</p>}
        <ul className="grid gap-2">
          {clips.map((c) => {
            const reel = c.reel_tape_id === null ? undefined : reels[c.reel_tape_id];
            const combined = !!reel && reel.source_project_ids.length >= 2;
            const pending = liveDelete(c.id);
            // The server refuses both while any clip involved is being deleted.
            const reelLocked = !!reel && reel.source_project_ids.some((id) => deletions.find("project", id));
            return (
              <li key={c.id} className={card}>
                <input
                  type="checkbox"
                  aria-label={`Select ${c.name}`}
                  disabled={!!pending}
                  checked={selected.includes(c.id) && !pending}
                  onChange={(e) => setSelected((s) => (e.target.checked ? [...s, c.id] : s.filter((id) => id !== c.id)))}
                />
                {pending && <span className="label text-[11px] text-dim">Being deleted</span>}
                <a href={routeHash({ view: "project", projectId: c.id })} className="font-bold hover:underline">
                  {c.name}
                </a>
                <span className="osd text-lg text-dim">{c.duration_s === null ? "" : duration(c.duration_s)}</span>
                {c.has_new && <span className="tag bg-field text-[11px] text-ink">New</span>}
                {reel && <StatusLabel status={reel.status} />}
                {pending && <PendingDelete request={pending} onUndo={deletions.undo} me={me} />}
                <span className="ml-auto flex flex-wrap items-center gap-2">
                  {combined && (
                    <span className="flex items-center gap-2 text-xs text-dim">
                      used in
                      <a href={routeHash({ view: "tape", projectId: reel.project_id, tapeId: reel.id })} className="text-phosphor hover:underline">
                        {reel.name}
                      </a>
                      {/* The reel lives in its first clip's project: one Uncombine, on that card. */}
                      {reel.project_id === c.id && !reelLocked && (
                        <button type="button" onClick={() => run(() => editorApi(`/tapes/${reel.id}/uncombine`, { method: "POST" }).then(refresh))} className={btn}>
                          Uncombine
                        </button>
                      )}
                    </span>
                  )}
                  <FileActions p={c} pending={pending} role={role} onDownload={() => download(c)} onDelete={() => setDeleting(c)} />
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {deleting && (
        <DeleteDialog
          kind="vod"
          targetId={deleting.id}
          label={deleting.vod_filename}
          title={deleting.kind === "clip" ? `Delete ${deleting.name}'s clip file` : `Delete ${deleting.name}'s VOD`}
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
