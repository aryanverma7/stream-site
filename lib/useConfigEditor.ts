"use client";

import { useCallback, useEffect, useState } from "react";
import type { Schema } from "@/lib/settingsModel";

/**
 * Loads the admin config via GET /api/config (secrets arrive masked) and
 * its field metadata via GET /api/config/schema, in parallel. An older
 * backend has no schema route: a 404 there sets `schemaMissing` and the
 * page falls back to the raw-JSON view.
 *
 * save() PUTs exactly the payload it is given (the caller diffs) and, on
 * success, re-fetches both endpoints so masks and the schema reflect what
 * the backend actually stored. A 400 carries {error, field}; the field is
 * surfaced so the page can mark the offending input. A save that worked
 * followed by a re-fetch that did not is reported as `reloadFailed`, never
 * as a failed save.
 */
export function useConfigEditor(): {
  config: Record<string, unknown> | null;
  schema: Schema | null;
  schemaMissing: boolean;
  loading: boolean;
  error: boolean;
  saving: boolean;
  saveError: string | null;
  saveErrorField: string | null;
  saveSuccess: boolean;
  reloadFailed: boolean;
  save: (payload: Record<string, unknown>) => Promise<void>;
} {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveErrorField, setSaveErrorField] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [reloadFailed, setReloadFailed] = useState(false);

  const load = useCallback(async () => {
    const [cfgRes, schemaRes] = await Promise.all([
      fetch("/api/config", { credentials: "same-origin" }),
      fetch("/api/config/schema", { credentials: "same-origin" }),
    ]);
    if (!cfgRes.ok) throw new Error(`config request failed: ${cfgRes.status}`);
    if (schemaRes.status !== 404 && !schemaRes.ok) throw new Error(`schema request failed: ${schemaRes.status}`);
    return {
      cfg: await cfgRes.json(),
      sch: schemaRes.ok ? ((await schemaRes.json()) as Schema) : null,
    };
  }, []);

  const apply = useCallback(({ cfg, sch }: { cfg: Record<string, unknown>; sch: Schema | null }) => {
    setConfig(cfg);
    setSchema(sch);
    setSchemaMissing(sch === null);
  }, []);

  useEffect(() => {
    load()
      .then(apply)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [load, apply]);

  const save = useCallback(
    async (payload: Record<string, unknown>) => {
      setSaving(true);
      setSaveError(null);
      setSaveErrorField(null);
      setSaveSuccess(false);
      setReloadFailed(false);
      try {
        const res = await fetch("/api/config", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setSaveErrorField(typeof body.field === "string" ? body.field : null);
          throw new Error(body.error ?? `save failed: ${res.status}`);
        }
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed");
        setSaving(false);
        return;
      }
      setSaveSuccess(true);
      try {
        apply(await load());
      } catch {
        setReloadFailed(true);
      } finally {
        setSaving(false);
      }
    },
    [load, apply],
  );

  return { config, schema, schemaMissing, loading, error, saving, saveError, saveErrorField, saveSuccess, reloadFailed, save };
}
