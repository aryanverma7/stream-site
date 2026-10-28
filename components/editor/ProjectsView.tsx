"use client";

import { useState } from "react";
import { driveDownload, editorApi } from "@/lib/editorApi";
import { routeHash } from "@/lib/useHashRoute";
import { useProjects, type Project } from "@/lib/useProjects";
import { useDeletions } from "@/lib/useDeletions";
import { StatusLabel } from "./StatusLabel";
import { PendingDelete } from "./PendingDelete";
import { DeleteDialog } from "./DeleteDialog";

const btn = "label border border-seam px-3 py-1.5 text-xs text-phosphor hover:border-field disabled:opacity-40";
const card = "flex flex-wrap items-center gap-3 border border-seam bg-bezel px-4 py-3";

const duration = (s: number | null) => (s === null ? "" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);

/** Every project: VODs newest first, then clips oldest first with Combine / Uncombine. */
export function ProjectsView({ role, username }: { role: "admin" | "editor"; username: string }) {
  const { vods, clips, reels, error, refresh } = useProjects();
  // An Undo (or any delete appearing or finishing) changes the target too: refetch it.
  const deletions = useDeletions(() => refresh());
  const me = { username, role };
  const [actionError, setActionError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [driveUrls, setDriveUrls] = useState<Record<number, string | null>>({});
  const [deleting, setDeleting] = useState<Project | null>(null);

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  // Records the editor's click server-side (what lets them delete the VOD), then downloads.
  const download = (p: Project) =>
    run(async () => {
      const link = await editorApi<{ drive_url: string | null }>(`/projects/${p.id}/download`, { method: "POST" });
      setDriveUrls((u) => ({ ...u, [p.id]: link.drive_url }));
      driveDownload(p.vod_file_id!);
      await refresh();
    });

  const rename = (p: Project) => {
    const name = window.prompt("New name", p.name)?.trim();
    if (name && name !== p.name) run(() => editorApi(`/projects/${p.id}`, { method: "PATCH", body: { name } }).then(refresh));
  };

  const combine = () => {
    const name = window.prompt("Name for the combined reel")?.trim();
    if (!name) return;
    run(async () => {
      await editorApi("/clips/combine", { method: "POST", body: { project_ids: selected, name } });
      setSelected([]);
      await refresh();
    });
  };

  return (
    <section className="space-y-6">
      <h2 tabIndex={-1} className="stencil text-4xl">
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
            const ready = p.vod_status === "ready" && !!p.vod_file_id;
            return (
              <li key={p.id} className={card}>
                <span className="osd text-lg text-dim">{p.stream_date}</span>
                <a href={routeHash({ view: "project", projectId: p.id })} className="font-bold hover:underline">
                  {p.name}
                </a>
                {p.has_new && <span className="label bg-field px-1.5 text-[11px] text-ink">New</span>}
                <span className="label text-[11px] text-dim">VOD {p.vod_status}</span>
                <span className="text-xs text-dim">{p.tape_count === 1 ? "1 tape" : `${p.tape_count} tapes`}</span>
                {pending && <PendingDelete request={pending} onUndo={deletions.undo} me={me} />}
                <span className="ml-auto flex flex-wrap items-center gap-2">
                  {ready && (
                    <button type="button" disabled={!!pending} onClick={() => download(p)} className={btn}>
                      Download VOD
                    </button>
                  )}
                  {driveUrls[p.id] && (
                    <a href={driveUrls[p.id]!} target="_blank" rel="noopener noreferrer" className="text-xs text-dim hover:text-phosphor">
                      Open in Drive ↗
                    </a>
                  )}
                  {role === "admin" && (
                    <button type="button" onClick={() => rename(p)} className={btn}>
                      Rename
                    </button>
                  )}
                  {ready && !pending && (role === "admin" || p.download_clicked_at !== null) && (
                    <button type="button" onClick={() => setDeleting(p)} className={`${btn} border-rec text-rec`}>
                      Delete VOD
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h3 className="label text-sm text-dim">Clips</h3>
          <button type="button" disabled={selected.length < 2} onClick={combine} className={`${btn} ml-auto`}>
            Combine{selected.length >= 2 ? ` ${selected.length}` : ""}
          </button>
        </div>
        {clips.length === 0 && <p className="text-sm text-dim">No clips yet.</p>}
        <ul className="grid gap-2">
          {clips.map((c) => {
            const reel = c.reel_tape_id === null ? undefined : reels[c.reel_tape_id];
            const combined = !!reel && reel.source_project_ids.length >= 2;
            const pending = deletions.find("project", c.id);
            return (
              <li key={c.id} className={card}>
                <input
                  type="checkbox"
                  aria-label={`Select ${c.name}`}
                  checked={selected.includes(c.id)}
                  onChange={(e) => setSelected((s) => (e.target.checked ? [...s, c.id] : s.filter((id) => id !== c.id)))}
                />
                <a href={routeHash({ view: "project", projectId: c.id })} className="font-bold hover:underline">
                  {c.name}
                </a>
                <span className="osd text-lg text-dim">{duration(c.duration_s)}</span>
                {c.has_new && <span className="label bg-field px-1.5 text-[11px] text-ink">New</span>}
                {reel && <StatusLabel status={reel.status} />}
                {pending && <PendingDelete request={pending} onUndo={deletions.undo} me={me} />}
                {combined && (
                  <span className="ml-auto flex items-center gap-2 text-xs text-dim">
                    used in
                    <a href={routeHash({ view: "tape", projectId: reel.project_id, tapeId: reel.id })} className="text-phosphor hover:underline">
                      {reel.name}
                    </a>
                    {/* The reel lives in its first clip's project: one Uncombine, on that card. */}
                    {reel.project_id === c.id && (
                      <button type="button" onClick={() => run(() => editorApi(`/tapes/${reel.id}/uncombine`, { method: "POST" }).then(refresh))} className={btn}>
                        Uncombine
                      </button>
                    )}
                  </span>
                )}
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
          title={`Delete ${deleting.name}'s VOD`}
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
