"use client";

import { useState } from "react";
import { useClips, Clip } from "@/lib/useClips";
import { ClipCard } from "./ClipCard";
import { ClipModal } from "./ClipModal";

/**
 * Per spec Section 8: 2-3 featured clips shown as cards (not a full
 * gallery grid), consuming the already-tested Task #4 backend.
 */
export function ClipsSection() {
  const { clips, loading } = useClips();
  const [expandedClip, setExpandedClip] = useState<Clip | null>(null);

  return (
    <section className="w-full bg-ink px-4 py-16 text-phosphor sm:px-6 md:py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <h2 className="stencil text-[clamp(3rem,9vw,5.5rem)] text-field">Clips</h2>

        {loading && <p className="label text-xs text-dim">Loading clips...</p>}

        {!loading && clips.length === 0 && (
          <div className="flex items-center gap-4 border border-dashed border-seam p-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- static export, local sticker */}
            <img src="/stickers/huh.png" alt="" className="sticker w-16 rotate-[-6deg]" />
            <p className="text-sm text-dim">No clips uploaded yet - check back soon.</p>
          </div>
        )}

        {!loading && clips.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {clips.map((clip) => (
              <ClipCard key={clip.filename} clip={clip} onExpand={setExpandedClip} />
            ))}
          </div>
        )}
      </div>

      {expandedClip && <ClipModal clip={expandedClip} onClose={() => setExpandedClip(null)} />}
    </section>
  );
}
