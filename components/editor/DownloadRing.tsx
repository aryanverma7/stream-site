"use client";

const gb = (n: number) => (n / 1024 ** 3).toFixed(1);
const R = 7;
const C = 2 * Math.PI * R;

/** An 18px ring showing how much of a version is in this browser. */
export function DownloadRing({ doneBytes, total }: { doneBytes: number; total: number }) {
  const f = total > 0 ? Math.min(doneBytes / total, 1) : 0;
  const done = total > 0 && doneBytes >= total;
  const label = done ? "Downloaded · plays from this computer" : `Downloaded ${gb(doneBytes)} of ${gb(total)} GB (${Math.floor(f * 100)}%)`;
  return (
    <svg role="img" aria-label={label} width="18" height="18" viewBox="0 0 18 18" className={`shrink-0 ${done ? "text-signal" : "text-field"}`}>
      <title>{label}</title>
      <circle cx="9" cy="9" r={R} fill="none" strokeWidth="2" className="stroke-seam" />
      <circle
        cx="9"
        cy="9"
        r={R}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - f)}
        transform="rotate(-90 9 9)"
      />
      {done && <path data-check d="M5.5 9.2l2.3 2.3 4.7-4.9" fill="none" stroke="currentColor" strokeWidth="1.8" />}
    </svg>
  );
}
