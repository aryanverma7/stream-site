"use client";

import { Loading } from "@/components/Loading";
import { useState } from "react";
import { editorApi } from "@/lib/editorApi";
import { routeHash } from "@/lib/useHashRoute";
import { KIND_LABEL, useProject, type EditStatus } from "@/lib/useProject";
import { useDeletions } from "@/lib/useDeletions";
import { STATUS_LABELS, StatusLabel } from "./StatusLabel";
import { PendingDelete } from "./PendingDelete";
import { DeleteDialog } from "./DeleteDialog";

const btn = "menu-pop label border-2 border-phosphor bg-ink px-3 py-2 text-xs text-phosphor hover:bg-phosphor hover:text-ink disabled:opacity-40";
const field = "border border-seam bg-ink px-2 py-1.5 text-sm text-phosphor";
type Sort = "newest" | "comments" | "name";

/** One project's edits, filterable by status and sortable; New edit; the streamer's project delete. */
export function ProjectView({ projectId, role, username }: { projectId: number; role: "admin" | "editor"; username: string }) {
  const { project, edits, error, refresh } = useProject(projectId);
  // An Undo (or any delete appearing or finishing) changes the target too: refetch it.
  const deletions = useDeletions(() => refresh());
  const me = { username, role };
  const [filter, setFilter] = useState<EditStatus | "all">("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [newName, setNewName] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // One h2 in the same place loading or loaded, so the focus the shell gives it survives the load.
  const heading = (
    <h2 tabIndex={-1} className="stencil tilt slam text-4xl">
      {project?.name ?? "Project"}
    </h2>
  );
  if (!project) {
    return (
      <section className="space-y-5">
        {heading}
        {error ? <p className="text-rec">{error}</p> : <p className="text-xl"><Loading /></p>}
      </section>
    );
  }

  const projectDelete = deletions.find("project", projectId);
  const shown = edits
    .filter((t) => filter === "all" || t.status === filter)
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "comments"
          ? (b.open_comments ?? 0) - (a.open_comments ?? 0) || b.id - a.id
          : b.created_at - a.created_at || b.id - a.id,
    );

  async function addEdit() {
    const name = newName.trim();
    if (!name) return;
    setActionError(null);
    try {
      await editorApi(`/projects/${projectId}/edits`, { method: "POST", body: { name } });
      setNewName("");
      await refresh();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  return (
    <section className="space-y-5">
      {heading}
      <div className="flex flex-wrap items-center gap-3">
        {projectDelete && <PendingDelete request={projectDelete} onUndo={deletions.undo} me={me} />}
        {role === "admin" && !projectDelete && (
          <button type="button" onClick={() => setDeleting(true)} className={`${btn} ml-auto border-rec! text-rec! hover:bg-rec! hover:text-ink!`}>
            Delete project
          </button>
        )}
      </div>
      {actionError && (
        <p role="alert" className="text-rec">
          {actionError}
        </p>
      )}

      <div className="slab slab-sm relative flex flex-wrap items-end gap-3 p-3">
        {project.kind !== "tape" && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addEdit();
            }}
          >
            <input aria-label="New video or clip name" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} className={field} />
            <button type="submit" disabled={!!projectDelete || !newName.trim()} className={btn}>
              New video or clip
            </button>
          </form>
        )}
        <select aria-label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value as EditStatus | "all")} className={`${field} ml-auto`}>
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABELS) as EditStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={field}>
          <option value="newest">Newest</option>
          <option value="comments">Most open comments</option>
          <option value="name">Name</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-dim">{edits.length ? "Nothing with that status." : "No videos or clips yet."}</p>
      ) : (
        <ul className="grid gap-2">
          {shown.map((t) => {
            const filesDelete = deletions.find("edit_files", t.id);
            return (
              <li key={t.id} className="slab slab-sm relative flex flex-wrap items-center gap-3 px-4 py-3">
                <a href={routeHash({ view: "edit", projectId, editId: t.id })} className="font-bold hover:underline">
                  {t.name}
                </a>
                {t.kind && <span className="label text-xs text-dim">{KIND_LABEL[t.kind]}</span>}
                <StatusLabel status={t.status} />
                {t.has_new && <span className="tag bg-field text-[11px] text-ink">New</span>}
                <span className="osd text-lg text-dim">{t.latest_version ? `v${t.latest_version}` : "no versions"}</span>
                <span className="text-xs text-dim">{t.open_comments ?? 0} open</span>
                {filesDelete && <PendingDelete request={filesDelete} onUndo={deletions.undo} me={me} />}
              </li>
            );
          })}
        </ul>
      )}

      {deleting && (
        <DeleteDialog
          kind="project"
          targetId={projectId}
          label={project.name}
          title={`Delete ${project.name}`}
          onClose={() => setDeleting(false)}
          onDone={() => {
            setDeleting(false);
            deletions.refresh();
          }}
        />
      )}
    </section>
  );
}
