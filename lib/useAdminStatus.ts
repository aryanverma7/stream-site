"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The next-round credit prediction the roulette's affordability filter
 * runs on, mirrored here so it can be tracked from the dashboard rather
 * than only being visible on the overlay mid-round.
 *
 * Optional on AdminStatus rather than required: a backend that hasn't been
 * updated yet simply doesn't send the key, and the panel says so instead
 * of rendering a row of undefineds.
 */
export interface CreditPrediction {
  predicted_credits: number | null;
  readings: number[];
  filter_enabled: boolean;
  votable_count: number;
  total_weapons: number;
  votable_weapons: string[];
  weapon_creds_costs: Record<string, number>;
}

export interface AdminStatus {
  streamerbot_connected: boolean;
  /**
   * Whether Streamer.bot accepted the event subscription. Separate from
   * the connection flag because an open socket that was never subscribed
   * delivers no chat events at all, which is indistinguishable from a
   * quiet chat - and that exact state is what stopped every chat command
   * from firing. Optional for the same reason as credit_prediction below.
   */
  streamerbot_subscribed?: boolean;
  credit_prediction?: CreditPrediction | null;
  widget_connections: {
    total: number;
    roulette: number;
    badge: number;
    spotify: number;
  };
  obs_websocket_connected: boolean | null;
  ocr_loop_running: boolean | null;
  cloudflare_tunnel_up: boolean | null;
}

/**
 * Fetches /api/status - already built and tested in Task #4. Manual
 * refresh rather than auto-polling: an admin actively checking this page
 * can click refresh, which avoids an extra timer to maintain for a tool
 * that's only ever open while someone's actually looking at it.
 *
 * credentials: "same-origin" is explicit here (it's actually the default
 * for same-origin fetches already) specifically to make clear this relies
 * on the browser's existing session cookie from the GitHub OAuth login -
 * no separate auth handling needed on the frontend, since the backend's
 * own middleware already gates /admin and everything under /api/* at the
 * HTTP level before any of this code ever runs.
 */
export function useAdminStatus(): {
  status: AdminStatus | null;
  loading: boolean;
  error: boolean;
  refresh: () => void;
} {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(false);
    fetch("/api/status", { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((data) => setStatus(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, loading, error, refresh };
}
