"use client";

import { clock } from "@/lib/editorApi";
import { routeHash } from "@/lib/useHashRoute";
import { useFixList, type FixItem } from "@/lib/useFixList";

const KIND = { fix: "Fix", keep: "Keep", question: "Question" } as const;

/** The version's route, with the comment's start appended for the player to seek to. */
export function fixHref(i: FixItem): string {
  const start = i.comment.start_s;
  return routeHash({
    view: "iteration",
    projectId: i.project_id,
    tapeId: i.tape_id,
    iterationId: i.iteration_id,
    ...(start !== null && { seekS: start }),
  });
}

/** Every open comment on every tape's latest version, by tape. */
export function FixListView() {
  const { groups, error } = useFixList();
  return (
    <section className="space-y-6">
      <h2 tabIndex={-1} className="stencil text-4xl">
        Fix list
      </h2>
      {error && (
        <p role="alert" className="text-rec">
          {error}
        </p>
      )}
      {!error && groups.length === 0 && <p className="text-sm text-dim">Nothing open.</p>}
      {groups.map((g) => (
        <div key={g[0].tape_id} className="space-y-2">
          <h3 className="label text-sm text-dim">
            <a href={routeHash({ view: "tape", projectId: g[0].project_id, tapeId: g[0].tape_id })} className="hover:text-phosphor">
              {g[0].tape_name}
            </a>
          </h3>
          <ul className="grid gap-2">
            {g.map((i) => {
              const c = i.comment;
              const at = c.start_s === null ? null : clock(c.start_s);
              return (
                <li key={c.id} className="border border-seam bg-bezel px-4 py-3">
                  <a href={fixHref(i)} className="block hover:underline">
                    {[`v${i.version}`, at, `${KIND[c.kind]}: ${c.body}`].filter(Boolean).join(" · ")}
                  </a>
                  {c.carried && (
                    <span className="text-xs text-dim">
                      from v{c.origin_version}
                      {at && ` at ${at}`}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
