import { useCallback, useEffect, useRef, useState } from "react";
import { editorApi } from "./editorApi";
import { chunkLength, dirName, downloadToOpfs, opened, versionDirs, type MediaLink } from "./opfsMedia";

export type MediaFile = {
  state: "checking" | "downloading" | "complete" | "error";
  present: boolean[];
  doneBytes: number;
  total: number;
  error: string | null;
  getLink(fresh?: boolean): Promise<MediaLink>;
};

type Iteration = { id: number; drive_file_id: string; size: number };

/**
 * Makes sure one version is fully in OPFS and reports progress. Unmounting
 * aborts the download and deletes nothing: keepOnlyProject and freeSpaceFor
 * own deletion.
 */
export function useMediaFile(iteration: Iteration | null, projectId: number, comparePartnerId: number | null): MediaFile {
  const [state, setState] = useState<MediaFile["state"]>("checking");
  const [present, setPresent] = useState<boolean[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<{ link: MediaLink; at: number } | null>(null);
  const id = iteration?.id ?? null;
  const fileId = iteration?.drive_file_id ?? "";
  const size = iteration?.size ?? 0;

  const getLink = useCallback(
    async (fresh = false) => {
      const c = cache.current;
      if (!fresh && c && (Date.now() - c.at) / 1000 < c.link.expires_in - 60) return c.link;
      const at = Date.now();
      const link = await editorApi<MediaLink>(`/iterations/${id}/media-link`);
      link.expires_at = at + link.expires_in * 1000;
      cache.current = { link, at };
      return link;
    },
    [id],
  );

  useEffect(() => {
    if (id === null) return;
    const ctl = new AbortController();
    cache.current = null;
    (async () => {
      await Promise.resolve(); // reset state off the effect's synchronous path
      setState("checking");
      setPresent([]);
      setError(null);
      const name = dirName(projectId, id, fileId);
      opened.set(name, Date.now());
      const root = await navigator.storage.getDirectory();
      for (const n of await versionDirs(root)) {
        if (n.startsWith(`it-${projectId}-${id}-`) && n !== name) await root.removeEntry(n, { recursive: true }).catch(() => {});
      }
      await downloadToOpfs({
        projectId,
        iterationId: id,
        fileId,
        size,
        getLink,
        signal: ctl.signal,
        root,
        protect: comparePartnerId === null ? [] : [`it-${projectId}-${comparePartnerId}-`],
        onProgress: (p) => {
          if (ctl.signal.aborted) return;
          setPresent(p);
          setState(p.every(Boolean) ? "complete" : "downloading");
        },
      });
      if (!ctl.signal.aborted) setState("complete");
    })().catch((e) => {
      if (ctl.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Download failed");
      setState("error");
    });
    return () => ctl.abort();
  }, [id, fileId, size, projectId, comparePartnerId, getLink]);

  const doneBytes = present.reduce((s, p, i) => s + (p ? chunkLength(size, i) : 0), 0);
  return { state, present, doneBytes, total: size, error, getLink };
}
