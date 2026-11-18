"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { editorApi } from "@/lib/editorApi";
import { ATTACHMENT_MIMES, type AttachmentUploads } from "@/lib/useAttachmentUploads";

export type Attachment = { id: number; name: string; mime: string; size: number; drive_file_id: string };

const btn = "menu-pop label border-2 border-phosphor bg-ink px-2 py-1 text-[11px] text-phosphor hover:bg-phosphor hover:text-ink disabled:opacity-40";

/** Paste and drop on a form add images to its uploads (anything else is left to the browser). */
export function attachHandlers(uploads: AttachmentUploads) {
  const files = (list: FileList | null | undefined) => [...(list ?? [])];
  return {
    onPaste: (e: ClipboardEvent) => {
      const f = files(e.clipboardData?.files);
      if (f.length) {
        e.preventDefault();
        uploads.add(f);
      }
    },
    onDragOver: (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
    },
    onDrop: (e: DragEvent) => {
      const f = files(e.dataTransfer?.files);
      if (f.length) {
        e.preventDefault();
        uploads.add(f);
      }
    },
  };
}

/** The 📎 button and the picked images, each with its progress and a Remove. */
/** `label` names what the images are for, so each reply box's picker is told apart from the others. */
export function AttachmentPicker({ uploads, compact = false, label = "comment" }: { uploads: AttachmentUploads; compact?: boolean; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} aria-label={`Attach images to the ${label}`} onClick={() => input.current?.click()}>
          <svg aria-hidden viewBox="0 0 24 24" className="inline h-3.5 w-3.5 align-[-2px]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7L14 4.5a3.3 3.3 0 0 1 4.7 4.7L10.2 17.7a1.7 1.7 0 0 1-2.4-2.4L15.5 7.6" />
          </svg>
          {compact ? "" : " Image"}
        </button>
        <input
          ref={input}
          type="file"
          hidden
          multiple
          accept={ATTACHMENT_MIMES.join(",")}
          aria-label={`Images for the ${label}`}
          onChange={(e) => {
            uploads.add([...(e.target.files ?? [])]);
            e.target.value = ""; // the same file can be picked again
          }}
        />
        {uploads.items.map((x) => (
          <figure key={x.key} className="relative w-16">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
            <img src={x.preview} alt={x.name} className="h-12 w-16 border-2 border-phosphor object-cover shadow-[3px_3px_0_var(--field-deep)]" />
            <figcaption className="text-[10px] text-dim">
              {x.state === "ready" ? "Ready" : x.state === "failed" ? <span className="text-rec">Failed</span> : `${Math.floor((x.sent / (x.total || 1)) * 100)}%`}
            </figcaption>
            <button type="button" aria-label={`Remove ${x.name}`} className="absolute -right-1 -top-1 bg-ink px-1 text-[10px] text-rec" onClick={() => uploads.remove(x.key)}>
              ×
            </button>
          </figure>
        ))}
      </div>
      {uploads.error && <p role="alert" className="text-xs text-rec">{uploads.error}</p>}
      {uploads.items.find((x) => x.error) && <p className="text-xs text-rec">{uploads.items.find((x) => x.error)?.error}</p>}
    </div>
  );
}

/**
 * A saved image: fetched with the drive.file token in a header (never in the
 * img src), shown from a blob: URL that is revoked on unmount.
 */
// One download per image per page: a blob: URL is kept for the page's lifetime, so switching comment tabs
// (which remounts every item) never fetches the same up-to-20 MB image again.
const loaded = new Map<number, Promise<string>>();

function loadImage(id: number): Promise<string> {
  let p = loaded.get(id);
  if (!p) {
    p = (async () => {
      const link = await editorApi<{ url: string; access_token: string }>(`/attachments/${id}/link`);
      const r = await fetch(link.url, { headers: { Authorization: `Bearer ${link.access_token}` } });
      if (!r.ok) throw new Error(String(r.status));
      return URL.createObjectURL(await r.blob());
    })();
    p.catch(() => loaded.delete(id)); // a failure is tried again on the next mount
    loaded.set(id, p);
  }
  return p;
}

/** A saved image: fetched with the drive.file token in a header (never in the img src), shown from a blob: URL. */
function Thumb({ a, onOpen }: { a: Attachment; onOpen(url: string): void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    loadImage(a.id).then(
      (u) => live && setUrl(u),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [a.id]);
  if (failed) return <span className="text-[10px] text-dim">{a.name} (not available)</span>;
  if (!url) return <span className="inline-block h-12 w-16 border-2 border-seam bg-ink" aria-label={`Loading ${a.name}`} />;
  return (
    <button type="button" aria-label={`Open ${a.name}`} onClick={() => onOpen(url)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL of a Drive image */}
      <img src={url} alt={a.name} className="menu-pop h-12 w-16 border-2 border-phosphor object-cover shadow-[3px_3px_0_var(--field-deep)]" />
    </button>
  );
}

export function AttachmentThumbs({ attachments }: { attachments?: Attachment[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!attachments?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {attachments.map((a) => (
        <Thumb key={a.id} a={a} onOpen={setOpen} />
      ))}
      {open && (
        <div
          role="dialog"
          aria-label="Image"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4"
          onClick={() => setOpen(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setOpen(null);
            }
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL of a Drive image */}
          <img src={open} alt="" className="max-h-full max-w-full border-4 border-phosphor shadow-[10px_10px_0_var(--field-deep)]" />
          <button type="button" autoFocus className={`${btn} absolute right-4 top-4`} onClick={() => setOpen(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
