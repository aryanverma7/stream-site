"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { routeHash, useHashRoute, type Route } from "@/lib/useHashRoute";
import { useEditorMe, type EditorMe } from "@/lib/useEditorMe";
import { useCrumbNames } from "@/lib/useCrumbNames";
import { Breadcrumb } from "./Breadcrumb";
import { ProjectsView } from "./ProjectsView";
import { ProjectView } from "./ProjectView";
import { TapeView } from "./TapeView";
import { IterationDetails } from "./IterationCard";

const DELETED = "That was deleted or never existed";

const depth = (r: Route) => ({ project: 1, tape: 2, iteration: 3 })[r.view as string] ?? 0;

/** Typing in a field: Esc there belongs to the field (or the IME), not to the zoom. */
function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return e.isComposing || !!t?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t?.tagName ?? "");
}

/**
 * What each route shows. Home, Fix list, To-do and Storage are
 * placeholders until Task 5 replaces them.
 */
function RouteView({ route, me }: { route: Route; me: EditorMe }) {
  switch (route.view) {
    case "projects":
      return <ProjectsView role={me.role} username={me.username} />;
    case "project":
      return <ProjectView projectId={route.projectId} role={me.role} username={me.username} />;
    case "tape":
      return <TapeView projectId={route.projectId} tapeId={route.tapeId} role={me.role} username={me.username} />;
    case "iteration":
      return <IterationDetails iterationId={route.iterationId} />;
  }
  if (route.view === "storage" && me.role !== "admin") {
    return (
      <h2 tabIndex={-1} className="text-rec">
        Only the streamer can do this.
      </h2>
    );
  }
  const title = {
    projects: "Projects",
    home: "Home",
    fixes: "Fix list",
    todo: "To-do",
    storage: "Storage",
  }[route.view];
  return (
    <h2 tabIndex={-1} className="stencil text-4xl">
      {title}
    </h2>
  );
}

/**
 * The editor app's frame: top bar, breadcrumb, and the view for the
 * current hash. One page for both roles; `me.role` only decides what is
 * shown, and the server refuses streamer-only actions regardless.
 *
 * `bell` (Task 5) sits in the top bar; `transfers` (Task 4) is rendered
 * after the view and positions itself.
 *
 * Every view leads with a heading carrying tabIndex={-1}: focus moves to
 * it on each navigation, so a keyboard or screen-reader user lands on the
 * new view instead of on the link they just left.
 */
export function EditorShell({ bell, transfers }: { bell?: ReactNode; transfers?: ReactNode }) {
  const { route, go, up } = useHashRoute();
  const { me, error } = useEditorMe();
  // The notice belongs to the parent it moved you to: shown once you
  // arrive there, gone as soon as you leave, so a later visit to that
  // parent does not repeat it.
  const [notice, setNotice] = useState<{ hash: string; text: string; arrived: boolean } | null>(null);

  const onMissing = useCallback(
    (parent: Route) => {
      setNotice({ hash: routeHash(parent), text: DELETED, arrived: false });
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

  const hash = routeHash(route);
  const viewKey = hash.split("@")[0];
  if (notice && !notice.arrived && notice.hash === hash) setNotice({ ...notice, arrived: true });
  if (notice?.arrived && notice.hash !== hash) setNotice(null);

  const viewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    viewRef.current?.querySelector<HTMLElement>("h2")?.focus();
  }, [viewKey, me]);

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
      if (e.key === "Escape" && !e.defaultPrevented && !isTyping(e)) up();
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
                aria-current={active ? "true" : undefined}
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
          {/* Always mounted, so the notice is announced when its text appears. */}
          <p role="status" className={notice?.arrived ? "border border-amber px-3 py-2 text-amber" : "sr-only"}>
            {notice?.arrived ? notice.text : ""}
          </p>
          {error && <p className="text-rec">{error}</p>}
          {!me && !error && <p className="osd text-xl text-dim">Loading…</p>}
          {me && (
            <>
              {inProjects && <Breadcrumb route={route} names={names} />}
              <div key={viewKey} ref={viewRef} className={zoom.dir}>
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
