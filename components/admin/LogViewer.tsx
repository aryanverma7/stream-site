"use client";

import { useAdminLogs } from "@/lib/useAdminLogs";

export function LogViewer() {
  const { lines, loading, error, refresh } = useAdminLogs(200);

  return (
    <div className="slab relative p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="stencil tilt text-4xl text-phosphor">Backend Logs</h3>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="menu-pop label border-2 border-phosphor bg-ink px-3 py-1.5 text-xs text-phosphor shadow-[3px_3px_0_var(--field-deep)] hover:bg-phosphor hover:text-ink disabled:opacity-40"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <p className="text-sm text-rec">Couldn&apos;t reach the backend - try refreshing.</p>}

      {!error && lines.length === 0 && !loading && (
        <p className="text-sm text-dim">No log lines yet.</p>
      )}

      {lines.length > 0 && (
        <pre className="max-h-[70vh] overflow-y-auto whitespace-pre-wrap break-all border-2 border-seam bg-ink p-4 font-mono text-[11.5px] leading-relaxed text-phosphor/85">
          {lines.join("\n")}
        </pre>
      )}
    </div>
  );
}
