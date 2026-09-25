import type { ReactNode } from "react";

/**
 * One monitor on the wall: an OSD strip naming the feed, then the picture.
 * Shared by the public site and the admin so a "feed" means the same
 * object everywhere.
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
    dark: "bg-bezel-2 text-phosphor",
    field: "wallpaper",
    alert: "bg-rec text-phosphor",
    dim: "bg-bezel text-dim",
  }[tone];

  return (
    <div className={`flex flex-col border border-seam bg-bezel shadow-[0_12px_32px_rgb(0_0_0_/_0.35)] ${className}`}>
      <div className={`osd flex items-center justify-between gap-3 px-3 py-1.5 text-lg ${strip}`}>
        <span className="truncate">{label}</span>
        {right && <span className="flex shrink-0 items-center gap-2">{right}</span>}
      </div>
      <div className={`relative min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
}
