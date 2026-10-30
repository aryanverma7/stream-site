"use client";

import { useCallback, useState } from "react";
import { editorApi } from "./editorApi";
import { grade, measureMedia, thumbnail } from "./mediaChecks";
import type { Iteration } from "./useTape";

const NOTHING = { width: null, height: null, duration_s: null, fps: null, bitrate_mbps: null };
const mb = (b: number) => `${(b / 1e6).toFixed(1)} MB`;

/**
 * Checks and a thumbnail for a ready version that has none (its tab closed
 * while checking, or reconcile completed the upload): the person picks the
 * same file again (same name and size), and it is measured here exactly as
 * an upload is, then PUT to /media. The file never leaves the browser.
 */
export function useRunChecks(iteration: Pick<Iteration, "id" | "version" | "filename" | "size">, kind: "tape" | "reel", onDone?: () => void) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (file: File) => {
      setError(null);
      if (file.name !== iteration.filename || file.size !== iteration.size) {
        setError(`That is not v${iteration.version}'s file: pick ${iteration.filename} (${mb(iteration.size)})`);
        return;
      }
      setRunning(true);
      try {
        // as on upload: what cannot be measured grades "unknown", never a pass
        const measured = await measureMedia(file).catch(() => null);
        const thumb = await thumbnail(file).catch(() => null);
        await editorApi(`/iterations/${iteration.id}/media`, { method: "PUT", body: { checks: grade(measured ?? NOTHING, kind), thumbnail_b64: thumb } });
        onDone?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save the checks");
      } finally {
        setRunning(false);
      }
    },
    [iteration.id, iteration.version, iteration.filename, iteration.size, kind, onDone],
  );

  return { running, error, run };
}
