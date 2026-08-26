"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Fetches /api/logs?lines=N - already built and tested in Task #4.
 * Manual refresh, same reasoning as useAdminStatus.
 */
export function useAdminLogs(lineCount: number = 200): {
  lines: string[];
  loading: boolean;
  error: boolean;
  refresh: () => void;
} {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/logs?lines=${lineCount}`, { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) throw new Error(`logs request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => setLines(Array.isArray(data.lines) ? data.lines : []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [lineCount]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { lines, loading, error, refresh };
}
