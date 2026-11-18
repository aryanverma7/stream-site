"use client";

import { useRef } from "react";
import { Clip } from "@/lib/useClips";

interface ClipCardProps {
  clip: Clip;
  onExpand: (clip: Clip) => void;
}

/**
 * Per spec Section 8: thumbnail via first frame, hover-to-preview (muted),
 * click expands to a fuller view with sound. The <video> element itself
 * IS the thumbnail - no separate poster image needed, since browsers show
 * the first frame once metadata loads. Hovering plays it muted in place;
 * leaving resets back to that first-frame state.
 */
export function ClipCard({ clip, onExpand }: ClipCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = () => {
    videoRef.current?.play().catch(() => {
      // Autoplay can be blocked in some contexts even when muted - not
      // worth surfacing an error for a hover preview, just skip it.
    });
  };

  const handleMouseLeave = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  };

  return (
    <button
      type="button"
      onClick={() => onExpand(clip)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="slab slab-sm group relative flex w-full flex-col p-[3px] text-left transition-transform duration-150 ease-out hover:-translate-y-1 hover:-rotate-1"
    >
      <span className="crt relative block aspect-video overflow-hidden">
        <video
          ref={videoRef}
          src={clip.url}
          muted
          loop
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
        <span className="tag absolute left-2 top-2 z-10 flex items-center gap-1.5 bg-field-deep text-[11px] text-phosphor opacity-0 transition-opacity group-hover:opacity-100">
          Playing
        </span>
      </span>
      <span className="px-3 py-2.5 text-sm font-bold capitalize text-phosphor group-hover:text-field-hot">
        {clip.title}
      </span>
    </button>
  );
}
