"use client";

import { useState } from "react";
import { editorApi } from "@/lib/editorApi";
import type { Notice } from "@/lib/useHome";
import { useAsk } from "./AskDialog";

const MAX = 2000; // the backend's notices.MAX_CHARS
const btn = "menu-pop label border-2 border-phosphor bg-ink px-3 py-1.5 text-xs text-phosphor hover:bg-phosphor hover:text-ink disabled:opacity-40";
const field = "w-full border-2 border-seam bg-ink px-2 py-1 text-sm focus:border-phosphor focus:outline-none";
const at = (t: number) => new Date(t * 1000).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

/**
 * The streamer's notices, newest first, pinned above the rest of Home. The streamer posts, edits and deletes
 * and sees when the editor pressed Got it; the editor reads and presses Got it. Text is rendered as text
 * (React sets it as a text node), never as HTML or markdown.
 */
export function NoticeBoard({ notices, role, onChanged }: { notices: Notice[]; role: "admin" | "editor"; onChanged: () => void }) {
  const ask = useAsk();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = role === "admin";

  const run = async (call: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await call();
      onChanged();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin && notices.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="label text-sm text-dim">Notices</h3>
      {ask.dialog}
      {error && (
        <p role="alert" className="text-rec">
          {error}
        </p>
      )}
      {isAdmin && (
        <form
          className="slab slab-sm relative space-y-2 px-4 py-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => editorApi("/notices", { method: "POST", body: { text: draft } }))) setDraft("");
          }}
        >
          <textarea aria-label="New notice" placeholder="A notice for the editor" maxLength={MAX} rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} className={field} />
          <button type="submit" disabled={busy || !draft.trim()} className={btn}>
            Post notice
          </button>
        </form>
      )}
      <ul className="grid gap-2">
        {notices.map((n) => (
          <li key={n.id} className="slab slab-sm relative space-y-2 px-4 py-3">
            {editing?.id === n.id ? (
              <textarea aria-label="Notice text" maxLength={MAX} rows={3} value={editing.text} onChange={(e) => setEditing({ id: n.id, text: e.target.value })} className={field} />
            ) : (
              <p className="whitespace-pre-wrap break-words">{n.text}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-dim">
              <span>
                {at(n.created_at)}
                {n.updated_at > n.created_at && " (edited)"}
              </span>
              {isAdmin ? (
                <>
                  <span className={n.seen_at === null ? "" : "text-signal"}>{n.seen_at === null ? "Not seen yet" : `Seen ${at(n.seen_at)}`}</span>
                  <span className="ml-auto flex gap-2">
                    {editing?.id === n.id ? (
                      <>
                        <button
                          type="button"
                          disabled={busy || !editing.text.trim()}
                          className={btn}
                          onClick={async () => {
                            if (await run(() => editorApi(`/notices/${n.id}`, { method: "PATCH", body: { text: editing.text } }))) setEditing(null);
                          }}
                        >
                          Save
                        </button>
                        <button type="button" className={btn} onClick={() => setEditing(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" disabled={busy || editing !== null} className={btn} onClick={() => setEditing({ id: n.id, text: n.text })}>
                          Change
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className={`${btn} border-rec! text-rec! hover:bg-rec! hover:text-ink!`}
                          onClick={async () => {
                            if (await ask.confirm({ title: "Delete this notice?", message: "The editor stops seeing it.", confirmLabel: "Delete", danger: true }))
                              void run(() => editorApi(`/notices/${n.id}`, { method: "DELETE" }));
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </span>
                </>
              ) : n.seen_at === null ? (
                <button type="button" disabled={busy} className={`${btn} ml-auto`} onClick={() => void run(() => editorApi(`/notices/${n.id}/seen`, { method: "POST" }))}>
                  Got it
                </button>
              ) : (
                <span className="ml-auto">Seen</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
