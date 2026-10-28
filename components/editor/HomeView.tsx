"use client";

import { useState } from "react";
import { downloadVod } from "@/lib/editorApi";
import { routeHash } from "@/lib/useHashRoute";
import { useHome, type HomeData } from "@/lib/useHome";
import { StatusLabel } from "./StatusLabel";
import { DeleteDialog } from "./DeleteDialog";

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
export function HomeView() {
  const { home, error, refresh } = useHome();
  const [actionError, setActionError] = useState<string | null>(null);
  const [driveUrls, setDriveUrls] = useState<Record<number, string | null>>({});
  const [deleting, setDeleting] = useState<HomeProject | null>(null);

  const download = async (p: HomeProject) => {
    setActionError(null);
    try {
      const driveUrl = await downloadVod(p.id, p.vod_file_id!);
      setDriveUrls((u) => ({ ...u, [p.id]: driveUrl }));
      await refresh();
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  return (
    <section className="space-y-6">
      <h2 tabIndex={-1} className="stencil text-4xl">
        Home
      </h2>
      {(error || actionError) && (
        <p role="alert" className="text-rec">
          {actionError ?? error}
        </p>
      )}
      {home && (
        <>
          <div className="space-y-2">
            <h3 className="label text-sm text-dim">Ready to download</h3>
            {home.vods_ready.length === 0 && <p className="text-sm text-dim">Nothing new.</p>}
            <ul className="grid gap-2">
              {home.vods_ready.map((p) => (
                <li key={p.id} className={card}>
                  <ProjectLink p={p} />
                  <span className="ml-auto flex items-center gap-2">
                    {driveUrls[p.id] && (
                      <a href={driveUrls[p.id]!} target="_blank" rel="noopener noreferrer" className="text-xs text-dim hover:text-phosphor">
                        Open in Drive ↗
                      </a>
                    )}
                    {p.vod_file_id && (
                      <button type="button" onClick={() => download(p)} className={btn}>
                        Download VOD
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="label text-sm text-dim">Downloaded - delete from Drive?</h3>
            {home.deletes_to_confirm.length === 0 && <p className="text-sm text-dim">Nothing to confirm.</p>}
            <ul className="grid gap-2">
              {home.deletes_to_confirm.map((p) => (
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
            {home.open_tapes.length === 0 && <p className="text-sm text-dim">No open comments.</p>}
            <ul className="grid gap-2">
              {home.open_tapes.map((o) => (
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
            refresh();
          }}
        />
      )}
    </section>
  );
}
