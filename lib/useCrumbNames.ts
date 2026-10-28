"use client";

import { useEffect, useState } from "react";
import { editorApi, EditorApiError } from "./editorApi";
import type { Route } from "./useHashRoute";

export interface CrumbNames {
  project: string | null;
  tape: string | null;
  version: number | null;
}

const NONE: CrumbNames = { project: null, tape: null, version: null };

const isGone = (e: unknown) => e instanceof EditorApiError && e.status === 404;

/**
 * The names the breadcrumb shows, fetched for the route being shown. The
 * version comes from the tape's own iteration list rather than from
 * /iterations/{id}, which carries the upload URL the breadcrumb has no
 * business holding.
 *
 * A 404 is the one answer that means "deleted or never existed", and
 * onMissing gets the nearest parent that loaded. Any other failure leaves
 * the names blank and moves nobody - a backend restart is not a deletion.
 *
 * Deliberately not cached: a cached tape would not know about the version
 * just uploaded, and would send its link to "deleted".
 */
export function useCrumbNames(route: Route, onMissing: (parent: Route) => void): CrumbNames {
  // Keyed by the ids they were fetched for, so moving to another project
  // shows "…" rather than the previous project's name for a moment.
  const [loaded, setLoaded] = useState<{ key: string; names: CrumbNames }>({ key: "", names: NONE });
  const projectId = "projectId" in route ? route.projectId : null;
  const tapeId = "tapeId" in route ? route.tapeId : null;
  const iterationId = "iterationId" in route ? route.iterationId : null;
  const key = `${projectId}/${tapeId}/${iterationId}`;

  useEffect(() => {
    if (projectId === null) return;
    let live = true;
    type Tape = { tape: { name: string; project_id: number }; iterations: { id: number; version: number }[] };

    Promise.allSettled([
      editorApi<{ project: { name: string } }>(`/projects/${projectId}`),
      tapeId === null ? Promise.resolve(null) : editorApi<Tape>(`/tapes/${tapeId}`),
    ]).then(([p, t]) => {
      if (!live) return;
      if (p.status === "rejected") {
        if (isGone(p.reason)) onMissing({ view: "projects" });
        return;
      }
      const project = p.value.project.name;
      if (t.status === "rejected" || (t.value && t.value.tape.project_id !== projectId)) {
        if (t.status === "fulfilled" || isGone(t.reason)) onMissing({ view: "project", projectId });
        setLoaded({ key, names: { ...NONE, project } });
        return;
      }
      const tape = t.value;
      const version = tape?.iterations.find((i) => i.id === iterationId)?.version ?? null;
      if (tape && iterationId !== null && version === null) {
        onMissing({ view: "tape", projectId, tapeId: tapeId! });
      }
      setLoaded({ key, names: { project, tape: tape?.tape.name ?? null, version } });
    });
    return () => {
      live = false;
    };
  }, [key, projectId, tapeId, iterationId, onMissing]);

  return loaded.key === key ? loaded.names : NONE;
}
