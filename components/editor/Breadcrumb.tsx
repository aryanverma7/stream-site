import { routeHash, type Route } from "@/lib/useHashRoute";
import type { CrumbNames } from "@/lib/useCrumbNames";

/**
 * All projects › project › tape › vN, each a real link to its level. The
 * last one is where you are. A name still loading reads "…" rather than
 * collapsing the trail, so the crumbs don't jump when it arrives.
 */
export function Breadcrumb({ route, names }: { route: Route; names: CrumbNames }) {
  const crumbs: { label: string; to: Route }[] = [{ label: "All projects", to: { view: "projects" } }];
  if ("projectId" in route) {
    crumbs.push({ label: names.project ?? "…", to: { view: "project", projectId: route.projectId } });
  }
  if ("tapeId" in route) {
    crumbs.push({ label: names.tape ?? "…", to: { view: "tape", projectId: route.projectId, tapeId: route.tapeId } });
  }
  if (route.view === "iteration") {
    crumbs.push({
      label: names.version === null ? "…" : `v${names.version}`,
      to: { view: "iteration", projectId: route.projectId, tapeId: route.tapeId, iterationId: route.iterationId },
    });
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={i} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden className="text-dim">›</span>}
              <a
                href={routeHash(c.to)}
                aria-current={last ? "page" : undefined}
                className={`font-bold uppercase tracking-[0.08em] hover:underline ${last ? "text-phosphor" : "text-dim"}`}
              >
                {c.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
