"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { editorApi } from "@/lib/editorApi";
import { routeHash } from "@/lib/useHashRoute";
import type { Iteration } from "@/lib/useTape";
import { useMediaFile } from "@/lib/useMediaFile";
import { dirName, holdLocks, projectLock, versionLock } from "@/lib/opfsMedia";
import { mediaUrl, useMediaWorker } from "@/lib/useMediaWorker";
import { useTape } from "@/lib/useTape";
import { useComments, type SeenFn } from "@/lib/useComments";
import { usePlayerKeys } from "@/lib/usePlayerKeys";
import { formatTime } from "@/lib/timecode";
import { SPEEDS, downloadedRanges, fpsOf, mimeOf, startPosition } from "@/lib/playerLogic";
import { CheckBadges } from "./IterationCard";
import { DownloadLink, OpenInDrive } from "./DriveLinks";
import { DownloadRing } from "./DownloadRing";
import { ScrubBar, type Marker } from "./ScrubBar";
import { KeySheet } from "./KeySheet";
import { CommentPanel } from "./CommentPanel";
import { CommentComposer } from "./CommentComposer";

const SAVE_EVERY_MS = 10_000;
const REPLY_WAIT_MS = 4_000;
const OPEN_COMPOSER = "editor.openComposer";
const RESUME_PLAYING = "editor.resumePlaying";
const RESUME_WITHIN_MS = 30_000;
const FLAGS = [OPEN_COMPOSER, RESUME_PLAYING];

/**
 * The one-shot flags hold the version they are for ("<iterationId>", the
 * resume one "<iterationId>:<ms>"). Removes those whose target `drop` picks.
 */
function dropFlags(drop: (target: number) => boolean) {
  try {
    for (const k of FLAGS) {
      const v = sessionStorage.getItem(k);
      if (v !== null && drop(Number(v.split(":")[0]))) sessionStorage.removeItem(k);
    }
  } catch {
    /* no storage: no flags */
  }
}
const readFlag = (k: string) => {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
const btn = "menu-pop label border-2 border-phosphor bg-ink px-2 py-1 text-[11px] text-phosphor hover:bg-phosphor hover:text-ink disabled:opacity-40";
const gb = (n: number) => (n / 1024 ** 3).toFixed(1);

type Loaded = { iteration: Iteration; position_s: number | null };

export type ReviewPlayerProps = {
  projectId: number;
  tapeId: number;
  iterationId: number;
  seekS?: number;
  role: "admin" | "editor";
  username: string;
  now?: () => number;
};

export function ReviewPlayer(props: ReviewPlayerProps) {
  const { iterationId } = props;
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const { iterations, tape, error: tapeError } = useTape(props.tapeId);
  // The tape list decides the compare partner, which useMediaFile must know
  // before its first run (it protects the partner's cached copy); so wait for it.
  const tapeReady = tape !== null || tapeError !== null;
  const cur = data?.iteration;
  const partner = useMemo(() => {
    if (!cur) return null;
    const ready = iterations.filter((i) => i.status === "ready" && i.id !== cur.id).sort((a, b) => a.version - b.version);
    const newer = ready.find((i) => i.version > cur.version);
    const lower = ready.filter((i) => i.version < cur.version).pop();
    const isLatest = !ready.some((i) => i.version > cur.version);
    return (isLatest ? lower : newer) ?? lower ?? null;
  }, [iterations, cur]);

  useEffect(() => {
    let live = true;
    editorApi<Loaded>(`/iterations/${iterationId}`)
      .then((d) => live && setData(d))
      .catch((e: Error) => {
        if (!live) return;
        dropFlags(() => true); // the version never opened: its flags must not fire on a later visit
        setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [iterationId, loadAttempt]);

  // A flag for another version is stale; leaving the player drops this version's unused ones.
  // The drop on leaving waits a microtask, so StrictMode's unmount-remount keeps them.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    dropFlags((t) => t !== iterationId);
    return () => {
      mounted.current = false;
      queueMicrotask(() => !mounted.current && dropFlags((t) => t === iterationId));
    };
  }, [iterationId]);

  // /seen is posted once per version view, so a remount (Try again) keeps the first previous_seen_at.
  const seenView = useRef<{ id: number; p: ReturnType<SeenFn> } | null>(null);
  const seen = useCallback<SeenFn>(() => {
    if (seenView.current?.id !== iterationId) {
      const p = editorApi<{ previous_seen_at: number | null }>(`/iterations/${iterationId}/seen`, { method: "POST" });
      p.catch(() => {});
      seenView.current = { id: iterationId, p };
    }
    return seenView.current.p;
  }, [iterationId]);

  if (error)
    return (
      <section className="space-y-3">
        <h2 tabIndex={-1} className="stencil tilt slam text-4xl">
          This version could not be opened
        </h2>
        <p className="text-rec">{error}</p>
        <button
          type="button"
          className={btn}
          onClick={() => {
            setError(null);
            setLoadAttempt((n) => n + 1);
          }}
        >
          Try again
        </button>
      </section>
    );
  // after a version switch the old version's data must not render under the new id
  if (!data || data.iteration.id !== iterationId) return <p className="osd text-xl text-dim">Loading…</p>;
  return <Watch key={`${iterationId}-${attempt}`} {...props} data={data} retry={() => setAttempt(attempt + 1)} partner={partner} tapeReady={tapeReady} seen={seen} />;
}

function Watch({ projectId, tapeId, iterationId, seekS, role, username, now = Date.now, data, retry, partner, tapeReady, seen }: ReviewPlayerProps & { data: Loaded; retry(): void; partner: Iteration | null; tapeReady: boolean; seen: SeenFn }) {
  const it = data.iteration;
  const media = useMediaFile(it.drive_file_id && tapeReady ? { id: it.id, drive_file_id: it.drive_file_id, size: it.size } : null, projectId, partner?.id ?? null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);
  // One-shot flags, read once at mount: the card menu's Add comment, and V pressed while playing.
  // Each counts only for the version it names (and resume only for 30 s).
  const wantComposer = useRef(false);
  const wantResume = useRef(false);
  const clockAtMount = useRef(now);
  useEffect(() => {
    wantComposer.current = readFlag(OPEN_COMPOSER) === String(iterationId);
    const [target, at] = (readFlag(RESUME_PLAYING) ?? "").split(":");
    wantResume.current = target === String(iterationId) && clockAtMount.current() - Number(at) < RESUME_WITHIN_MS;
    dropFlags((t) => t === iterationId);
  }, [iterationId]);
  // Another tab must not delete what this one plays or downloads (see holdLocks).
  const fileId = it.drive_file_id;
  useEffect(() => holdLocks([projectLock(projectId), ...(fileId ? [versionLock(dirName(projectId, iterationId, fileId))] : [])]), [projectId, iterationId, fileId]);
  const worker = useMediaWorker();
  const [started, setStarted] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [lateWorker, setLateWorker] = useState(false);
  const [paused, setPaused] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(2);
  const [sheet, setSheet] = useState(false);
  // start null: a general comment; a new start/end updates an open form without clearing its text
  const [composer, setComposer] = useState<{ start: number | null; end: number | null } | null>(null);
  const cm = useComments(iterationId, { role, username }, { seen });
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoKey, setVideoKey] = useState(0);
  const reloadAt = useRef<number | null>(null);
  const wantPlay = useRef(false);
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLElement>(null);
  const fps = fpsOf(it.checks);
  const storageOnly = media.error?.startsWith("Not enough browser storage") ?? false;

  useEffect(() => {
    if (worker.ready || worker.error) return;
    const t = setTimeout(() => setLateWorker(true), REPLY_WAIT_MS);
    return () => clearTimeout(t);
  }, [worker.ready, worker.error]);

  // Position: saved at most every 10 s, whatever triggers it.
  const lastSave = useRef(-Infinity);
  const applied = useRef<string | null>(null);
  const lastTime = useRef(0);
  const clock = useRef(now);
  const save = useCallback(() => {
    const t = clock.current();
    // before the resume point is applied the element sits at 0, which must not overwrite it
    if (!started || applied.current === null || t - lastSave.current < SAVE_EVERY_MS) return;
    lastSave.current = t;
    // on unmount React has already detached the element, so fall back to the last tick
    editorApi(`/iterations/${iterationId}/position`, { method: "PUT", body: { position_s: video.current?.currentTime ?? lastTime.current } }).catch(() => {});
  }, [iterationId, started]);
  useEffect(() => save, [save]); // on unmount

  useEffect(() => {
    const v = video.current;
    const key = String(seekS);
    if (!v || !(duration > 0) || applied.current === key) return;
    applied.current = key;
    v.currentTime = startPosition(seekS, data.position_s, duration);
    // the person already pressed Play (or was playing before V); the composer flag means pause
    if (wantPlay.current && !wantComposer.current) void v.play()?.catch(() => {});
    wantPlay.current = false;
  }, [duration, seekS, data.position_s, started]);

  useEffect(() => {
    if (!wantComposer.current || !started || !(duration > 0)) return;
    wantComposer.current = false;
    video.current?.pause();
    setComposer({ start: video.current?.currentTime ?? 0, end: null });
  }, [started, duration]);

  const startWatching = useCallback(async () => {
    setStartError(null);
    try {
      const downloaded = media.state === "complete";
      await worker.provide(it.id, { projectId, fileId: it.drive_file_id ?? "", size: it.size, mime: mimeOf(it.filename), downloaded, getLink: media.getLink });
      wantPlay.current = true;
      setStarted(true);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "Playback could not start");
    }
  }, [worker, it, projectId, media.state, media.getLink]);

  const uploaded = !!it.drive_file_id;
  const canWatchNow = media.state !== "complete" && (media.state !== "error" || storageOnly);
  // V pressed while playing: carry on in this version, but only if it is fully downloaded; one still
  // loading opens paused with Start watching now, since streaming it is the person's call, not V's
  useEffect(() => {
    if (!wantResume.current || started || !worker.ready || !uploaded || media.state === "checking") return;
    wantResume.current = false;
    if (media.state === "complete") void Promise.resolve().then(startWatching); // off the effect's synchronous path
  }, [started, worker.ready, uploaded, media.state, startWatching]);

  const leaveFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.()?.catch(() => {});
  };
  const reloadVideo = () => {
    reloadAt.current = video.current?.currentTime ?? lastTime.current;
    wantPlay.current = false;
    setPaused(true); // the new element starts paused, and its play event is what says otherwise
    setVideoError(null);
    setStartError(null);
    setVideoKey((k) => k + 1);
  };

  const seekTo = (s: number) => {
    const v = video.current;
    if (v) v.currentTime = Math.min(Math.max(s, 0), duration || s);
  };
  const toggle = () => {
    const v = video.current;
    if (v) void (v.paused ? v.play() : v.pause());
  };
  const changeSpeed = (to: number) => {
    setSpeed(to);
    if (video.current) video.current.playbackRate = SPEEDS[to];
  };
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen?.());

  usePlayerKeys({
    toggle: () => started && toggle(),
    seekBy: (d) => started && seekTo((video.current?.currentTime ?? 0) + d),
    step: (dir) => {
      const v = video.current;
      if (!started || !v) return;
      v.pause();
      seekTo(v.currentTime + dir / fps);
    },
    speed: (dir) => started && changeSpeed(Math.min(Math.max(speed + dir, 0), SPEEDS.length - 1)),
    seekPercent: (n) => started && seekTo((n / 10) * duration),
    fullscreen: () => started && fullscreen(),
    comment: () => {
      if (!started) return;
      leaveFullscreen(); // the composer is outside the fullscreen box
      video.current?.pause();
      setComposer({ start: video.current?.currentTime ?? 0, end: null });
    },
    general: () => {
      if (!started) return;
      leaveFullscreen();
      setComposer({ start: null, end: null });
    },
    compare: () => {
      if (!tapeReady) return;
      if (!partner) return setToast("No earlier version to compare");
      const at = started ? video.current?.currentTime : undefined;
      if (started && video.current && !video.current.paused) {
        try {
          sessionStorage.setItem(RESUME_PLAYING, `${partner.id}:${now()}`);
        } catch {
          /* no storage: the other version opens paused */
        }
      }
      window.location.hash = routeHash({ view: "iteration", projectId, tapeId, iterationId: partner.id, ...(at !== undefined && { seekS: Math.round(at * 100) / 100 }) });
    },
    help: () => setSheet((s) => !s),
    escape: () => {
      if (composer) setComposer(null);
      else if (sheet) setSheet(false);
      else return false;
      return true;
    },
  }, { container: area });

  const markers: Marker[] = useMemo(
    () =>
      cm.comments
        .filter((c) => c.start_s !== null && !c.carried)
        .map((c) => ({ id: c.id, start: c.start_s as number, end: c.end_s ?? undefined, kind: c.kind, active: !c.resolved })),
    [cm.comments],
  );
  const ranges = useMemo(() => downloadedRanges(media.present, it.size), [media.present, it.size]);
  const ring = <DownloadRing doneBytes={media.doneBytes} total={media.total} />;
  // floor: 100% only once it is all there
  const pct = media.total > 0 ? Math.floor((media.doneBytes / media.total) * 100) : 0;
  const err = (media.error && !storageOnly ? media.error : null) ?? worker.error ?? startError ?? videoError;
  const storageNote = storageOnly && (
    <p className="text-amber">
      Streaming only: not enough browser storage to save it
      <span className="block text-[11px]">{media.error}</span>
    </p>
  );

  return (
    <section ref={area} className="space-y-3">
      <header className="flex flex-wrap items-center gap-3">
        <h2 tabIndex={-1} className="stencil tilt slam text-4xl">
          Version {it.version}
        </h2>
        <CheckBadges checks={it.checks} />
        {partner && (
          <span className="label text-[11px] text-dim">
            Comparing v{Math.min(it.version, partner.version)} ↔ v{Math.max(it.version, partner.version)} · V to switch
          </span>
        )}
        {it.drive_file_id && (
          <>
            <DownloadLink fileId={it.drive_file_id} className={btn}>
              Download
            </DownloadLink>
            <OpenInDrive fileId={it.drive_file_id} />
          </>
        )}
      </header>

      {toast && <p role="status" className="toast-in border-2 border-amber px-3 py-1.5 text-amber">{toast}</p>}

      {/* the comments show while the version loads too, so fix notes can be read before playback */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {!started && (
          <div className="slab relative space-y-3 self-start p-4">
            <div className="flex items-center gap-3">
              {ring}
              <p>
                {media.state === "complete"
                  ? "Downloaded"
                  : `Loading v${it.version} · ${gb(media.doneBytes)} of ${gb(media.total)} GB · ${pct}%`}
              </p>
            </div>
            {!uploaded && <p className="text-amber">This version isn&apos;t uploaded yet</p>}
            {media.retrying && <p className="text-amber">Waiting for the Mac Mini / Drive: {media.retrying}</p>}
            {storageNote}
            {err && <p className="text-rec">{err}</p>}
            <div className="flex flex-wrap items-center gap-2">
              {uploaded && media.state === "complete" && (
                <button type="button" className={btn} onClick={startWatching} disabled={!worker.ready}>
                  Play
                </button>
              )}
              {uploaded && canWatchNow && (
                <button type="button" className={btn} onClick={startWatching} disabled={!worker.ready}>
                  Start watching now
                </button>
              )}
              {!worker.ready && !worker.error && lateWorker && <span className="text-amber">Reload the page to enable playback</span>}
              {media.state === "error" && !storageOnly && (
                <button type="button" className={btn} onClick={retry}>
                  Try again
                </button>
              )}
              <button type="button" className={btn} onClick={() => (window.location.hash = routeHash({ view: "tape", projectId, tapeId }))}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {started && (
          <div ref={box} className="relative space-y-2 border-2 border-phosphor bg-ink p-2 shadow-[8px_8px_0_var(--field-deep)]">
            <video
              key={videoKey}
              ref={video}
              src={mediaUrl(iterationId)}
              className="aspect-video w-full bg-black"
              onClick={toggle}
              onLoadedMetadata={(e) => {
                setDuration(e.currentTarget.duration);
                e.currentTarget.playbackRate = SPEEDS[speed]; // a reloaded element starts at 1×
                if (reloadAt.current !== null) e.currentTarget.currentTime = reloadAt.current;
                reloadAt.current = null;
              }}
              onDurationChange={(e) => setDuration(e.currentTarget.duration)}
              onTimeUpdate={(e) => {
                lastTime.current = e.currentTarget.currentTime;
                setCurrent(e.currentTarget.currentTime);
                if (!e.currentTarget.paused) save();
              }}
              onError={() => setVideoError("The video could not be played")}
              onPlay={() => setPaused(false)}
              onPause={() => {
                setPaused(true);
                save();
              }}
            />
            {err && (
              <p className="text-rec">
                {err}{" "}
                <button type="button" className={btn} onClick={videoError && !(media.error && !storageOnly) && !worker.error ? reloadVideo : retry}>
                  Try again
                </button>
              </p>
            )}
            {storageNote}
            <ScrubBar
              duration={duration}
              current={current}
              downloaded={ranges}
              size={it.size}
              markers={markers}
              onSeek={seekTo}
              rangeMode={!!composer}
              onRangeSelect={(start, end) => {
                leaveFullscreen(); // the composer is outside the fullscreen box
                video.current?.pause();
                setComposer({ start, end });
              }}
            />
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <button type="button" className={btn} onClick={toggle}>
                {paused ? "Play" : "Pause"}
              </button>
              <span className="font-mono">
                {formatTime(current)} / {formatTime(duration)}
              </span>
              <button type="button" className={btn} aria-label="Speed" onClick={() => changeSpeed((speed + 1) % SPEEDS.length)}>
                {SPEEDS[speed]}×
              </button>
              {ring}
              <button type="button" className={btn} aria-label="Keyboard shortcuts" onClick={() => setSheet(true)}>
                ?
              </button>
              <button type="button" className={btn} onClick={fullscreen}>
                Fullscreen
              </button>
            </div>
            {sheet && <KeySheet onClose={() => setSheet(false)} />}
          </div>
        )}
        <div className="space-y-3">
          {composer && (
            <CommentComposer
              start={composer.start}
              end={composer.end}
              getNow={() => video.current?.currentTime ?? current}
              onSubmit={(draft) => {
                void cm.add(draft);
                setComposer(null);
              }}
              onCancel={() => setComposer(null)}
            />
          )}
          {/* no seeking until there is something to seek */}
          <CommentPanel cm={cm} username={username} projectId={projectId} tapeId={tapeId} currentTime={current} onSeek={started ? seekTo : undefined} now={now} />
        </div>
      </div>
      {!started && sheet && <KeySheet onClose={() => setSheet(false)} />}
    </section>
  );
}
