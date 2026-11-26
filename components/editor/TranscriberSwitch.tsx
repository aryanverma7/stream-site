"use client";

import { useEffect, useState } from "react";
import { useTranscriber } from "@/lib/useTranscriber";

/** "3 min ago" from two times in seconds. */
export function ago(at: number, now: number): string {
  const m = Math.floor(Math.max(0, now - at) / 60);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
}

const pop = "menu-pop label whitespace-nowrap border-2 border-ink px-3 py-1.5 text-xs";

/**
 * The top bar's transcriber switch: the button flips the gaming PC's
 * transcriber between On and Paused; the arrow opens its options (auto
 * for new versions, when the PC was last heard from, the queue).
 */
export function TranscriberSwitch({ now = () => Date.now() / 1000 }: { now?: () => number }) {
  const t = useTranscriber();
  const [open, setOpen] = useState(false);

  // Esc closes the panel only, like the bell's.
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

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        role="switch"
        aria-checked={t.enabled}
        onClick={() => void t.setEnabled(!t.enabled)}
        className={`${pop} ${t.enabled ? "bg-ink text-phosphor" : "text-ink hover:bg-ink hover:text-phosphor"}`}
      >
        Transcriber: {t.enabled ? "On" : "Paused"}
      </button>
      <button
        type="button"
        aria-label="Transcriber options"
        aria-expanded={open}
        aria-controls="transcriber-panel"
        onClick={() => setOpen(!open)}
        className={`${pop} border-l-0 px-2 text-ink hover:bg-ink hover:text-phosphor`}
      >
        ▾
      </button>
      {t.error && !open && (
        <span role="alert" className="absolute right-0 top-full z-40 mt-2 whitespace-nowrap border-2 border-rec bg-ink px-2 py-1 text-xs text-rec">
          {t.error}
        </span>
      )}
      {open && (
        <div id="transcriber-panel" className="dialog-in slab-flat absolute right-0 top-full z-40 mt-3 w-72 max-w-[calc(100vw-2rem)] space-y-2 p-4 text-sm text-phosphor">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={t.auto} onChange={(e) => void t.setAuto(e.target.checked)} />
            Auto for new versions
          </label>
          <p className="text-dim">{t.lastSeen === null ? "PC not seen yet" : `PC last seen ${ago(t.lastSeen, now())}`}</p>
          <p className="text-dim">
            {t.running > 0 ? "Transcribing now · " : ""}
            {t.queued} waiting
          </p>
          {t.error && <p role="alert" className="text-rec">{t.error}</p>}
        </div>
      )}
    </div>
  );
}
