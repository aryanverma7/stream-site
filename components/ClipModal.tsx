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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
      onClick={onClose}
    >
      <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <video src={clip.url} controls autoPlay className="w-full rounded" />
        <div className="mt-3 flex items-center justify-between">
          <p className="capitalize text-[#ECE8E1]">{clip.title}</p>
          <button
            type="button"
            onClick={onClose}
            className="text-sm uppercase tracking-widest text-[#ECE8E1]/60 hover:text-[#34f5c5]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
