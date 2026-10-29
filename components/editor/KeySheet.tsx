"use client";

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

/** The key list. Closing (Esc or ?) is usePlayerKeys's job; the button is for the pointer. */
export function KeySheet({ onClose }: { onClose(): void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="absolute inset-0 z-20 grid place-items-center bg-ink/80 p-4">
      <div className="max-h-full w-full max-w-md overflow-auto border border-seam bg-bezel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="osd text-2xl">Keyboard shortcuts</h3>
          <button type="button" onClick={onClose} className="label border border-seam px-2 py-1 text-[11px] hover:border-field">
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
