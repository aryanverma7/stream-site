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
      className="group relative aspect-video w-72 overflow-hidden rounded border border-[#34f5c5]/20 bg-[#151F2B] transition-colors hover:border-[#34f5c5]/50"
    >
      <video
        ref={videoRef}
        src={clip.url}
        muted
        loop
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-transparent to-transparent p-3">
        <p className="text-left text-sm font-semibold capitalize text-[#ECE8E1] group-hover:text-[#34f5c5]">
          {clip.title}
        </p>
      </div>
    </button>
  );
}
