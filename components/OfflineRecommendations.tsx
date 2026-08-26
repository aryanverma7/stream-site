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
    return <p className="text-sm text-[#9AA3AC]">Loading recommendations...</p>;
  }

  if (videos.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {videos.map((video) => (
        <a
          key={video.id}
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group overflow-hidden rounded border border-[#34f5c5]/20 bg-[#151F2B] transition-colors hover:border-[#34f5c5]/50"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, external YouTube thumbnail URL, next/image's optimizer doesn't apply here */}
          <img src={video.thumbnail} alt="" className="aspect-video w-full object-cover" />
          <p className="p-3 text-sm font-semibold text-[#ECE8E1] group-hover:text-[#34f5c5]">
            {video.title}
          </p>
        </a>
      ))}
    </div>
  );
}
