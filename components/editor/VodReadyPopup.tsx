"use client";

import { useEffect, useState } from "react";
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
  // document: stopping it here means one Esc closes only this dialog.
  useEffect(() => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="vod-ready-title" className="w-full max-w-md space-y-4 border border-field bg-bezel p-5 text-phosphor">
        <h3 id="vod-ready-title" className="stencil text-3xl">
          {ready.length === 1 ? "1 new upload is ready" : `${ready.length} new uploads are ready`}
        </h3>
        <ul className="space-y-1">
          {ready.map((i) => (
            <li key={i.id}>
              <a href={routeHash({ view: "project", projectId: i.project_id! })} onClick={dismiss} className="font-bold hover:underline">
                {i.summary}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <button autoFocus type="button" onClick={dismiss} className="label border border-seam px-4 py-2 text-sm hover:border-field">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
