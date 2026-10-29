"use client";

import { useState } from "react";
import { formatTime } from "@/lib/timecode";
import { routeHash } from "@/lib/useHashRoute";
import type { Comment, CommentsApi } from "@/lib/useComments";
import type { Entry } from "@/lib/unsentQueue";

const btn = "label border border-seam px-2 py-0.5 text-[10px] text-phosphor hover:border-field";
const KIND: Record<string, string> = { fix: "Fix", keep: "Keep", question: "Question" };
const TONE: Record<string, string> = { fix: "text-rec", keep: "text-signal", question: "text-amber" };

// a carried comment's time belongs to its origin version: its link says so, the chip does not
export const spanOf = (c: Comment) => (c.carried ? "" : c.start_s === null ? "General" : c.end_s !== null ? `${formatTime(c.start_s)}–${formatTime(c.end_s)}` : formatTime(c.start_s));

export function CommentItem({
  c,
  cm,
  username,
  active,
  projectId,
  tapeId,
  pendingReplies,
  onSeek,
}: {
  c: Comment;
  cm: CommentsApi;
  username: string;
  active: boolean;
  projectId: number;
  tapeId: number;
  pendingReplies: Entry[];
  onSeek?(s: number): void;
}) {
  const [reply, setReply] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const timed = c.start_s !== null && !c.carried;
  const canResolve = cm.role === "admin";
  const head = (
    <>
      <span className={`label ${TONE[c.kind] ?? ""}`}>{KIND[c.kind] ?? c.kind}</span> <span className="font-mono">{spanOf(c)}</span>
    </>
  );

  return (
    <li data-comment={c.id} aria-current={active ? "true" : undefined} className={`space-y-1 border p-2 text-sm ${active ? "border-field bg-field/10" : "border-seam"}`}>
      <div className="flex flex-wrap items-center gap-2">
        {canResolve ? (
          <input type="checkbox" aria-label={`Resolve comment by ${c.author}`} checked={c.resolved} onChange={(e) => void cm.setResolved(c.id, e.target.checked)} />
        ) : (
          <span className="label text-[10px] text-dim">{c.resolved ? "Resolved" : "Open"}</span>
        )}
        {timed ? (
          <button type="button" data-player-keys aria-label={`Go to ${formatTime(c.start_s as number)}`} className="text-left disabled:cursor-default" disabled={!onSeek} onClick={() => onSeek?.(c.start_s as number)}>
            {head}
          </button>
        ) : (
          head
        )}
        <span className="text-dim">{c.author}</span>
        {cm.isNew(c) && <span className="label text-amber">New</span>}
        {c.updated_at > c.created_at && <span className="label text-dim">Edited</span>}
      </div>
      {c.carried && (
        <a
          className="text-[11px] text-field underline"
          href={routeHash({ view: "iteration", projectId, tapeId, iterationId: c.origin_iteration_id, ...(c.start_s !== null && { seekS: Number(c.start_s.toFixed(1)) }) })}
        >
          {c.start_s === null ? `from v${c.origin_version}, general` : `from v${c.origin_version} at ${formatTime(c.start_s)}`}
        </a>
      )}
      {editing === null ? (
        <p className="whitespace-pre-wrap break-words">{c.body}</p>
      ) : (
        <div className="space-y-1">
          <textarea aria-label="Edit comment" className="h-16 w-full border border-seam bg-ink p-1" value={editing} onChange={(e) => setEditing(e.target.value)} />
          <button
            type="button"
            className={btn}
            onClick={async () => {
              if (await cm.edit(c.id, { body: editing })) setEditing(null);
            }}
          >
            Save
          </button>{" "}
          <button type="button" className={btn} onClick={() => setEditing(null)}>
            Cancel
          </button>
        </div>
      )}
      {c.author === username && editing === null && (
        <button type="button" className={btn} onClick={() => setEditing(c.body)}>
          Edit
        </button>
      )}
      {(c.replies.length > 0 || pendingReplies.length > 0) && (
        <ul className="space-y-1 border-l border-seam pl-2">
          {c.replies.map((r) => (
            <li key={r.id}>
              <span className="text-dim">{r.author}</span> {cm.isNew(r) && <span className="label text-amber">New</span>}
              <p className="whitespace-pre-wrap break-words">{r.body}</p>
            </li>
          ))}
          {pendingReplies.map((e) => (
            <li key={e.client_id} className="opacity-70">
              <span className="label text-amber">Not sent yet</span> <span className="text-dim">{new Date(e.created_at).toLocaleTimeString()}</span>
              <p className="whitespace-pre-wrap break-words">{String(e.payload.body)}</p>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-1"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!reply.trim()) return;
          void cm.reply(c.id, reply.trim());
          setReply("");
        }}
      >
        <input aria-label={`Reply to ${c.author}`} placeholder="Reply" className="min-w-0 flex-1 border border-seam bg-ink px-1" value={reply} onChange={(e) => setReply(e.target.value)} />
        <button type="submit" className={btn}>
          Reply
        </button>
      </form>
    </li>
  );
}
