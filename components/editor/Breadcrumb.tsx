import { routeHash, type Route } from "@/lib/useHashRoute";
import type { CrumbNames } from "@/lib/useCrumbNames";

/**
 * All projects › project › edit › vN, each a real link to its level. The
 * last one is where you are. A name still loading reads "…" rather than
 * collapsing the trail, so the crumbs don't jump when it arrives.
 */
export function Breadcrumb({ route, names }: { route: Route; names: CrumbNames }) {
  const crumbs: { label: string; to: Route }[] = [{ label: "All projects", to: { view: "projects" } }];
  if ("projectId" in route) {
    crumbs.push({ label: names.project ?? "…", to: { view: "project", projectId: route.projectId } });
  }
  if ("editId" in route) {
    crumbs.push({ label: names.edit ?? "…", to: { view: "edit", projectId: route.projectId, editId: route.editId } });
  }
  if (route.view === "iteration") {
    crumbs.push({
      label: names.version === null ? "…" : `v${names.version}`,
      to: { view: "iteration", projectId: route.projectId, editId: route.editId, iterationId: route.iterationId },
    });
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={i} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden className="inline-block h-3 w-2 -skew-x-[20deg] bg-field" />}
              <a
                href={routeHash(c.to)}
                aria-current={last ? "page" : undefined}
                className={`label inline-block px-1.5 py-0.5 text-[13px] ${last ? "-skew-x-6 bg-phosphor text-ink" : "menu-pop text-dim hover:bg-field hover:text-ink"}`}
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
