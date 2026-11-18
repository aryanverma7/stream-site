import type { ReactNode } from "react";

/**
 * One panel on the page: a slanted black slab with a cut strip naming it,
 * then the picture. Shared by the public site and the admin so a "feed"
 * means the same object everywhere.
 */
export function FeedFrame({
  label,
  right,
  tone = "dark",
  className = "",
  bodyClassName = "",
  children,
}: {
  label: ReactNode;
  right?: ReactNode;
  tone?: "dark" | "field" | "alert" | "dim";
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const strip = {
    dark: "bg-phosphor text-ink",
    field: "wallpaper",
    alert: "bg-rec text-ink",
    dim: "bg-bezel-2 text-dim",
  }[tone];

  return (
    <div className={`slab relative flex flex-col p-[3px] ${className}`}>
      <div className={`osd strip-cut flex items-center justify-between gap-3 py-1.5 pl-3 pr-6 text-lg ${strip}`}>
        <span className="truncate">{label}</span>
        {right && <span className="flex shrink-0 items-center gap-2">{right}</span>}
      </div>
      <div className={`relative min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
}
