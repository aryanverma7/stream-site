"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Fetches the FULL config (including secrets) via GET /api/config -
 * already built and tested in Task #4. Unlike the public site-config
 * endpoint (which uses an explicit allowlist to hide secrets), this one
 * deliberately shows everything - this is the admin's own personal
 * secrets file, and they need to see/edit the real values (a fresh
 * Streamlabs token, an updated Twitch secret, etc.), not a filtered view.
 *
 * save() sends the whole edited object back via PUT - simpler than
 * diffing against the original to find just the changed keys, and
 * harmless: re-sending unchanged values just re-sets them to what they
 * already were.
 */
export function useConfigEditor(): {
  config: Record<string, unknown> | null;
  loading: boolean;
  error: boolean;
  saving: boolean;
  saveError: string | null;
  saveSuccess: boolean;
  save: (updated: Record<string, unknown>) => Promise<void>;
} {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/config", { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) throw new Error(`config request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => setConfig(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async (updated: Record<string, unknown>) => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `save failed: ${res.status}`);
      }
      setConfig(updated);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, []);

  return { config, loading, error, saving, saveError, saveSuccess, save };
}
