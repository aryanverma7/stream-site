"use client";

import { useEffect, useRef, useState } from "react";
import type { Comment, CommentsApi } from "@/lib/useComments";
import { CommentItem } from "./CommentItem";

const SCROLL_QUIET_MS = 5_000;
const FALLBACK_LENGTH_S = 4;
const TABS = ["Open", "All", "Resolved"] as const;

/** Timed by start, then general, then carried. */
export function orderComments(cs: Comment[]): Comment[] {
  const rank = (c: Comment) => (c.carried ? 2 : c.start_s === null ? 1 : 0);
  return [...cs].sort((a, b) => rank(a) - rank(b) || (a.start_s ?? 0) - (b.start_s ?? 0) || a.created_at - b.created_at || a.id - b.id);
}

export const isActive = (c: Comment, t: number) => !c.carried && c.start_s !== null && c.start_s <= t && t < (c.end_s ?? c.start_s + FALLBACK_LENGTH_S);

export function CommentPanel({
  cm,
  username,
  projectId,
  tapeId,
  currentTime,
  onSeek,
  now = Date.now,
}: {
  cm: CommentsApi;
  username: string;
  projectId: number;
  tapeId: number;
  currentTime: number;
  /** Absent while nothing is playable: the go-to buttons are then disabled. */
  onSeek?(s: number): void;
  now?: () => number;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Open");
  const list = useRef<HTMLUListElement>(null);
  const touched = useRef(-Infinity);
  const clock = useRef(now);
  const done = cm.comments.filter((c) => c.resolved).length;
  const shown = orderComments(cm.comments).filter((c) => tab === "All" || (tab === "Resolved") === c.resolved);
  const activeId = shown.find((c) => isActive(c, currentTime))?.id;

  useEffect(() => {
    if (activeId === undefined || clock.current() - touched.current < SCROLL_QUIET_MS) return;
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.current?.querySelector(`[data-comment="${activeId}"]`)?.scrollIntoView?.({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [activeId]);

  const touch = () => void (touched.current = clock.current());

  return (
    <aside aria-label="Comments" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="osd text-xl">
          {done} of {cm.comments.length} resolved
        </h3>
        <div role="tablist" className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`label border px-2 py-0.5 text-[10px] ${tab === t ? "border-field text-phosphor" : "border-seam text-dim"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {cm.error && <p role="alert" className="text-rec">{cm.error}</p>}
      {cm.failed.map((f) => (
        <p key={f.client_id} role="alert" className="border border-rec p-2 text-rec">
          Not sent: {f.message}
          <span className="block whitespace-pre-wrap break-words text-dim">{f.body}</span>
          <button type="button" className="label text-[10px] underline" onClick={() => cm.dismissFailed(f.client_id)}>
            Dismiss
          </button>
        </p>
      ))}
      {cm.legacy.length > 0 && (
        <section aria-label="Unsent from before an update" className="space-y-2 border border-amber p-2 text-sm">
          <h4 className="label text-[11px] text-amber">Unsent from before an update</h4>
          <ul className="space-y-2">
            {cm.legacy.map((e) => (
              <li key={e.client_id} className="space-y-1 border-t border-seam pt-2 first:border-t-0 first:pt-0">
                <span className="text-dim">
                  {e.kind === "reply" ? "Reply" : "Comment"} written {new Date(e.created_at).toLocaleString()}
                </span>
                <p className="whitespace-pre-wrap break-words">{String(e.payload.body ?? "")}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void cm.sendLegacyAsMe(e.client_id)} className="label border border-field px-2 py-0.5 text-[10px] text-phosphor transition-colors hover:bg-field/20">
                    Send as me
                  </button>
                  <button type="button" onClick={() => cm.discardLegacy(e.client_id)} className="label border border-seam px-2 py-0.5 text-[10px] text-dim transition-colors hover:border-rec hover:text-rec">
                    Discard
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ul ref={list} onWheel={touch} onTouchMove={touch} onPointerDown={touch} className="max-h-[60vh] space-y-2 overflow-auto">
        {cm.unsent
          .filter((e) => e.kind === "comment")
          .map((e) => (
            <li key={e.client_id} className="border border-amber p-2 text-sm opacity-80">
              <span className="label text-amber">Not sent yet</span> <span className="text-dim">written {new Date(e.created_at).toLocaleTimeString()}</span>
              <p className="whitespace-pre-wrap break-words">{String(e.payload.body)}</p>
            </li>
          ))}
        {shown.map((c) => (
          <CommentItem
            key={c.id}
            c={c}
            cm={cm}
            username={username}
            active={c.id === activeId}
            projectId={projectId}
            tapeId={tapeId}
            pendingReplies={cm.unsent.filter((e) => e.kind === "reply" && e.commentId === c.id)}
            onSeek={onSeek}
          />
        ))}
        {shown.length === 0 && cm.unsent.length === 0 && <li className="text-dim">Nothing here.</li>}
      </ul>
    </aside>
  );
}
