"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { editorApi } from "@/lib/editorApi";
import { routeHash } from "@/lib/useHashRoute";
import type { Iteration } from "@/lib/useTape";
import { useMediaFile } from "@/lib/useMediaFile";
import { mediaUrl, useMediaWorker } from "@/lib/useMediaWorker";
import { useComments } from "@/lib/useComments";
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
const btn = "label border border-seam px-2 py-1 text-[11px] text-phosphor hover:border-field disabled:opacity-40";
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

  useEffect(() => {
    let live = true;
    editorApi<Loaded>(`/iterations/${iterationId}`)
      .then((d) => live && setData(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [iterationId]);

  if (error) return <p className="text-rec">{error}</p>;
  if (!data) return <p className="osd text-xl text-dim">Loading…</p>;
  return <Watch key={`${iterationId}-${attempt}`} {...props} data={data} retry={() => setAttempt(attempt + 1)} />;
}

function Watch({ projectId, tapeId, iterationId, seekS, role, username, now = Date.now, data, retry }: ReviewPlayerProps & { data: Loaded; retry(): void }) {
  const it = data.iteration;
  const media = useMediaFile(it.drive_file_id ? { id: it.id, drive_file_id: it.drive_file_id, size: it.size } : null, projectId, null);
  const worker = useMediaWorker();
  const [started, setStarted] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [lateWorker, setLateWorker] = useState(false);
  const [paused, setPaused] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(2);
  const [sheet, setSheet] = useState(false);
  // start null: a general comment; n makes a new prefill remount the form
  const [composer, setComposer] = useState<{ start: number | null; end: number | null; n: number } | null>(null);
  const cm = useComments(iterationId, { role, username });
  const [videoError, setVideoError] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const fps = fpsOf(it.checks);
  const storageOnly = media.error?.startsWith("Not enough browser storage") ?? false;

  useEffect(() => {
    if (worker.ready || worker.error) return;
    const t = setTimeout(() => setLateWorker(true), REPLY_WAIT_MS);
    return () => clearTimeout(t);
  }, [worker.ready, worker.error]);

  // Position: saved at most every 10 s, whatever triggers it.
  const lastSave = useRef(-Infinity);
  const lastTime = useRef(0);
  const clock = useRef(now);
  const save = useCallback(() => {
    const t = clock.current();
    if (!started || t - lastSave.current < SAVE_EVERY_MS) return;
    lastSave.current = t;
    // on unmount React has already detached the element, so fall back to the last tick
    editorApi(`/iterations/${iterationId}/position`, { method: "PUT", body: { position_s: video.current?.currentTime ?? lastTime.current } }).catch(() => {});
  }, [iterationId, started]);
  useEffect(() => save, [save]); // on unmount

  const applied = useRef<string | null>(null);
  useEffect(() => {
    const v = video.current;
    const key = String(seekS);
    if (!v || !(duration > 0) || applied.current === key) return;
    applied.current = key;
    v.currentTime = startPosition(seekS, data.position_s, duration);
  }, [duration, seekS, data.position_s, started]);

  async function startWatching() {
    setStartError(null);
    try {
      await worker.provide(it.id, { projectId, fileId: it.drive_file_id ?? "", size: it.size, mime: mimeOf(it.filename), getLink: media.getLink });
      setStarted(true);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "Playback could not start");
    }
  }

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
      video.current?.pause();
      setComposer((c) => ({ start: video.current?.currentTime ?? 0, end: null, n: (c?.n ?? 0) + 1 }));
    },
    general: () => started && setComposer((c) => ({ start: null, end: null, n: (c?.n ?? 0) + 1 })),
    help: () => setSheet((s) => !s),
    escape: () => {
      if (composer) setComposer(null);
      else if (sheet) setSheet(false);
      else return false;
      return true;
    },
  }, { container: box });

  const markers: Marker[] = useMemo(
    () =>
      cm.comments
        .filter((c) => c.start_s !== null && !c.carried)
        .map((c) => ({ id: c.id, start: c.start_s as number, end: c.end_s ?? undefined, kind: c.kind, active: !c.resolved })),
    [cm.comments],
  );
  const ranges = useMemo(() => downloadedRanges(media.present, it.size), [media.present, it.size]);
  const ring = <DownloadRing doneBytes={media.doneBytes} total={media.total} />;
  const pct = media.total > 0 ? Math.round((media.doneBytes / media.total) * 100) : 0;
  const canWatchNow = media.state !== "complete" && (media.state !== "error" || storageOnly);
  const err = (media.error && !storageOnly ? media.error : null) ?? worker.error ?? startError ?? videoError;
  const uploaded = !!it.drive_file_id;

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center gap-3">
        <h2 tabIndex={-1} className="stencil text-4xl">
          Version {it.version}
        </h2>
        <CheckBadges checks={it.checks} />
        {it.drive_file_id && (
          <>
            <DownloadLink fileId={it.drive_file_id} className={btn}>
              Download
            </DownloadLink>
            <OpenInDrive fileId={it.drive_file_id} />
          </>
        )}
      </header>

      {!started && (
        <div className="space-y-3 border border-seam bg-bezel p-4">
          <div className="flex items-center gap-3">
            {ring}
            <p>
              {media.state === "complete"
                ? "Downloaded"
                : `Loading v${it.version} · ${gb(media.doneBytes)} of ${gb(media.total)} GB · ${pct}%`}
            </p>
          </div>
          {!uploaded && <p className="text-amber">This version isn&apos;t uploaded yet</p>}
          {storageOnly && <p className="text-amber">Streaming only: not enough browser storage to save it</p>}
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
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div ref={box} className="relative space-y-2 bg-ink">
            <video
              ref={video}
              src={mediaUrl(iterationId)}
              className="aspect-video w-full bg-black"
              onClick={toggle}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
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
            {err && <p className="text-rec">{err}</p>}
            {storageOnly && <p className="text-amber">Streaming only: not enough browser storage to save it</p>}
            <ScrubBar duration={duration} current={current} downloaded={ranges} size={it.size} markers={markers} onSeek={seekTo} rangeMode={!!composer} onRangeSelect={(start, end) => setComposer((c) => ({ start, end, n: (c?.n ?? 0) + 1 }))} />
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
          <div className="space-y-3">
            {composer && (
              <CommentComposer
                key={composer.n}
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
            <CommentPanel cm={cm} username={username} projectId={projectId} tapeId={tapeId} currentTime={current} onSeek={seekTo} now={now} />
          </div>
        </div>
      )}
      {!started && sheet && <KeySheet onClose={() => setSheet(false)} />}
    </section>
  );
}
