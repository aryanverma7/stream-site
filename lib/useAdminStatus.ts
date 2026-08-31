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
  /**
   * What is actually left for a gun once shields and abilities are taken
   * out - the number the roster was built from. The raw reading is what
   * the streamer sees in game, and showing only that makes a correct
   * roster look broken.
   */
  spendable_credits?: number | null;
  reserved_credits?: number | null;
  /**
   * Which agent's kit the reserve was calculated for, and what that kit
   * costs. A null cost means no prices are on file for them and the flat
   * fallback is in use, which is the state somebody has to fix.
   */
  agent?: string | null;
  agent_kit_cost?: number | null;
  /**
   * Whether the roster was built for a pistol round. Worth its own field
   * because it changes the roster twice over - a smaller reserve, and the
   * sidearms staying on the wheel - and without it a pistol-round roster
   * reads as the filter misbehaving.
   */
  pistol_round?: boolean;
  readings: number[];
  /**
   * The last value OCR ever read, and how long ago - which survives the
   * per-buy-phase history reset that `readings` does not. Optional because
   * a backend older than this field simply doesn't send it, and because
   * an empty window with no last reading at all is a genuinely different
   * situation from one that had a reading four minutes ago.
   */
  last_reading?: { credits: number | null; age_seconds: number | null } | null;
  filter_enabled: boolean;
  votable_count: number;
  total_weapons: number;
  votable_weapons: string[];
  weapon_creds_costs: Record<string, number>;
}

/**
 * Whether the gaming PC's OCR agent is switched on.
 *
 * `connected` comes from the agent's own heartbeat, not from whether
 * captures are arriving - captures only travel while the buy menu is open,
 * so their absence is the normal state for most of a match and says
 * nothing at all about whether the agent is running.
 */
export interface OcrAgentStatus {
  connected: boolean;
  last_heartbeat_age_seconds: number | null;
  last_capture_age_seconds: number | null;
  last_accepted_age_seconds: number | null;
  captures_received: number;
  captures_accepted: number;
  heartbeat_timeout_seconds: number;
  tesseract_available: boolean;
}

/**
 * Whether the public hostname still reaches the backend. `reachable` is
 * tri-state: null means the check has no address configured or hasn't run
 * yet, and `detail` is the sentence explaining which.
 */
export interface PublicUrlStatus {
  reachable: boolean | null;
  url: string | null;
  detail: string;
  checked_age_seconds: number | null;
}

/**
 * What the wheel is doing, and what it last landed on.
 *
 * `last_result` deliberately outlives both the session that produced it
 * and the forced-buy badge: the question it answers - which gun am I
 * supposed to be buying - gets asked during the buy phase, by which point
 * the overlay has finished its spin. Answering it used to mean opening
 * the stream on a second screen to watch a widget.
 */
export interface RouletteResult {
  winner: string | null;
  randomly_picked: boolean;
  final_weights: Record<string, number>;
  wheel_shares: Record<string, number>;
  predicted_credits: number | null;
  platform: string;
  age_seconds: number;
  winner_share_percent: number | null;
  total_votes: number;
}

export interface RouletteStatus {
  active: {
    weights: Record<string, number>;
    wheel_shares: Record<string, number>;
    predicted_credits: number | null;
    platform: string;
    seconds_elapsed: number;
  } | null;
  last_result: RouletteResult | null;
  forced_buy: { weapon: string | null; phase: string | null };
  on_cooldown: boolean;
}

/**
 * Live Valorant state from the Overwolf app on the gaming PC.
 *
 * `money` is the local player's CURRENT credits, which is deliberately not
 * the same number as `CreditPrediction.predicted_credits` - that one is
 * Valorant's own projection for NEXT round, read off a screenshot. They
 * agree during a buy phase and nowhere else. Both are shown, side by side,
 * because this pipeline is the one that could replace the OCR entirely and
 * neither has earned that yet.
 */
export interface GameEventsStatus {
  connected: boolean;
  last_snapshot_age_seconds: number | null;
  snapshot_timeout_seconds: number;
  app_version: string | null;
  game_running: boolean;
  round_phase: string | null;
  round_number: number | null;
  score: { won: number | null; lost: number | null } | null;
  match_outcome: string | null;
  map: string | null;
  game_mode: string | null;
  agent: string | null;
  money: number | null;
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
  // Tri-state: null when Streamer.bot never issued an authentication
  // challenge, false only when one was answered and refused.
  streamerbot_authenticated?: boolean | null;
  credit_prediction?: CreditPrediction | null;
  // Optional for the same reason as everything else here - the Mac Mini
  // routinely runs a backend older than the built site.
  roulette?: RouletteStatus | null;
  game_events?: GameEventsStatus | null;
  widget_connections: {
    total: number;
    roulette: number;
    badge: number;
    spotify: number;
  };
  // Both optional for the same reason as credit_prediction above: the Mac
  // Mini routinely runs a backend older than the built site, and a panel
  // that says "not reporting" is more useful than one rendering undefined.
  ocr_agent?: OcrAgentStatus | null;
  public_url?: PublicUrlStatus | null;
  // Which points ledger the backend is reading: "api" for Streamlabs'
  // real Loyalty Points, "local" for the flat-file stand-in that stands
  // in while Streamlabs' API approval is pending. Optional like the rest,
  // and worth showing precisely because the two are indistinguishable
  // from the numbers alone - a local ledger reads 0 for a viewer with
  // thousands of real points, which looks exactly like a broken lookup.
  points_backend?: string;
  obs_websocket_connected: boolean | null;
}

/**
 * How often the panel re-reads /api/status on its own.
 *
 * This used to be manual-only, on the reasoning that a page nobody is
 * looking at doesn't need a timer. That reasoning was wrong about how the
 * page is actually used: it's open on a second monitor during setup while
 * things are being plugged in, restarted and calibrated on two other
 * machines, and every one of those changes has to be discovered by
 * clicking. Five seconds is short enough that a restart on the Mac Mini
 * shows up before you've finished alt-tabbing back, and long enough that
 * a whole stream's worth of polling is still a trivial amount of traffic.
 */
export const STATUS_POLL_INTERVAL_MS = 5000;

/**
 * Fetches /api/status on mount, on a timer, and on demand.
 *
 * `loading` deliberately only covers the fetches a person is waiting on -
 * the first one and any explicit refresh(). A background poll flipping it
 * would make the Refresh button read "Refreshing..." every five seconds
 * forever, which looks like something is wrong rather than like something
 * is working. For the same reason a failed background poll leaves the
 * last good status on screen instead of blanking the panel; the error
 * flag says the last attempt failed, and the values keep their own
 * "checked N ago" context.
 *
 * Polling stops while the tab is hidden and fires immediately when it
 * comes back, since this page spends most of a stream behind OBS and a
 * poll nobody can see is pure tunnel traffic.
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

  const load = useCallback((visible: boolean) => {
    if (visible) {
      setLoading(true);
      setError(false);
    }
    return fetch("/api/status", { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setStatus(data);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => {
        if (visible) setLoading(false);
      });
  }, []);

  const refresh = useCallback(() => {
    load(true);
  }, [load]);

  useEffect(() => {
    load(true);
  }, [load]);

  useEffect(() => {
    const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

    const timer = setInterval(() => {
      if (!hidden()) load(false);
    }, STATUS_POLL_INTERVAL_MS);

    // Catching up on return matters more than the polling itself: whatever
    // was being fixed on another machine happened entirely while this tab
    // was hidden, so the first thing it should show is the result of it.
    const onVisibility = () => {
      if (!hidden()) load(false);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  return { status, loading, error, refresh };
}
