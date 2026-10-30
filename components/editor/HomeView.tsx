"use client";

import { useState } from "react";
import { recordDownload } from "@/lib/editorApi";
import { routeHash } from "@/lib/useHashRoute";
import { useHome, type HomeData } from "@/lib/useHome";
import { useDeletions } from "@/lib/useDeletions";
import { StatusLabel } from "./StatusLabel";
import { DeleteDialog } from "./DeleteDialog";
import { PendingDelete } from "./PendingDelete";
import { DownloadLink, OpenInDrive } from "./DriveLinks";

const btn = "label border border-seam px-3 py-1.5 text-xs text-phosphor hover:border-field disabled:opacity-40";
const card = "flex flex-wrap items-center gap-3 border border-seam bg-bezel px-4 py-3";

type HomeProject = HomeData["vods_ready"][number];

function ProjectLink({ p }: { p: HomeProject }) {
  return (
    <>
      <span className="osd text-lg text-dim">{p.stream_date}</span>
      <a href={routeHash({ view: "project", projectId: p.id })} className="font-bold hover:underline">
        {p.name}
      </a>
    </>
  );
}

/** What is waiting on someone: VODs to download, downloaded VODs to delete, tapes with open comments. */
export function HomeView({ role, username }: { role: "admin" | "editor"; username: string }) {
  const { home, error, refresh } = useHome();
  // The streamer can schedule a VOD delete before anyone downloads it; it shows here too.
  const deletions = useDeletions(() => refresh());
  const me = { username, role };
  const [deleting, setDeleting] = useState<HomeProject | null>(null);
  // The server leaves limbo projects out already; an older backend may not.
  const live = (projectId: number) => !deletions.find("project", projectId);
  const vodsReady = home?.vods_ready.filter((p) => live(p.id)) ?? [];
  const toConfirm = home?.deletes_to_confirm.filter((p) => live(p.id)) ?? [];
  const openTapes = home?.open_tapes.filter((o) => live(o.tape.project_id)) ?? [];

  return (
    <section className="space-y-6">
      <h2 tabIndex={-1} className="stencil text-4xl">
        Home
      </h2>
      {error && (
        <p role="alert" className="text-rec">
          {error}
        </p>
      )}
      {home && (
        <>
          <div className="space-y-2">
            <h3 className="label text-sm text-dim">Ready to download</h3>
            {vodsReady.length === 0 && <p className="text-sm text-dim">Nothing new.</p>}
            <ul className="grid gap-2">
              {vodsReady.map((p) => {
                const pending = deletions.find("vod", p.id);
                return (
                  <li key={p.id} className={card}>
                    <ProjectLink p={p} />
                    {pending && <PendingDelete request={pending} onUndo={deletions.undo} me={me} />}
                    {p.vod_file_id && (
                      <span className="ml-auto flex items-center gap-2">
                        <OpenInDrive fileId={p.vod_file_id} />
                        {/* Not awaited: the link opens on this same click. */}
                        <DownloadLink fileId={p.vod_file_id} disabled={!!pending} onClick={() => void recordDownload(p.id).then(refresh)} className={btn}>
                          Download VOD
                        </DownloadLink>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="label text-sm text-dim">Downloaded - delete from Drive?</h3>
            {toConfirm.length === 0 && <p className="text-sm text-dim">Nothing to confirm.</p>}
            <ul className="grid gap-2">
              {toConfirm.map((p) => (
                <li key={p.id} className={card}>
                  <ProjectLink p={p} />
                  <button type="button" onClick={() => setDeleting(p)} className={`${btn} ml-auto border-rec text-rec`}>
                    Confirm delete
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="label text-sm text-dim">Open comments</h3>
            {openTapes.length === 0 && <p className="text-sm text-dim">No open comments.</p>}
            <ul className="grid gap-2">
              {openTapes.map((o) => (
                <li key={o.tape.id} className={card}>
                  <span className="text-sm text-dim">{o.project_name}</span>
                  <a href={routeHash({ view: "tape", projectId: o.tape.project_id, tapeId: o.tape.id })} className="font-bold hover:underline">
                    {o.tape.name}
                  </a>
                  <StatusLabel status={o.tape.status} />
                  <span className="ml-auto text-xs text-dim">
                    v{o.latest_version} · {o.open_comments === 1 ? "1 open comment" : `${o.open_comments} open comments`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

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
