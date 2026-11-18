"use client";

import { useEffect } from "react";
import { routeHash } from "@/lib/useHashRoute";
import { cancelTransfer, dismissNotice, dismissTransfer, refreshLocks, refreshStored, useSpaceNotices, useTransfers, type SpaceNotice, type Transfer } from "@/lib/useTransfers";

const btn = "menu-pop label border-2 border-phosphor bg-ink px-2 py-1 text-[11px] text-phosphor hover:bg-phosphor hover:text-ink";

function stateText(t: Transfer, pct: number): string {
  switch (t.state) {
    case "uploading":
      return t.speed === null ? `${pct}%` : `${pct}% · ${(t.speed / 1e6).toFixed(1)} MB/s`;
    case "offline":
      return `${pct}% - paused, offline`;
    case "retrying":
      return `${pct}% - connection trouble, retrying`;
    case "waiting":
      return "Sent - waiting for the Mac Mini";
    case "checking":
      return "Checking the file";
    case "paused":
      return `${pct}% sent - paused, drop ${t.name} again on its tape to continue`;
    case "elsewhere":
      return `Uploading in another tab · ${pct}%`;
    case "done":
      return "Done";
    case "failed":
      return t.message ?? "Upload failed";
  }
}

const NOTICE_MS = 8000;
const LOCK_POLL_MS = 5000;

function Toast({ n }: { n: SpaceNotice }) {
  useEffect(() => {
    const t = setTimeout(() => dismissNotice(n.id), NOTICE_MS);
    return () => clearTimeout(t);
  }, [n.id]);
  return (
    <div
      role="status"
      aria-live="polite"
      className={`toast-in slab-flat flex items-start gap-3 p-3 text-xs ${n.warn ? "border-amber! text-amber" : "text-phosphor"}`}
    >
      <p className="min-w-0 flex-1">{n.text}</p>
      <button type="button" aria-label="Close notice" onClick={() => dismissNotice(n.id)} className={btn}>
        ×
      </button>
    </div>
  );
}

/**
 * Every upload in a corner: this tab's, and the unfinished ones a closed
 * browser left in localStorage (checked with the server on mount, so one
 * the reconcile job already finished disappears). The page asks before
 * closing while bytes are being sent, or are about to be again (offline,
 * retrying), or the file is being checked (closing then would lose the
 * checks and thumbnail). "waiting" does not ask: the bytes are on Google and
 * the reconcile job finishes the version.
 */
export function TransfersPanel() {
  const transfers = useTransfers();
  const notices = useSpaceNotices();
  useEffect(() => {
    void refreshStored();
  }, []);
  // Another tab may start or finish one of the stored uploads at any time.
  const stored = transfers.some((t) => t.state === "paused" || t.state === "elsewhere");
  useEffect(() => {
    if (!stored) return;
    const h = setInterval(() => void refreshLocks(), LOCK_POLL_MS);
    return () => clearInterval(h);
  }, [stored]);

  const sending = transfers.some((t) => ["uploading", "offline", "retrying", "checking"].includes(t.state));
  useEffect(() => {
    if (!sending) return;
    const ask = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [sending]);

  const toasts = notices.length > 0 && (
    <div className="fixed right-3 top-3 z-50 w-[min(24rem,calc(100vw-1.5rem))] space-y-2">
      {notices.map((n) => (
        <Toast key={n.id} n={n} />
      ))}
    </div>
  );
  if (!transfers.length) return toasts || null;
  return (
    <>
    {toasts}
    <aside
      aria-label="Transfers"
      className="toast-in slab-flat fixed bottom-4 right-4 z-40 max-h-[60vh] w-[min(24rem,calc(100vw-2rem))] space-y-2 overflow-y-auto p-3 text-phosphor"
    >
      <h2 className="tag bg-phosphor text-xs text-ink shadow-none">Transfers</h2>
      <ul className="space-y-3">
        {transfers.map((t) => {
          const pct = t.size > 0 ? Math.floor((t.sent / t.size) * 100) : 0;
          const finished = t.state === "done" || t.state === "failed";
          return (
            <li key={t.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate font-mono text-xs">{t.version === null ? t.name : `${t.name} v${t.version}`}</span>
                {finished ? (
                  <button type="button" aria-label={`Dismiss ${t.name}`} onClick={() => dismissTransfer(t.key)} className={btn}>
                    ×
                  </button>
                ) : t.state === "waiting" ? (
                  <span className="label text-[11px] text-dim">Finishing…</span>
                ) : t.state === "elsewhere" ? (
                  <span className="label text-[11px] text-dim">Another tab</span>
                ) : (
                  t.state !== "checking" && (
                    <button type="button" aria-label={`Cancel ${t.name}`} onClick={() => cancelTransfer(t.key)} className={btn}>
                      Cancel
                    </button>
                  )
                )}
              </div>
              <div className="h-2 -skew-x-12 border border-seam bg-ink" aria-hidden>
                <div className={`h-full ${t.state === "failed" ? "bg-rec" : t.state === "done" ? "bg-signal" : "bg-field"}`} style={{ width: `${pct}%` }} />
              </div>
              <p className={`text-xs ${t.state === "failed" ? "text-rec" : t.state === "done" ? "burst label ml-3 inline-block px-1 text-phosphor" : "text-dim"}`}>
                {stateText(t, pct)}
              </p>
              {t.spaceNote && <p className="text-xs text-dim">{t.spaceNote}</p>}
              {t.message && t.state !== "failed" && <p className="text-xs text-amber">{t.message}</p>}
              {t.state === "paused" && (
                <a href={routeHash({ view: "tape", projectId: t.projectId, tapeId: t.tapeId })} className="text-xs text-phosphor underline">
                  Open tape
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
    </>
  );
}
