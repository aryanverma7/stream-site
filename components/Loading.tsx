/**
 * The one loading mark: a red starburst with a paper star inside that ratchets round with a kick,
 * and the words beside it. `overlay` centres it over a video while it buffers. Reduced motion: a still frame.
 */
export function Loading({ label = "Loading…", overlay = false, className = "" }: { label?: string; overlay?: boolean; className?: string }) {
  const mark = (
    <span className={`loader ${overlay ? "" : className}`}>
      <span className="loader-star" aria-hidden="true">
        <span />
      </span>
      <span className="osd loader-word">{label}</span>
    </span>
  );
  if (!overlay) return mark;
  return (
    <span className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center ${className}`}>{mark}</span>
  );
}
