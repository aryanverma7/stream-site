"use client";

import { useAdminStatus } from "@/lib/useAdminStatus";

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
    </div>
  );
}
