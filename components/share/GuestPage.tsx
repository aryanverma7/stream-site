"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isTyping } from "@/lib/isTyping";
import { formatTime } from "@/lib/timecode";
import { PlaybackBar, playbackProblem } from "@/components/editor/PlaybackBar";

type View = { title: string; file_id: string; api_key: string; expires_at: number; duration_s: number | null; codec: string | null; playable: boolean | null };
type Kind = "fix" | "keep" | "question";
/** A note this browser wrote; kept so the guest sees their own, and resent if it did not reach the backend. */
export type MyNote = { client_id: string; name: string; kind: Kind; body: string; start_s: number | null; sent: boolean; at: number };

const EXPIRED = "This link has expired. Ask DualBladeX for a new one.";
const btn = "label border border-seam px-2 py-1 text-[11px] text-phosphor hover:border-field disabled:opacity-40";
const field = "border border-seam bg-ink px-2 py-1 text-sm";
const KINDS: [Kind, string, string][] = [
  ["fix", "Fix", "text-rec"],
  ["keep", "Keep", "text-signal"],
  ["question", "Question", "text-amber"],
];

const store = {
  get<T>(k: string, fallback: T): T {
    try {
      const v = localStorage.getItem(k);
      return v === null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* this page only */
    }
  },
};
// Keyed by the file, never by the token: the token is the credential and stays out of storage.
const notesKey = (fileId: string) => `share.notes.${fileId}`;

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error ?? `Request failed (${r.status})`), { status: r.status });
  return data as T;
}

/** The token from the fragment (#<token>); the fragment never reaches a server or a Referer. */
export const tokenFromHash = (hash: string) => decodeURIComponent(hash.replace(/^#/, ""));

export function GuestPage() {
  const token = useRef("");
  const [view, setView] = useState<View | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [notes, setNotes] = useState<MyNote[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("fix");
  const [body, setBody] = useState("");
  const [timed, setTimed] = useState(true);
  const [at, setAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cannotDecode, setCannotDecode] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const text = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    token.current = tokenFromHash(window.location.hash);
    void Promise.resolve().then(async () => {
      setName(store.get("share.name", ""));
      if (!token.current) return setFatal(EXPIRED);
      try {
        const v = await post<View>("/api/share/view", { token: token.current });
        setView(v);
        setNotes(store.get<MyNote[]>(notesKey(v.file_id), []));
      } catch (e) {
        setFatal((e as { status?: number }).status === 404 ? EXPIRED : (e as Error).message);
      }
    });
  }, []);

  const save = useCallback(
    (next: MyNote[]) => {
      setNotes(next);
      if (view) store.set(notesKey(view.file_id), next);
    },
    [view],
  );

  const send = useCallback(
    async (list: MyNote[]) => {
      let next = list;
      for (const n of list.filter((x) => !x.sent)) {
        try {
          await post("/api/share/notes", { token: token.current, name: n.name, kind: n.kind, body: n.body, start_s: n.start_s, client_id: n.client_id });
          next = next.map((x) => (x.client_id === n.client_id ? { ...x, sent: true } : x));
        } catch (e) {
          const status = (e as { status?: number }).status;
          if (status === 404) {
            setFatal(EXPIRED);
            break;
          }
          if (status && status < 500 && status !== 429) {
            setError((e as Error).message);
            next = next.filter((x) => x.client_id !== n.client_id); // the server's final answer
            continue;
          }
          // offline, the Mac Mini down, or too many at once: keep it and try again later
          setError(status === 429 ? (e as Error).message : "Not sent yet; it will be sent when the connection is back");
          break;
        }
      }
      save(next);
    },
    [save],
  );

  useEffect(() => {
    if (!view) return;
    const retry = () => void send(store.get<MyNote[]>(notesKey(view.file_id), []));
    if (notes.some((n) => !n.sent)) retry();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per loaded view
  }, [view]);

  const capture = useCallback(() => {
    const v = video.current;
    if (v) {
      v.pause();
      setAt(v.currentTime);
    }
    setTimed(true);
    text.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || isTyping(e)) return;
      if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        capture();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [capture]);

  const submit = () => {
    if (!name.trim()) return setError("Type your name first");
    if (!body.trim()) return setError("Write something first");
    setError(null);
    store.set("share.name", name.trim());
    const note: MyNote = { client_id: crypto.randomUUID().replaceAll("-", ""), name: name.trim(), kind, body: body.trim(), start_s: timed ? Math.round(at * 10) / 10 : null, sent: false, at: Date.now() };
    setBody("");
    void send([...notes, note]);
  };

  if (fatal) return <main className="mx-auto max-w-xl p-6"><p role="alert" className="text-amber">{fatal}</p></main>;
  if (!view) return <main className="mx-auto max-w-xl p-6"><p className="osd text-xl text-dim">Loading…</p></main>;
  const src = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(view.file_id)}?alt=media&key=${encodeURIComponent(view.api_key)}`;
  const problem = playbackProblem({ codec: view.codec ?? undefined, playable: view.playable ?? undefined }, cannotDecode);

  return (
    <main className="mx-auto max-w-6xl space-y-3 p-4">
      <header className="flex flex-wrap items-baseline gap-3">
        <h1 className="stencil text-3xl">{view.title}</h1>
        <span className="text-xs text-dim">Link works until {new Date(view.expires_at * 1000).toLocaleString()}</span>
      </header>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="relative bg-ink">
          <PlaybackBar problem={problem} />
          <video
            ref={video}
            src={src}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full bg-black"
            onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => !e.currentTarget.videoWidth && setCannotDecode(true)}
            onError={(e) => (e.currentTarget.error?.code === 4 && view.codec ? setCannotDecode(true) : setVideoFailed(true))}
          />
          {videoFailed && <p className="p-2 text-sm text-rec">The video could not load. If many people watched it today, Google may be limiting it; try again later.</p>}
        </div>
        <form
          aria-label="Leave a note"
          className="space-y-2 border border-seam bg-bezel p-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="block space-y-1">
            <span className="block text-xs text-dim">Your name</span>
            <input className={`${field} w-full`} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Kind">
            {KINDS.map(([k, label, tone]) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className={`${btn} ${kind === k ? `border-field ${tone}` : ""}`} onClick={() => setKind(k)}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} /> At {formatTime(at)}
            </label>
            <button type="button" className={btn} onClick={capture}>
              Use current time (C)
            </button>
          </div>
          <textarea ref={text} aria-label="Note" maxLength={2000} className={`${field} h-24 w-full`} value={body} onChange={(e) => setBody(e.target.value)} />
          {error && <p role="alert" className="text-xs text-rec">{error}</p>}
          <button type="submit" className={btn}>
            Send note
          </button>
          <p className="text-[11px] text-dim">Your notes go to DualBladeX to review.</p>
          {notes.length > 0 && (
            <div className="space-y-1">
              <h2 className="label text-[11px] text-dim">Your notes</h2>
              <ul className="space-y-1">
                {notes.map((n) => (
                  <li key={n.client_id} className="border-l border-seam pl-2">
                    <span className="font-mono text-xs">{n.start_s === null ? "General" : formatTime(n.start_s)}</span> {n.body}
                    {!n.sent && <span className="label ml-1 text-amber">Not sent yet</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
