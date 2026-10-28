"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { routeHash, useHashRoute, type Route } from "@/lib/useHashRoute";
import { useEditorMe, type EditorMe } from "@/lib/useEditorMe";
import { useCrumbNames } from "@/lib/useCrumbNames";
import { Breadcrumb } from "./Breadcrumb";

const DELETED = "That was deleted or never existed";

const depth = (r: Route) => ({ project: 1, tape: 2, iteration: 3 })[r.view as string] ?? 0;

/**
 * What each route shows. Placeholders until Task 3 (projects, tapes,
 * versions) and Task 5 (Home, Fix list, To-do, Storage) replace them.
 */
function RouteView({ route, me }: { route: Route; me: EditorMe }) {
  if (route.view === "storage" && me.role !== "admin") {
    return <p className="text-rec">Only the streamer can do this.</p>;
  }
  const title = {
    projects: "Projects",
    home: "Home",
    fixes: "Fix list",
    todo: "To-do",
    storage: "Storage",
    project: "Project",
    tape: "Tape",
    iteration: "Version",
  }[route.view];
  return <h2 className="stencil text-4xl">{title}</h2>;
}

/**
 * The editor app's frame: top bar, breadcrumb, and the view for the
 * current hash. One page for both roles; `me.role` only decides what is
 * shown, and the server refuses streamer-only actions regardless.
 *
 * `bell` (Task 5) sits in the top bar; `transfers` (Task 4) is rendered
 * after the view and positions itself.
 */
export function EditorShell({ bell, transfers }: { bell?: ReactNode; transfers?: ReactNode }) {
  const { route, go, up } = useHashRoute();
  const { me, error } = useEditorMe();
  // The notice belongs to the hash it was raised on, so the next
  // navigation clears it without anyone having to.
  const [notice, setNotice] = useState<{ hash: string; text: string } | null>(null);

  const onMissing = useCallback(
    (parent: Route) => {
      setNotice({ hash: routeHash(parent), text: DELETED });
      go(parent, true);
    },
    [go],
  );
  const names = useCrumbNames(route, onMissing);

  // Derived during render, not in an effect: which way the last move went
  // picks the animation the keyed wrapper below replays.
  const d = depth(route);
  const [zoom, setZoom] = useState({ depth: d, dir: "zoom-in" });
  if (zoom.depth !== d) setZoom({ depth: d, dir: d > zoom.depth ? "zoom-in" : "zoom-out" });

  // An empty hash is a first visit: the editor's work starts on Home.
  useEffect(() => {
    if (me?.role === "editor" && (window.location.hash === "" || window.location.hash === "#")) {
      go({ view: "home" }, true);
    }
  }, [me, go]);

  // Esc zooms out. A dialog handles its own Esc and stops propagation, so
  // closing it never also leaves the tape behind it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) up();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [up]);

  const sections: { label: string; to: Route }[] = [
    { label: "Projects", to: { view: "projects" } },
    { label: "Home", to: { view: "home" } },
    { label: "Fix list", to: { view: "fixes" } },
    { label: "To-do", to: { view: "todo" } },
    ...(me?.role === "admin" ? [{ label: "Storage", to: { view: "storage" } as Route }] : []),
  ];
  const inProjects = ["projects", "project", "tape", "iteration"].includes(route.view);
  const hash = routeHash(route);

  return (
    <div className="flex min-h-screen flex-col bg-ink text-phosphor">
      <header className="wallpaper flex flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-baseline gap-3">
          <h1 className="stencil text-3xl">DualBladeX</h1>
          <span className="osd hidden text-xl sm:inline">Editor</span>
        </div>
        <div className="flex items-center gap-4">
          {bell}
          <form method="post" action="/auth/logout">
            <button
              type="submit"
              className="border border-ink/40 px-3 py-1.5 text-xs font-bold uppercase tracking-widest hover:bg-ink hover:text-phosphor"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      {me && (
        <nav aria-label="Editor sections" className="flex gap-1 overflow-x-auto border-b border-seam bg-bezel px-2 py-2 sm:px-4">
          {sections.map((s) => {
            const active = s.to.view === "projects" ? inProjects : s.to.view === route.view;
            return (
              <a
                key={s.label}
                href={routeHash(s.to)}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 px-3 py-2 text-sm font-bold uppercase tracking-[0.08em] ${
                  active ? "bg-field text-ink" : "text-phosphor hover:bg-bezel-2"
                }`}
              >
                {s.label}
              </a>
            );
          })}
          {me.brand_kit_url && (
            <a
              href={me.brand_kit_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto shrink-0 px-3 py-2 text-sm font-bold uppercase tracking-[0.08em] text-dim hover:text-phosphor"
            >
              Brand kit ↗
            </a>
          )}
        </nav>
      )}

      <main className="min-w-0 flex-1 overflow-hidden px-3 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-4">
          {error && <p className="text-rec">{error}</p>}
          {!me && !error && <p className="osd text-xl text-dim">Loading…</p>}
          {me && (
            <>
              {inProjects && <Breadcrumb route={route} names={names} />}
              {notice?.hash === hash && (
                <p role="status" className="border border-amber px-3 py-2 text-amber">
                  {notice.text}
                </p>
              )}
              <div key={hash.split("@")[0]} className={zoom.dir}>
                <RouteView route={route} me={me} />
              </div>
            </>
          )}
        </div>
      </main>
      {transfers}
    </div>
  );
}
