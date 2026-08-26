"use client";

import { useEffect, useState } from "react";

export interface SocialLinks {
  twitch?: string;
  youtube?: string;
  instagram?: string;
  discord?: string;
}

/**
 * Fetches the social links from /api/public/site-config - already built
 * and tested in Task #4, backed by config.public_safe()'s explicit
 * allowlist, so only social_links ever comes through here, never secrets.
 * One-shot fetch, matching the same pattern as useVideoRecommendations/
 * useClips - this only changes when the streamer edits config.json.
 */
export function useSiteConfig(): { socialLinks: SocialLinks; loading: boolean } {
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/public/site-config")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSocialLinks(data.social_links ?? {});
      })
      .catch(() => {
        if (!cancelled) setSocialLinks({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { socialLinks, loading };
}
