"use client";

import { useEffect } from "react";
import { Clip } from "@/lib/useClips";

interface ClipModalProps {
  clip: Clip;
  onClose: () => void;
}

/**
 * The "click expands to a fuller view with sound" half of spec Section 8 -
 * a simple self-contained overlay, since this is the only modal use case
 * on the site so far (no generic modal system needed yet).
 */
export function ClipModal({ clip, onClose }: ClipModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={clip.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/92 p-4 sm:p-6"
      onClick={onClose}
    >
      <div className="crt-on w-full max-w-4xl border border-seam bg-bezel" onClick={(e) => e.stopPropagation()}>
        <video src={clip.url} controls autoPlay className="block w-full" />
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <p className="font-bold capitalize text-phosphor">{clip.title}</p>
          <button
            type="button"
            onClick={onClose}
            className="label border border-seam px-3 py-1.5 text-xs text-phosphor transition-colors hover:border-field hover:text-field"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
