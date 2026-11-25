"use client";

import { useEffect, useState } from "react";
import { editorApi, EditorApiError } from "./editorApi";
import type { Route } from "./useHashRoute";

export interface CrumbNames {
  project: string | null;
  edit: string | null;
  version: number | null;
}

const NONE: CrumbNames = { project: null, edit: null, version: null };

const isGone = (e: unknown) => e instanceof EditorApiError && e.status === 404;

/**
 * The names the breadcrumb shows, fetched for the route being shown. The
 * version comes from the edit's own iteration list rather than from
 * /iterations/{id}, which carries the upload URL the breadcrumb has no
 * business holding.
 *
 * A 404 is the one answer that means "deleted or never existed", and
 * onMissing gets the nearest parent that loaded. Any other failure leaves
 * the names blank and moves nobody - a backend restart is not a deletion.
 *
 * Deliberately not cached: a cached edit would not know about the version
 * just uploaded, and would send its link to "deleted".
 */
export function useCrumbNames(route: Route, onMissing: (parent: Route) => void): CrumbNames {
  // Keyed by the ids they were fetched for, so moving to another project
  // shows "…" rather than the previous project's name for a moment.
  const [loaded, setLoaded] = useState<{ key: string; names: CrumbNames }>({ key: "", names: NONE });
  const projectId = "projectId" in route ? route.projectId : null;
  const editId = "editId" in route ? route.editId : null;
  const iterationId = "iterationId" in route ? route.iterationId : null;
  const key = `${projectId}/${editId}/${iterationId}`;

  useEffect(() => {
    if (projectId === null) return;
    let live = true;
    type Edit = { edit: { name: string; project_id: number }; iterations: { id: number; version: number }[] };

    Promise.allSettled([
      editorApi<{ project: { name: string } }>(`/projects/${projectId}`),
      editId === null ? Promise.resolve(null) : editorApi<Edit>(`/edits/${editId}`),
    ]).then(([p, t]) => {
      if (!live) return;
      if (p.status === "rejected") {
        if (isGone(p.reason)) onMissing({ view: "projects" });
        return;
      }
      const project = p.value.project.name;
      if (t.status === "rejected" || (t.value && t.value.edit.project_id !== projectId)) {
        if (t.status === "fulfilled" || isGone(t.reason)) onMissing({ view: "project", projectId });
        setLoaded({ key, names: { ...NONE, project } });
        return;
      }
      const edit = t.value;
      const version = edit?.iterations.find((i) => i.id === iterationId)?.version ?? null;
      if (edit && iterationId !== null && version === null) {
        onMissing({ view: "edit", projectId, editId: editId! });
      }
      setLoaded({ key, names: { project, edit: edit?.edit.name ?? null, version } });
    });
    return () => {
      live = false;
    };
  }, [key, projectId, editId, iterationId, onMissing]);

  return loaded.key === key ? loaded.names : NONE;
}
