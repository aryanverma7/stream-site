"use client";

import { useCallback, useEffect, useState } from "react";
import { editorApi } from "@/lib/editorApi";
import { formatTime } from "@/lib/timecode";
import { routeHash } from "@/lib/useHashRoute";
import { useAsk } from "./AskDialog";

const btn = "label border border-seam px-2 py-1 text-[11px] text-phosphor hover:border-field disabled:opacity-40";
export const SHARE_HOURS: [number, string][] = [
  [1, "1 hour"],
  [2, "2 hours"],
  [10, "10 hours"],
  [24, "24 hours"],
  [168, "7 days"],
];

export type LiveLink = { id: number; iteration_id: number; tape_id: number; project_id: number; tape: string; version: number; expires_at: number };

/** "1 h 12 m", "5 m", "2 d 3 h" until `at` (seconds). */
export function left(at: number, now = Date.now() / 1000): string {
  const m = Math.max(0, Math.round((at - now) / 60));
  if (m >= 1440) return `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`;
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} m` : `${m} m`;
}

/** Every live link (or this version's), with Revoke. Streamer only; the server refuses anyone else. */
export function LiveLinks({ iterationId, reloadKey = 0 }: { iterationId?: number; reloadKey?: number }) {
  const [links, setLinks] = useState<LiveLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ask = useAsk();
  const load = useCallback(
    () =>
      editorApi<{ links: LiveLink[] }>("/share-links")
        .then((d) => setLinks(d.links))
        .catch((e: Error) => setError(e.message)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load, reloadKey]);
  const shown = (links ?? []).filter((l) => iterationId === undefined || l.iteration_id === iterationId);
  const revoke = async (l: LiveLink) => {
    if (!(await ask.confirm({ title: `Revoke the link to ${l.tape} v${l.version}?`, message: "Anyone with it stops being able to open it.", confirmLabel: "Revoke", danger: true }))) return;
    try {
      await editorApi(`/share-links/${l.id}/revoke`, { method: "POST" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke");
    }
    void load();
  };
  return (
    <div className="space-y-1">
      <h4 className="label text-[11px] text-dim">Live links</h4>
      {error && <p className="text-xs text-rec">{error}</p>}
      {links && !shown.length && <p className="text-xs text-dim">None</p>}
      <ul className="space-y-1">
        {shown.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
            <a className="hover:underline" href={routeHash({ view: "iteration", projectId: l.project_id, tapeId: l.tape_id, iterationId: l.iteration_id })}>
              {l.tape} v{l.version}
            </a>
            <span className="text-xs text-dim">expires in {left(l.expires_at)}</span>
            <button type="button" className={btn} onClick={() => void revoke(l)}>
              Revoke
            </button>
          </li>
        ))}
      </ul>
      {ask.dialog}
    </div>
  );
}

/** "Share": a no-login link to this one version. The link is shown once, right after it is made. */
export function SharePanel({ iterationId, version }: { iterationId: number; version: number }) {
  const [hours, setHours] = useState(2);
  const [made, setMade] = useState<{ url: string; expires_at: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const create = async () => {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      setMade(await editorApi<{ url: string; expires_at: number }>(`/iterations/${iterationId}/share`, { method: "POST", body: { hours } }));
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not make a link");
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="border border-seam bg-bezel text-sm" onToggle={(e) => !e.currentTarget.open && setMade(null)}>
      <summary className="label cursor-pointer px-2 py-1 text-[11px] text-phosphor">Share</summary>
      <div className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-dim">
            Expires after{" "}
            <select className="border border-seam bg-ink px-2 py-1 text-sm text-phosphor" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {SHARE_HOURS.map(([h, label]) => (
                <option key={h} value={h}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={btn} disabled={busy} onClick={() => void create()}>
            Make link
          </button>
        </div>
        {error && <p role="alert" className="text-xs text-rec">{error}</p>}
        {made && (
          <div className="space-y-1">
            <input readOnly aria-label="Share link" className="w-full border border-seam bg-ink px-2 py-1 font-mono text-xs" value={made.url} onFocus={(e) => e.currentTarget.select()} />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={btn}
                onClick={() =>
                  navigator.clipboard
                    ?.writeText(made.url)
                    .then(() => setCopied(true))
                    .catch(() => {})
                }
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <span className="text-xs text-dim">
                Anyone with this link can watch v{version} until {new Date(made.expires_at * 1000).toLocaleString()}. It is shown only now.
              </span>
            </div>
          </div>
        )}
        <LiveLinks iterationId={iterationId} reloadKey={reloadKey} />
      </div>
    </details>
  );
}

type Note = { id: number; name: string; kind: "fix" | "keep" | "question"; start_s: number | null; end_s: number | null; body: string; created_at: number };
const KIND: Record<Note["kind"], [string, string]> = { fix: ["Fix", "text-rec"], keep: ["Keep", "text-signal"], question: ["Question", "text-amber"] };

/**
 * Guest notes waiting for the streamer, under each guest's name. Approved
 * ones become comments the editor sees; rejected ones disappear. Renders
 * nothing while none are waiting.
 */
export function GuestNotesPanel({ iterationId, onSeek, onApproved }: { iterationId: number; onSeek?(s: number): void; onApproved(): void }) {
  const [guests, setGuests] = useState<{ name: string; notes: Note[] }[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    () =>
      editorApi<{ guests: { name: string; notes: Note[] }[] }>(`/iterations/${iterationId}/guest-notes`)
        .then((d) => setGuests(d.guests))
        .catch(() => {}),
    [iterationId],
  );
  useEffect(() => {
    void load();
  }, [load]);
  if (!guests.length) return null;
  const toggle = (ids: number[], on: boolean) =>
    setPicked((p) => {
      const n = new Set(p);
      ids.forEach((i) => (on ? n.add(i) : n.delete(i)));
      return n;
    });
  const act = async (verb: "approve" | "reject") => {
    setError(null);
    try {
      await editorApi(`/guest-notes/${verb}`, { method: "POST", body: { ids: [...picked] } });
      setPicked(new Set());
      await load();
      if (verb === "approve") onApproved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  };
  const count = guests.reduce((n, g) => n + g.notes.length, 0);
  return (
    <section aria-label="Guest notes" className="space-y-2 border border-amber bg-bezel p-3 text-sm">
      <h3 className="osd text-xl">Guest notes ({count})</h3>
      <p className="text-xs text-dim">Only you see these. Approved ones go to the editor as comments.</p>
      {guests.map((g) => (
        <div key={g.name} className="space-y-1">
          <label className="flex items-center gap-2 font-bold">
            <input type="checkbox" aria-label={`Select all from ${g.name}`} checked={g.notes.every((n) => picked.has(n.id))} onChange={(e) => toggle(g.notes.map((n) => n.id), e.target.checked)} />
            {g.name}
          </label>
          <ul className="space-y-1 pl-6">
            {g.notes.map((n) => (
              <li key={n.id} className="flex items-start gap-2">
                <input type="checkbox" aria-label={`Select ${g.name}'s note: ${n.body.slice(0, 40)}`} checked={picked.has(n.id)} onChange={(e) => toggle([n.id], e.target.checked)} />
                <span className={`label ${KIND[n.kind][1]}`}>{KIND[n.kind][0]}</span>
                {n.start_s !== null ? (
                  <button type="button" className="font-mono hover:underline disabled:no-underline" disabled={!onSeek} onClick={() => onSeek?.(n.start_s as number)}>
                    {formatTime(n.start_s)}
                    {n.end_s !== null && `–${formatTime(n.end_s)}`}
                  </button>
                ) : (
                  <span className="font-mono">General</span>
                )}
                <span className="whitespace-pre-wrap break-words">{n.body}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {error && <p role="alert" className="text-xs text-rec">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className={btn} disabled={!picked.size} onClick={() => void act("approve")}>
          Approve selected
        </button>
        <button type="button" className={btn} disabled={!picked.size} onClick={() => void act("reject")}>
          Reject selected
        </button>
      </div>
    </section>
  );
}
