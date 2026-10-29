import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaLink } from "./opfsMedia";

export const mediaUrl = (iterationId: number) => "/editor/media/" + iterationId;
export const NO_WORKER = "This browser can't play from the download; use Chrome or Firefox";
const START_FAILED = "Playback from the download could not start";

export type MediaInfo = {
  projectId: number;
  fileId: string;
  size: number;
  mime: string;
  /** Every chunk is on disk: provide sends no link (no Mac Mini call); the worker asks if it ever needs Drive. */
  downloaded?: boolean;
  getLink(fresh?: boolean): Promise<MediaLink>;
};

/**
 * Registers the playback service worker (public/editor/media-sw.js), tells it
 * about each version and answers its "need-link" requests with a fresh link.
 * The token only travels in postMessage, never a URL or storage.
 */
export function useMediaWorker() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const infos = useRef(new Map<number, MediaInfo>());

  // The info is posted even when the link cannot be had (link: null), so the
  // worker can still play what is on disk; the link's failure is rethrown.
  const send = useCallback(async (iterationId: number, info: MediaInfo, fresh: boolean, withLink: boolean) => {
    let link: MediaLink | null = null;
    let failure: unknown = null;
    if (withLink) {
      try {
        const got = await info.getLink(fresh);
        // a cached link's expires_in is its lifetime when fetched, not what is left
        link = { ...got, expires_at: got.expires_at ?? Date.now() + got.expires_in * 1000 };
      } catch (e) {
        failure = e ?? new Error("No playback link");
      }
    }
    const { projectId, fileId, size, mime } = info;
    navigator.serviceWorker?.controller?.postMessage({ type: "media", iterationId, projectId, fileId, size, mime, link });
    if (failure) throw failure;
  }, []);

  useEffect(() => {
    const sw = typeof navigator === "undefined" ? undefined : navigator.serviceWorker;
    let live = true;
    if (!sw) {
      Promise.resolve().then(() => live && setError(NO_WORKER));
      return () => void (live = false);
    }
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== "need-link") return;
      const info = infos.current.get(e.data.iterationId);
      if (!info) return;
      // a downloaded version plays from disk: answer at once, then fetch a link in the background
      if (info.downloaded) void send(e.data.iterationId, info, false, false);
      send(e.data.iterationId, info, true, true).catch(() => {}); // the worker answers 503 without a link
    };
    sw.addEventListener("message", onMessage);
    sw.register("/editor/media-sw.js", { scope: "/editor" })
      .then(() => sw.ready)
      .then(() => sw.controller ?? new Promise((res) => sw.addEventListener("controllerchange", res, { once: true })))
      .then(() => live && setReady(true))
      .catch(() => live && setError(START_FAILED));
    return () => {
      live = false;
      sw.removeEventListener("message", onMessage);
    };
  }, [send]);

  const provide = useCallback(
    (iterationId: number, info: MediaInfo) => {
      infos.current.set(iterationId, info);
      return send(iterationId, info, false, !info.downloaded);
    },
    [send],
  );

  return { ready, error, provide };
}
