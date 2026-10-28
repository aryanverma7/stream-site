"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Where the editor app is. Lives in location.hash because the site is a
 * static export with one /editor page - so a deep link, a reload and the
 * browser's Back all work with no router at all.
 */
export type Route =
  | { view: "projects" | "home" | "fixes" | "storage" | "todo" }
  | { view: "project"; projectId: number }
  | { view: "tape"; projectId: number; tapeId: number }
  | { view: "iteration"; projectId: number; tapeId: number; iterationId: number; seekS?: number };

const TOP = { "": "projects", home: "home", fixes: "fixes", storage: "storage", todo: "todo" } as const;
const NESTED = /^#\/p\/(\d+)(?:\/t\/(\d+)(?:\/v\/(\d+)(?:@(\d+(?:\.\d+)?))?)?)?$/;

/** Anything unrecognised is the projects list, never an error page. */
export function parseHash(hash: string): Route {
  const top = hash.match(/^#?\/?(\w*)$/);
  if (top && Object.hasOwn(TOP, top[1])) return { view: TOP[top[1] as keyof typeof TOP] };
  const m = hash.match(NESTED);
  if (!m) return { view: "projects" };
  const [projectId, tapeId, iterationId] = [m[1], m[2], m[3]].map(Number);
  // An id the backend could never have issued is a bad link, not a lookup.
  const bad = (id: number) => !(Number.isSafeInteger(id) && id > 0);
  if (bad(projectId) || (m[2] !== undefined && bad(tapeId)) || (m[3] !== undefined && bad(iterationId))) {
    return { view: "projects" };
  }
  const seekS = Number(m[4]);
  if (m[2] === undefined) return { view: "project", projectId };
  if (m[3] === undefined) return { view: "tape", projectId, tapeId };
  return { view: "iteration", projectId, tapeId, iterationId, ...(Number.isFinite(seekS) && seekS >= 0 && { seekS }) };
}

export function routeHash(route: Route): string {
  switch (route.view) {
    case "projects":
      return "#/";
    case "project":
      return `#/p/${route.projectId}`;
    case "tape":
      return `#/p/${route.projectId}/t/${route.tapeId}`;
    case "iteration":
      return `#/p/${route.projectId}/t/${route.tapeId}/v/${route.iterationId}${route.seekS !== undefined ? `@${route.seekS}` : ""}`;
    default:
      return `#/${route.view}`;
  }
}

/** One level out; null at the top-level views, which have nothing above them. */
export function parentRoute(route: Route): Route | null {
  switch (route.view) {
    case "iteration":
      return { view: "tape", projectId: route.projectId, tapeId: route.tapeId };
    case "tape":
      return { view: "project", projectId: route.projectId };
    case "project":
      return { view: "projects" };
    default:
      return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/**
 * The current route, plus go() and up(). go() pushes a history entry, so
 * Back undoes it; `replace` is for corrections (a dead link moved to its
 * parent) that Back should not return to.
 */
export function useHashRoute(): {
  route: Route;
  go: (route: Route, replace?: boolean) => void;
  up: () => void;
} {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  const route = useMemo(() => parseHash(hash), [hash]);

  const go = useCallback((next: Route, replace = false) => {
    if (replace) window.location.replace(routeHash(next));
    else window.location.hash = routeHash(next);
  }, []);

  const up = useCallback(() => {
    const parent = parentRoute(parseHash(window.location.hash));
    if (parent) go(parent);
  }, [go]);

  return { route, go, up };
}
