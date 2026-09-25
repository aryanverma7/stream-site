"use client";

import { useVideoRecommendations } from "@/lib/useVideoRecommendations";

/**
 * Shown when offline - actively funnels visitors toward curated YouTube
 * content instead of a dead end (spec Section 6, decided during
 * brainstorming over an earlier "last stream's clip thumbnail" idea).
 */
export function OfflineRecommendations() {
  const { videos, loading } = useVideoRecommendations();

  if (loading) {
    return <p className="label text-xs text-dim">Loading recommendations...</p>;
  }

  if (videos.length === 0) {
    return null;
  }

  // Each video is a tape off the archive shelf: the thumbnail as the
  // picture, a blue spine label with a tape number and the title.
  return (
    <div className="flex flex-col gap-4">
      <h3 className="stencil text-4xl text-phosphor">Archive tapes</h3>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video, i) => (
          <a
            key={video.id}
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col border border-seam bg-bezel transition-[transform,border-color] duration-200 ease-out hover:-translate-y-1 hover:border-field"
          >
            <div className="crt relative overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- static export, external YouTube thumbnail URL, next/image's optimizer doesn't apply here */}
              <img
                src={video.thumbnail}
                alt=""
                className="aspect-video w-full object-cover grayscale-[35%] transition-[filter] duration-300 group-hover:grayscale-0"
              />
              <span className="label absolute left-2 top-2 z-10 flex items-center gap-1.5 bg-ink/80 px-2 py-1 text-[11px] text-phosphor">
                <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden>
                  <path d="M1 0.5 9.5 5 1 9.5z" fill="currentColor" />
                </svg>
                Play
              </span>
            </div>
            <div className="wallpaper flex items-start gap-3 px-3 py-2.5">
              <span className="osd shrink-0 pt-0.5 text-lg">T-{String(i + 1).padStart(2, "0")}</span>
              <p className="text-sm font-bold leading-snug">{video.title}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
