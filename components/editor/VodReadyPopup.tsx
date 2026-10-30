"use client";

import { useLayoutEffect, useState } from "react";
import type { BellItem, useBell } from "@/lib/useBell";
import { routeHash } from "@/lib/useHashRoute";

/**
 * The editor's "new uploads are ready" dialog: once per page load, from the
 * bell's first answer. The newest `unseen` items are the unseen ones, and
 * of those only vod_ready counts.
 *
 * The seen marker is one high-water id, so Dismiss may only move it past
 * the oldest unseen items that are all vod_ready: marking up to a newer one
 * would also mark an unseen comment between them seen, and it would vanish
 * from the bell unread. Returns that id, or null when the oldest unseen is
 * something else.
 */
export function dismissUpTo(items: BellItem[], unseen: number): number | null {
  let upTo: number | null = null;
  for (const i of items.slice(0, unseen).reverse()) {
    if (i.kind !== "vod_ready") break;
    upTo = i.id;
  }
  return upTo;
}

export function VodReadyPopup({ bell }: { bell: ReturnType<typeof useBell> }) {
  const [ready, setReady] = useState<BellItem[] | null>(null);
  const [upTo, setUpTo] = useState<number | null>(null);

  // Decided once, on the first load; later polls never reopen it.
  if (bell.loaded && ready === null) {
    setReady(bell.items.slice(0, bell.unseen).filter((i) => i.kind === "vod_ready" && i.project_id !== null));
    setUpTo(dismissUpTo(bell.items, bell.unseen));
  }

  const open = !!ready && ready.length > 0;
  const dismiss = () => {
    if (upTo !== null) bell.markSeen(upTo).catch(() => {});
    setReady([]);
  };

  // On window in the capture phase, which runs before the bell's listener on
  // document: stopping it here means one Esc closes only this dialog. A layout
  // effect, so the listener is in place in the same commit that shows the
  // dialog: a passive effect runs a task later, and an Esc in between was lost.
  useLayoutEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      dismiss();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  if (!open) return null;
  return (
    <div className="dialog-backdrop fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="vod-ready-title" className="dialog-in bubble bubble-paper w-full max-w-md space-y-4 p-6">
        <span aria-hidden className="burst float-right -mr-2 -mt-2 ml-3 inline-block px-3 font-[family-name:var(--font-stencil)] text-4xl text-phosphor">!</span>
        <h3 id="vod-ready-title" className="stencil tilt text-4xl text-ink">
          {ready.length === 1 ? "1 new upload is ready" : `${ready.length} new uploads are ready`}
        </h3>
        <ul className="space-y-1">
          {ready.map((i) => (
            <li key={i.id}>
              <a href={routeHash({ view: "project", projectId: i.project_id! })} onClick={dismiss} className="font-bold text-ink underline decoration-field decoration-2 hover:text-field-deep">
                {i.summary}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <button autoFocus type="button" onClick={dismiss} className="menu-pop label border-2 border-ink bg-ink px-4 py-2 text-sm text-phosphor hover:bg-field hover:text-ink">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
