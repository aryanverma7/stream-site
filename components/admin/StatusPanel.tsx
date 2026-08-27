"use client";

import { useAdminStatus, type CreditPrediction } from "@/lib/useAdminStatus";

function StatusBadge({ value }: { value: boolean | null }) {
  if (value === null) {
    return <span className="text-xs uppercase tracking-widest text-[#9AA3AC]">Not yet implemented</span>;
  }
  return (
    <span
      className={`text-xs font-bold uppercase tracking-widest ${value ? "text-[#34f5c5]" : "text-[#B8323F]"}`}
    >
      {value ? "Connected" : "Disconnected"}
    </span>
  );
}

/**
 * Valorant's own credit glyph. Written as an escape rather than pasted in
 * literally so it survives any editor that isn't confident about the
 * character - it's the same symbol the roulette overlay prints.
 */
const CREDS = "\u00A4";

function CreditPredictionBlock({ prediction }: { prediction: CreditPrediction | null | undefined }) {
  if (!prediction) {
    return (
      <p className="text-xs text-[#9AA3AC]">
        This backend isn&apos;t reporting a credit prediction yet.
      </p>
    );
  }

  const { predicted_credits, readings, filter_enabled, votable_count, total_weapons } = prediction;
  const hasReading = predicted_credits !== null && predicted_credits !== undefined;

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold tabular-nums text-[#34f5c5]">
          {hasReading ? `${CREDS}${predicted_credits}` : "No reading yet"}
        </span>
        <span className="text-xs uppercase tracking-widest text-[#9AA3AC]">
          {filter_enabled
            ? `${votable_count} / ${total_weapons} weapons in budget`
            : `Filter off - all ${total_weapons} votable`}
        </span>
      </div>

      <p className="mt-1 text-xs text-[#9AA3AC]">
        {readings.length === 0
          ? "No valid readings in the window - the roulette will open the full roster."
          : `Window: ${readings.join(", ")} - the lowest wins, so the prediction is ${CREDS}${predicted_credits}.`}
      </p>

      {filter_enabled && hasReading && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {prediction.votable_weapons.map((weapon) => (
            <span
              key={weapon}
              className="rounded border border-[#34f5c5]/20 px-2 py-0.5 text-xs text-[#ECE8E1]"
            >
              {weapon}{" "}
              <span className="tabular-nums text-[#9AA3AC]">
                {CREDS}
                {prediction.weapon_creds_costs[weapon]}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatusPanel() {
  const { status, loading, error, refresh } = useAdminStatus();

  return (
    <div className="rounded border border-[#34f5c5]/20 bg-[#151F2B] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm uppercase tracking-widest text-[#ECE8E1]">System Status</h3>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="text-xs uppercase tracking-widest text-[#34f5c5]/70 hover:text-[#34f5c5] disabled:opacity-40"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <p className="text-sm text-[#B8323F]">Couldn&apos;t reach the backend - try refreshing.</p>}

      {status && (
        <div className="grid grid-cols-2 gap-4 text-sm text-[#ECE8E1]">
          <div>
            <p className="text-[#9AA3AC]">Streamer.bot</p>
            <StatusBadge value={status.streamerbot_connected} />
            {status.streamerbot_connected && status.streamerbot_subscribed === false && (
              <p className="mt-1 text-xs text-[#B8323F]">
                Connected, but no event subscription - no chat command can fire.
              </p>
            )}
            {status.streamerbot_connected && status.streamerbot_authenticated === false && (
              <p className="mt-1 text-xs text-[#B8323F]">
                Authentication refused - check streamerbot_ws_password. Chat replies won&apos;t send.
              </p>
            )}
          </div>
          <div>
            <p className="text-[#9AA3AC]">Widget connections</p>
            <p className="font-semibold">{status.widget_connections.total} total</p>
            <p className="text-xs text-[#9AA3AC]">
              Roulette: {status.widget_connections.roulette} · Badge: {status.widget_connections.badge} · Spotify:{" "}
              {status.widget_connections.spotify}
            </p>
          </div>
          <div>
            <p className="text-[#9AA3AC]">OBS WebSocket</p>
            <StatusBadge value={status.obs_websocket_connected} />
          </div>
          <div>
            <p className="text-[#9AA3AC]">OCR loop</p>
            <StatusBadge value={status.ocr_loop_running} />
          </div>
          <div>
            <p className="text-[#9AA3AC]">Cloudflare Tunnel</p>
            <StatusBadge value={status.cloudflare_tunnel_up} />
          </div>
        </div>
      )}

      {status && (
        <div className="mt-6 border-t border-[#34f5c5]/20 pt-4">
          <p className="mb-2 text-sm text-[#9AA3AC]">Next-round credits</p>
          <CreditPredictionBlock prediction={status.credit_prediction} />
        </div>
      )}
    </div>
  );
}
