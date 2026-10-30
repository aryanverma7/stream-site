"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { parseHash, routeHash, useHashRoute, type Route } from "@/lib/useHashRoute";
import { useEditorMe, type EditorMe } from "@/lib/useEditorMe";
import { useCrumbNames } from "@/lib/useCrumbNames";
import { Breadcrumb } from "./Breadcrumb";
import { ProjectsView } from "./ProjectsView";
import { ProjectView } from "./ProjectView";
import { TapeView } from "./TapeView";
import { ReviewPlayer } from "./ReviewPlayer";
import { isTyping } from "@/lib/isTyping";
import { keepOnlyProject } from "@/lib/opfsMedia";
import { Bell } from "./Bell";
import { SearchBox } from "./SearchBox";
import { HomeView } from "./HomeView";
import { FixListView } from "./FixListView";
import { TodoView } from "./TodoView";
import { StorageView } from "./StorageView";
import { Ransom } from "../Hero";

const DELETED = "That was deleted or never existed";

const depth = (r: Route) => ({ project: 1, tape: 2, iteration: 3 })[r.view as string] ?? 0;

/** What each route shows. */
function RouteView({ route, me }: { route: Route; me: EditorMe }) {
  switch (route.view) {
    case "projects":
      return <ProjectsView role={me.role} username={me.username} />;
    case "project":
      return <ProjectView projectId={route.projectId} role={me.role} username={me.username} />;
    case "tape":
      return <TapeView projectId={route.projectId} tapeId={route.tapeId} role={me.role} username={me.username} />;
    case "iteration":
      return <ReviewPlayer projectId={route.projectId} tapeId={route.tapeId} iterationId={route.iterationId} seekS={route.seekS} role={me.role} username={me.username} />;
    case "home":
      return <HomeView role={me.role} username={me.username} />;
    case "fixes":
      return <FixListView />;
    case "todo":
      return <TodoView />;
    case "storage":
      return me.role === "admin" ? (
        <StorageView username={me.username} />
      ) : (
        <h2 tabIndex={-1} className="text-rec">
          Only the streamer can do this.
        </h2>
      );
  }
}

/**
 * The editor app's frame: top bar, breadcrumb, and the view for the
 * current hash. One page for both roles; `me.role` only decides what is
 * shown, and the server refuses streamer-only actions regardless.
 *
 * The bell sits in the top bar once we know who is signed in; `transfers`
 * is rendered after the view and positions itself.
 *
 * Every view leads with a heading carrying tabIndex={-1}: focus moves to
 * it on each navigation, so a keyboard or screen-reader user lands on the
 * new view instead of on the link they just left.
 */
export function EditorShell({ transfers }: { transfers?: ReactNode }) {
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

  // Browser copies of other projects' versions are only ever deleted here.
  // The hash is read again here: while the page hydrates, `route` is the
  // server snapshot (the projects list), and trusting it would delete every
  // download on each load of a deep link.
  const projectId = "projectId" in route ? route.projectId : null;
  useEffect(() => {
    const now = parseHash(window.location.hash);
    keepOnlyProject("projectId" in now ? now.projectId : null).catch(() => {});
  }, [projectId]);

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
      <header className="wallpaper relative z-30 flex flex-wrap items-center justify-between gap-4 border-b-4 border-ink px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl">
            <Ransom text="DualBladeX" />
          </h1>
          <span className="tag hidden bg-ink text-sm text-phosphor sm:inline-block">Editor</span>
        </div>
        <div className="flex items-center gap-4">
          {me && <SearchBox />}
          {me && <Bell role={me.role} />}
          <form method="post" action="/auth/logout">
            <button
              type="submit"
              className="menu-pop label whitespace-nowrap border-2 border-ink px-3 py-1.5 text-xs text-ink hover:bg-ink hover:text-phosphor"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      {me && (
        <nav aria-label="Editor sections" className="flex gap-2 overflow-x-auto border-b-2 border-phosphor bg-ink px-3 py-3 sm:px-5">
          {sections.map((s) => {
            const active = s.to.view === "projects" ? inProjects : s.to.view === route.view;
            return (
              <a
                key={s.label}
                href={routeHash(s.to)}
                aria-current={active ? "true" : undefined}
                className={`menu-pop label shrink-0 px-3 py-2 text-sm ${
                  active ? "menu-on" : "text-phosphor hover:bg-field hover:text-ink"
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
              className="menu-pop label ml-auto shrink-0 px-3 py-2 text-sm text-dim hover:text-phosphor"
            >
              Brand kit ↗
            </a>
          )}
        </nav>
      )}

      <main className="min-w-0 flex-1 overflow-hidden px-3 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-4">
          {/* Always mounted, so the notice is announced when its text appears. */}
          <p role="status" className={notice?.arrived ? "toast-in border-2 border-amber bg-ink px-3 py-2 text-amber shadow-[4px_4px_0_var(--amber)]" : "sr-only"}>
            {notice?.arrived ? notice.text : ""}
          </p>
          {error && <p className="text-rec">{error}</p>}
          {!me && !error && <p className="osd text-xl text-dim">Loading…</p>}
          {me && (
            <>
              {inProjects && <Breadcrumb route={route} names={names} />}
              <div key={viewKey} ref={viewRef} className={`${zoom.dir} wipe`}>
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
