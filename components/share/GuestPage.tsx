"use client";

import { Loading } from "@/components/Loading";
import { useCallback, useEffect, useRef, useState } from "react";
import { isTyping } from "@/lib/isTyping";
import { formatTime } from "@/lib/timecode";
import {
  PlaybackBar,
  isCodecError,
  playbackProblem,
} from "@/components/editor/PlaybackBar";
import { Ransom } from "@/components/Hero";

/** The page frame: the editor's red halftone header with the ransom mark, on black. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ink text-phosphor">
      <header className="wallpaper relative z-30 flex flex-wrap items-center gap-3 border-b-4 border-ink px-4 py-3 sm:px-6">
        <h1 className="text-3xl">
          <Ransom text="DualBladeX" />
        </h1>
        <span className="tag bg-ink text-sm text-phosphor">Shared video</span>
      </header>
      {children}
    </div>
  );
}

type View = {
  title: string;
  file_id: string;
  api_key: string;
  expires_at: number;
  duration_s: number | null;
  codec: string | null;
  playable: boolean | null;
};
type Kind = "fix" | "keep" | "question";
/** A note this browser wrote; kept so the guest sees their own, and resent if it did not reach the backend. */
export type MyNote = {
  client_id: string;
  name: string;
  kind: Kind;
  body: string;
  start_s: number | null;
  sent: boolean;
  at: number;
};

const EXPIRED = "This link has expired. Ask DualBladeX for a new one.";
const btn =
  "menu-pop label border-2 border-phosphor bg-ink px-2 py-1 text-[11px] text-phosphor hover:bg-phosphor hover:text-ink disabled:opacity-40";
const field =
  "border-2 border-seam bg-ink px-2 py-1 text-sm focus:border-phosphor focus:outline-none";
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
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok)
    throw Object.assign(
      new Error(data.error ?? `Request failed (${r.status})`),
      { status: r.status },
    );
  return data as T;
}

/** The token from the fragment (#<token>); the fragment never reaches a server or a Referer. */
export function tokenFromHash(hash: string): string {
  try {
    return decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    return ""; // a mangled link reads as expired, never a blank page
  }
}

export function GuestPage() {
  const token = useRef("");
  const [view, setView] = useState<View | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [notes, setNotes] = useState<MyNote[]>([]);
  // The ref is the truth (a second note sent while the first is still on its way must not overwrite it).
  const notesRef = useRef<MyNote[]>([]);
  const sending = useRef(false);
  const again = useRef(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("fix");
  const [body, setBody] = useState("");
  const [timed, setTimed] = useState(true);
  const [at, setAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cannotDecode, setCannotDecode] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [buffering, setBuffering] = useState(false);
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
        notesRef.current = store.get<MyNote[]>(notesKey(v.file_id), []);
        setNotes(notesRef.current);
      } catch (e) {
        setFatal(
          (e as { status?: number }).status === 404
            ? EXPIRED
            : (e as Error).message,
        );
      }
    });
  }, []);

  const save = useCallback(
    (next: MyNote[]) => {
      notesRef.current = next;
      setNotes(next);
      if (view) store.set(notesKey(view.file_id), next);
    },
    [view],
  );

  /** Sends every unsent note, one pass at a time; a call during a pass asks for another pass. */
  const send = useCallback(async () => {
    if (sending.current) {
      again.current = true;
      return;
    }
    sending.current = true;
    try {
      do {
        again.current = false;
        for (const n of notesRef.current.filter((x) => !x.sent)) {
          try {
            await post("/api/share/notes", {
              token: token.current,
              name: n.name,
              kind: n.kind,
              body: n.body,
              start_s: n.start_s,
              client_id: n.client_id,
            });
            save(
              notesRef.current.map((x) =>
                x.client_id === n.client_id ? { ...x, sent: true } : x,
              ),
            );
          } catch (e) {
            const status = (e as { status?: number }).status;
            if (status === 404) {
              setFatal(EXPIRED);
              return;
            }
            if (status && status < 500 && status !== 429) {
              setError((e as Error).message);
              save(notesRef.current.filter((x) => x.client_id !== n.client_id)); // the server's final answer
              continue;
            }
            // offline, the Mac Mini down, or too many at once: keep it and try again later
            setError(
              status === 429
                ? (e as Error).message
                : "Not sent yet; it will be sent when the connection is back",
            );
            return;
          }
        }
      } while (again.current);
    } finally {
      sending.current = false;
    }
  }, [save]);

  useEffect(() => {
    if (!view) return;
    const retry = () => void send();
    if (notesRef.current.some((n) => !n.sent)) retry();
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
    const note: MyNote = {
      client_id: crypto.randomUUID().replaceAll("-", ""),
      name: name.trim(),
      kind,
      body: body.trim(),
      start_s: timed ? Math.round(at * 10) / 10 : null,
      sent: false,
      at: Date.now(),
    };
    setBody("");
    save([...notesRef.current, note]); // kept before it is sent, so a closed tab or a second note loses nothing
    void send();
  };

  if (fatal)
    return (
      <Frame>
        <main className="mx-auto max-w-xl p-6">
          <p role="alert" className="slab slab-alert relative p-4 text-amber">
            {fatal}
          </p>
        </main>
      </Frame>
    );
  if (!view)
    return (
      <Frame>
        <main className="mx-auto max-w-xl p-6">
          <p className="text-xl"><Loading /></p>
        </main>
      </Frame>
    );
  const src = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(view.file_id)}?alt=media&key=${encodeURIComponent(view.api_key)}`;
  const problem = playbackProblem(
    { codec: view.codec ?? undefined, playable: view.playable ?? undefined },
    cannotDecode,
  );

  return (
    <Frame>
      <main className="mx-auto w-full max-w-6xl space-y-4 p-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="stencil text-4xl">{view.title}</h2>
          <span className="tag bg-phosphor text-xs text-ink">
            Link works until {new Date(view.expires_at * 1000).toLocaleString()}
          </span>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="relative self-start border-2 border-phosphor bg-ink p-2 shadow-[8px_8px_0_var(--field-deep)]">
            <PlaybackBar problem={problem} />
            <div className="relative">
            {buffering && <Loading overlay label="Buffering…" />}
            <video
              ref={video}
              src={src}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full bg-black"
              onWaiting={() => setBuffering(true)}
              onPlaying={() => setBuffering(false)}
              onCanPlay={() => setBuffering(false)}
              onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) =>
                !e.currentTarget.videoWidth && setCannotDecode(true)
              }
              onError={(e) =>
                isCodecError(view.codec, e.currentTarget.error?.code)
                  ? setCannotDecode(true)
                  : setVideoFailed(true)
              }
            />
            </div>
            {videoFailed && (
              <p className="p-2 text-sm text-rec">
                The video could not load. If many people watched it today,
                Google may be limiting it; try again later.
              </p>
            )}
          </div>
          <form
            aria-label="Leave a note"
            className="slab relative space-y-2 p-3 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label className="block space-y-1">
              <span className="block text-xs text-dim">Your name</span>
              <input
                className={`${field} w-full`}
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div
              className="flex flex-wrap gap-1"
              role="radiogroup"
              aria-label="Kind"
            >
              {KINDS.map(([k, label, tone]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  className={`${btn} ${kind === k ? "!bg-phosphor !text-ink" : tone}`}
                  onClick={() => setKind(k)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={timed}
                  onChange={(e) => setTimed(e.target.checked)}
                />{" "}
                At {formatTime(at)}
              </label>
              <button type="button" className={btn} onClick={capture}>
                Use current time (C)
              </button>
            </div>
            <textarea
              ref={text}
              aria-label="Note"
              maxLength={2000}
              className={`${field} h-24 w-full`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-xs text-rec">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="wallpaper menu-pop label border-2 border-ink px-3 py-1.5 text-xs text-ink"
            >
              Send note
            </button>
            <p className="text-[11px] text-dim">
              Your notes go to DualBladeX to review.
            </p>
            {notes.length > 0 && (
              <div className="space-y-1">
                <h3 className="strip-cut label inline-block bg-phosphor py-0.5 pl-2 pr-6 text-[11px] text-ink">
                  Your notes
                </h3>
                <ul className="space-y-1">
                  {notes.map((n) => (
                    <li key={n.client_id} className="bubble px-2 py-1">
                      <span className="font-mono text-xs">
                        {n.start_s === null ? "General" : formatTime(n.start_s)}
                      </span>{" "}
                      {n.body}
                      {!n.sent && (
                        <span className="label ml-1 text-amber">
                          Not sent yet
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </form>
        </div>
      </main>
    </Frame>
  );
}
