"use client";

import { useEffect, useState } from "react";
import { useBell, type BellItem } from "@/lib/useBell";
import { routeHash } from "@/lib/useHashRoute";
import { VodReadyPopup } from "./VodReadyPopup";

/** The deepest place an event points at, or null for one about nothing on screen. */
export function itemHref(i: BellItem): string | null {
  if (i.project_id === null) return null;
  if (i.tape_id === null) return routeHash({ view: "project", projectId: i.project_id });
  if (i.iteration_id === null) return routeHash({ view: "tape", projectId: i.project_id, tapeId: i.tape_id });
  return routeHash({ view: "iteration", projectId: i.project_id, tapeId: i.tape_id, iterationId: i.iteration_id });
}

/**
 * The top bar's bell: the other person's events. Opening it marks them all
 * seen up to the newest one. The editor also gets the new-VOD popup, fed
 * from the same feed so there is one poll.
 */
export function Bell({ role }: { role: "admin" | "editor" }) {
  const bell = useBell();
  const [open, setOpen] = useState(false);

  // Esc closes the panel and goes no further, like a dialog: it must not also zoom out.
  // On document, not window: a dialog above the panel (the popup, a delete)
  // catches Esc on window first and stops it, so one Esc closes only the topmost.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  // The feed is the newest 50 (no after=, by plan): with more unseen than that,
  // opening still marks every one of them seen, the older ones unshown.
  const toggle = () => {
    if (!open && bell.unseen > 0 && bell.items.length > 0) bell.markSeen(bell.items[0].id).catch(() => {});
    setOpen(!open);
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="bell-panel"
        aria-label={`Notifications (${bell.unseen} unseen)`}
        onClick={toggle}
        className="menu-pop label relative border-2 border-ink px-3 py-1.5 text-xs text-ink hover:bg-ink hover:text-phosphor"
      >
        Bell
        {bell.unseen > 0 && (
          <span aria-hidden="true" className="burst burst-white absolute -right-3 -top-3 min-w-5 px-1 text-center text-[11px] text-ink">
            {bell.unseen}
          </span>
        )}
      </button>
      {open && (
        <div id="bell-panel" className="dialog-in slab-flat absolute right-0 z-40 mt-3 max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto text-phosphor">
          {bell.items.length === 0 ? (
            <p className="p-4 text-sm text-dim">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-seam">
              {bell.items.map((i) => {
                const href = itemHref(i);
                const body = (
                  <>
                    <span className="block text-sm">{i.summary}</span>
                    <span className="block text-xs text-dim">{new Date(i.at * 1000).toLocaleString()}</span>
                  </>
                );
                return (
                  <li key={i.id}>
                    {href ? (
                      <a href={href} onClick={() => setOpen(false)} className="block px-4 py-2 transition-colors hover:bg-phosphor hover:text-ink [&:hover_.text-dim]:text-ink">
                        {body}
                      </a>
                    ) : (
                      <div className="px-4 py-2">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {role === "editor" && <VodReadyPopup bell={bell} />}
    </div>
  );
}
