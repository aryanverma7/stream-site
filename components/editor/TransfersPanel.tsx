"use client";

import { useEffect } from "react";
import { routeHash } from "@/lib/useHashRoute";
import { cancelTransfer, dismissNotice, dismissTransfer, refreshStored, useSpaceNotices, useTransfers, type SpaceNotice, type Transfer } from "@/lib/useTransfers";

const btn = "label border border-seam px-2 py-1 text-[11px] text-phosphor hover:border-field";

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
    case "done":
      return "Done";
    case "failed":
      return t.message ?? "Upload failed";
  }
}

const NOTICE_MS = 8000;

function Toast({ n }: { n: SpaceNotice }) {
  useEffect(() => {
    const t = setTimeout(() => dismissNotice(n.id), NOTICE_MS);
    return () => clearTimeout(t);
  }, [n.id]);
  return (
    <div
      role="status"
      aria-live="polite"
      className={`toast-in flex items-start gap-3 border bg-bezel p-3 text-xs ${n.warn ? "border-amber text-amber" : "border-seam text-phosphor"}`}
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
 * closing while bytes are being sent or the file is being checked (closing
 * then would lose the checks and thumbnail).
 */
export function TransfersPanel() {
  const transfers = useTransfers();
  const notices = useSpaceNotices();
  useEffect(() => {
    void refreshStored();
  }, []);

  const sending = transfers.some((t) => t.state === "uploading" || t.state === "checking");
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
      className="fixed bottom-3 right-3 z-40 max-h-[60vh] w-[min(24rem,calc(100vw-1.5rem))] space-y-2 overflow-y-auto border border-seam bg-bezel p-3 text-phosphor"
    >
      <h2 className="label text-xs text-dim">Transfers</h2>
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
                ) : (
                  t.state !== "checking" && (
                    <button type="button" aria-label={`Cancel ${t.name}`} onClick={() => cancelTransfer(t.key)} className={btn}>
                      Cancel
                    </button>
                  )
                )}
              </div>
              <div className="h-1 bg-ink" aria-hidden>
                <div className={`h-1 ${t.state === "failed" ? "bg-rec" : "bg-field"}`} style={{ width: `${pct}%` }} />
              </div>
              <p className={`text-xs ${t.state === "failed" ? "text-rec" : t.state === "done" ? "text-signal" : "text-dim"}`}>
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
