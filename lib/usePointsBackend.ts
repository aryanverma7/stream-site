"use client";

import { useCallback, useEffect, useState } from "react";

export type PointsBackend = "api" | "local";

export const POINTS_BACKENDS: PointsBackend[] = ["api", "local"];

function isPointsBackend(value: unknown): value is PointsBackend {
  return typeof value === "string" && (POINTS_BACKENDS as string[]).includes(value);
}

/**
 * Reads and switches which points ledger the backend is using.
 *
 * Reads from GET /api/status rather than GET /api/config on purpose:
 * /api/status reports the value the backend actually resolved, including
 * its fallback when points_backend holds a typo, while /api/config would
 * report the raw string and disagree. It also means this hook and the
 * Status panel's own ledger row can never drift apart - one fact, one
 * source.
 *
 * Writes through PUT /api/config, which takes a partial object, so this
 * sends only points_backend and cannot clobber a secret by round-tripping
 * the whole file. config.set()/save() write to the same in-memory object
 * the bot reads live, so the switch takes effect on the next points call
 * with no restart.
 *
 * A backend older than this build reports no points_backend at all; that
 * arrives here as null and the control renders as unavailable rather than
 * guessing a default and offering to "switch" to the value already live.
 */
export function usePointsBackend(): {
  backend: PointsBackend | null;
  loading: boolean;
  switching: boolean;
  error: string | null;
  switchTo: (next: PointsBackend) => Promise<void>;
} {
  const [backend, setBackend] = useState<PointsBackend | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/status", { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) throw new Error(`status request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (isPointsBackend(data?.points_backend)) setBackend(data.points_backend);
      })
      .catch(() => setError("Couldn't read which points ledger is live"))
      .finally(() => setLoading(false));
  }, []);

  const switchTo = useCallback(async (next: PointsBackend) => {
    setSwitching(true);
    setError(null);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points_backend: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `switch failed: ${res.status}`);
      }
      setBackend(next);
    } catch (err) {
      // Deliberately leaves `backend` alone. A failed switch means the
      // ledger did NOT change, so the control must keep showing the one
      // that is still live rather than blanking out or moving to the
      // value that was refused.
      setError(err instanceof Error ? err.message : "Switch failed");
    } finally {
      setSwitching(false);
    }
  }, []);

  return { backend, loading, switching, error, switchTo };
}
