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
    <section className="flex min-h-screen w-full flex-col items-center justify-center gap-8 bg-[#12212c] px-6 py-16 text-[#ECE8E1]">
      <h2
        className="text-2xl tracking-[0.2em]"
        style={{ fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700 }}
      >
        CLIPS
      </h2>

      {loading && <p className="text-sm uppercase tracking-widest text-[#9AA3AC]">Loading clips...</p>}

      {!loading && clips.length === 0 && (
        <p className="text-sm text-[#9AA3AC]">No clips uploaded yet - check back soon.</p>
      )}

      {!loading && clips.length > 0 && (
        <div className="flex flex-wrap justify-center gap-6">
          {clips.map((clip) => (
            <ClipCard key={clip.filename} clip={clip} onExpand={setExpandedClip} />
          ))}
        </div>
      )}

      {expandedClip && <ClipModal clip={expandedClip} onClose={() => setExpandedClip(null)} />}
    </section>
  );
}
