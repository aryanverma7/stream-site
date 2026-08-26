"use client";

import { useEffect, useState } from "react";

export interface VideoRecommendation {
  id: string;
  title: string;
  thumbnail: string;
  url: string;
}

/**
 * Fetches the curated YouTube recommendations shown when offline. One-shot
 * fetch, no polling needed - this list only changes when the streamer
 * updates config.json, not something a visitor's session needs to catch
 * live. Backend route already built and confirmed working in Plan A.
 */
export function useVideoRecommendations(): { videos: VideoRecommendation[]; loading: boolean } {
  const [videos, setVideos] = useState<VideoRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/public/videos")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setVideos(Array.isArray(data.videos) ? data.videos : []);
      })
      .catch(() => {
        if (!cancelled) setVideos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { videos, loading };
}
