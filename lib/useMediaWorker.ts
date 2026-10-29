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

  const send = useCallback(async (iterationId: number, info: MediaInfo, fresh: boolean) => {
    const got = await info.getLink(fresh);
    // a cached link's expires_in is its lifetime when fetched, not what is left
    const link = { ...got, expires_at: got.expires_at ?? Date.now() + got.expires_in * 1000 };
    const { projectId, fileId, size, mime } = info;
    navigator.serviceWorker?.controller?.postMessage({ type: "media", iterationId, projectId, fileId, size, mime, link });
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
      if (info) send(e.data.iterationId, info, true).catch(() => {}); // the worker answers 503 after its wait
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
      return send(iterationId, info, false);
    },
    [send],
  );

  return { ready, error, provide };
}
