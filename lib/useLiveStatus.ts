"use client";

import { useEffect, useState } from "react";

/**
 * Polls /api/public/live-status (already built and confirmed working
 * against the real backend in Plan A) at a fixed interval. Relative URL
 * deliberately - the site and the API are served from the same origin, so
 * no domain needs to be hardcoded here at all.
 *
 * Returns null while the first check is still in flight (avoids flashing
 * an "offline" state before we actually know), then true/false afterward.
 * A failed fetch defaults to false (offline) rather than leaving the UI
 * stuck loading forever or throwing - matching the same fail-safe
 * philosophy as the rest of this project's public-facing routes.
 */
export function useLiveStatus(pollIntervalMs = 60_000): boolean | null {
  const [live, setLive] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/public/live-status");
        const data = await res.json();
        if (!cancelled) setLive(Boolean(data.live));
      } catch {
        if (!cancelled) setLive(false);
      }
    }

    check();
    const interval = setInterval(check, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pollIntervalMs]);

  return live;
}
