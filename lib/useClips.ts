"use client";

import { useEffect, useState } from "react";

export interface Clip {
  filename: string;
  url: string;
  title: string;
}

/**
 * Fetches the clip list once on mount - no polling needed, matching the
 * same reasoning as useVideoRecommendations: this only changes when the
 * streamer drops a new file into clips/, not something a visitor's
 * session needs to catch live. Backend route already built and tested
 * in Task #4 (public_api.py's list_clips).
 */
export function useClips(): { clips: Clip[]; loading: boolean } {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/public/clips")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setClips(Array.isArray(data.clips) ? data.clips : []);
      })
      .catch(() => {
        if (!cancelled) setClips([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { clips, loading };
}
