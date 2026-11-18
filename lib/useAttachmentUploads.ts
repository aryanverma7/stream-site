"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { editorApi } from "./editorApi";
import { resumableUpload } from "./resumableUpload";

export const ATTACHMENT_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
export const ATTACHMENT_MAX = 4;
export const REFUSED = "Images only (PNG, JPEG, WebP, GIF), up to 20 MB";

export type Pending = {
  key: number;
  name: string;
  /** A local preview of the picked file (object URL), revoked when it is removed. */
  preview: string;
  state: "uploading" | "ready" | "failed";
  sent: number;
  total: number;
  id?: number;
  error?: string;
};

let next = 1;

/**
 * Images picked for one comment or reply: each uploads at once, browser to
 * Drive, and the post sends only their ids (never bytes), so a comment
 * waiting in the unsent queue keeps its images.
 */
export function useAttachmentUploads(iterationId: number) {
  // The ref is the truth (updated synchronously, so two quick picks cannot both take the last slot); state renders it.
  const list = useRef<Pending[]>([]);
  const [items, setItems] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const aborts = useRef(new Map<number, AbortController>());

  const commit = (next: Pending[]) => {
    list.current = next;
    setItems(next);
  };
  const patch = (key: number, over: Partial<Pending>) => commit(list.current.map((x) => (x.key === key ? { ...x, ...over } : x)));

  useEffect(() => {
    const a = aborts.current;
    return () => {
      a.forEach((c) => c.abort());
      list.current.forEach((x) => URL.revokeObjectURL(x.preview));
    };
  }, []);

  const upload = useCallback(
    async (key: number, file: File, signal: AbortSignal) => {
      try {
        const { id, upload_url } = await editorApi<{ id: number; upload_url: string }>(`/iterations/${iterationId}/attachments`, {
          method: "POST",
          body: { name: file.name || "image", size: file.size, mime: file.type },
        });
        const done = await resumableUpload(file, upload_url, { signal, onProgress: (sent, total) => patch(key, { sent, total }) });
        await editorApi(`/attachments/${id}/complete`, { method: "POST", body: { file_id: done.id } });
        if (!signal.aborted) patch(key, { state: "ready", id, sent: file.size });
      } catch (e) {
        if (!signal.aborted) patch(key, { state: "failed", error: e instanceof Error ? e.message : "Upload failed" });
      } finally {
        aborts.current.delete(key);
      }
    },
    [iterationId],
  );

  const add = useCallback(
    (files: File[]) => {
      const images = files.filter((f) => ATTACHMENT_MIMES.includes(f.type) && f.size > 0 && f.size <= ATTACHMENT_MAX_BYTES);
      const room = Math.max(0, ATTACHMENT_MAX - list.current.length);
      setError(images.length < files.length ? REFUSED : images.length > room ? `At most ${ATTACHMENT_MAX} images` : null);
      const fresh = images.slice(0, room).map((f) => {
        const key = next++;
        const ctl = new AbortController();
        aborts.current.set(key, ctl);
        void upload(key, f, ctl.signal);
        return { key, name: f.name, preview: URL.createObjectURL(f), state: "uploading" as const, sent: 0, total: f.size };
      });
      if (fresh.length) commit([...list.current, ...fresh]);
    },
    [upload],
  );

  const remove = useCallback((key: number) => {
    aborts.current.get(key)?.abort();
    const gone = list.current.find((x) => x.key === key);
    if (gone) URL.revokeObjectURL(gone.preview);
    commit(list.current.filter((x) => x.key !== key));
  }, []);

  /** After the post is queued: the ids went with it, the previews are no longer needed. */
  const clear = useCallback(() => {
    list.current.forEach((x) => URL.revokeObjectURL(x.preview));
    commit([]);
    setError(null);
  }, []);

  return {
    items,
    error,
    add,
    remove,
    clear,
    /** Ids of the uploaded ones, for the post. */
    ids: items.filter((x) => x.state === "ready").map((x) => x.id as number),
    /** Send waits while any is still uploading or has failed (remove it, or it would silently be left out). */
    blocking: items.some((x) => x.state !== "ready"),
  };
}

export type AttachmentUploads = ReturnType<typeof useAttachmentUploads>;
