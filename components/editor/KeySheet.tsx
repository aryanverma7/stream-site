"use client";

import { useEffect, useRef } from "react";

export const KEYS: [string, string][] = [
  ["Space / K", "Play or pause"],
  ["← / →", "Back / forward 5 s"],
  ["J / L", "Back / forward 10 s"],
  [", / .", "One frame back / forward"],
  ["< / >", "Slower / faster"],
  ["0 – 9", "Jump to 0 – 90%"],
  ["C", "Comment at this moment"],
  ["G", "General comment"],
  ["V", "Compare versions"],
  ["F", "Fullscreen"],
  ["?", "This sheet"],
  ["Esc", "Close the sheet or comment box"],
];

/**
 * The key list. Closing (Esc or ?) is usePlayerKeys's job; the button is for the pointer.
 * Focus moves into the sheet when it opens, Tab stays inside, and focus goes back on close.
 */
export function KeySheet({ onClose }: { onClose(): void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    close.current?.focus();
    return () => {
      if (before?.isConnected) before.focus();
    };
  }, []);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="dialog-backdrop absolute inset-0 z-20 grid place-items-center bg-ink/80 p-4"
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        e.preventDefault(); // Close is the sheet's only control
        close.current?.focus();
      }}
    >
      <div className="dialog-in slab-flat max-h-full w-full max-w-md overflow-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="stencil tilt text-2xl">Keyboard shortcuts</h3>
          <button ref={close} type="button" onClick={onClose} className="menu-pop label border-2 border-phosphor px-2 py-1 text-[11px] hover:bg-phosphor hover:text-ink">
            Close
          </button>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {KEYS.map(([k, what]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-field">{k}</dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
