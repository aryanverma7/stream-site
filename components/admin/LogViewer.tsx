"use client";

import { useAdminLogs } from "@/lib/useAdminLogs";

export function LogViewer() {
  const { lines, loading, error, refresh } = useAdminLogs(200);

  return (
    <div className="rounded border border-[#34f5c5]/20 bg-[#151F2B] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm uppercase tracking-widest text-[#ECE8E1]">Backend Logs</h3>
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

      {!error && lines.length === 0 && !loading && (
        <p className="text-sm text-[#9AA3AC]">No log lines yet.</p>
      )}

      {lines.length > 0 && (
        <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap break-all font-mono text-xs text-[#ECE8E1]/80">
          {lines.join("\n")}
        </pre>
      )}
    </div>
  );
}
