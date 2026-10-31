"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { routeHash } from "@/lib/useHashRoute";
import { useTape, type Iteration } from "@/lib/useTape";
import { useMediaFile, type MediaFile } from "@/lib/useMediaFile";
import { dirName, holdLocks, projectLock, versionLock } from "@/lib/opfsMedia";
import { mediaUrl, useMediaWorker } from "@/lib/useMediaWorker";
import { usePlayerKeys } from "@/lib/usePlayerKeys";
import { syncVideos } from "@/lib/compareSync";
import { formatTime } from "@/lib/timecode";
import { downloadedRanges, fpsOf, mimeOf } from "@/lib/playerLogic";
import { DownloadRing } from "./DownloadRing";
import { PlaybackBar, playbackProblem } from "./PlaybackBar";
import { ScrubBar } from "./ScrubBar";

const btn = "label border border-seam px-2 py-1 text-[11px] text-phosphor hover:border-field disabled:opacity-40";

/** Two versions of a tape side by side, `leftId` on the left; the route's `vs` is the right. */
export function CompareView({ projectId, tapeId, leftId, rightId }: { projectId: number; tapeId: number; leftId: number; rightId: number }) {
  const { iterations, tape, error } = useTape(tapeId);
  const playable = (id: number) => iterations.find((i) => i.id === id && i.status === "ready" && !!i.drive_file_id) ?? null;
  const left = playable(leftId);
  const right = playable(rightId);
  if (error) return <p className="text-rec">{error}</p>;
  if (!tape) return <p className="osd text-xl text-dim">Loading…</p>;
  if (!left || !right)
    return (
      <p className="text-amber">
        Both versions must be uploaded to compare them.{" "}
        <a className="underline" href={routeHash({ view: "iteration", projectId, tapeId, iterationId: leftId })}>
          Back to the version
        </a>
      </p>
    );
  return <Pair key={`${left.id}-${right.id}`} projectId={projectId} tapeId={tapeId} left={left} right={right} />;
}

const media = (it: Iteration) => ({ id: it.id, drive_file_id: it.drive_file_id as string, size: it.size });

function Pair({ projectId, tapeId, left, right }: { projectId: number; tapeId: number; left: Iteration; right: Iteration }) {
  const lm = useMediaFile(media(left), projectId, right.id);
  const rm = useMediaFile(media(right), projectId, left.id);
  const lf = left.drive_file_id as string;
  const rf = right.drive_file_id as string;
  // Another tab must not delete what this one plays (see holdLocks).
  useEffect(
    () => holdLocks([projectLock(projectId), versionLock(dirName(projectId, left.id, lf)), versionLock(dirName(projectId, right.id, rf))]),
    [projectId, left.id, right.id, lf, rf],
  );
  const worker = useMediaWorker();
  const [started, setStarted] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const lv = useRef<HTMLVideoElement>(null);
  const rv = useRef<HTMLVideoElement>(null);
  const area = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [soundRight, setSoundRight] = useState(false);
  const [cannot, setCannot] = useState({ left: false, right: false });

  const start = async () => {
    setStartError(null);
    try {
      for (const [it, m] of [
        [left, lm],
        [right, rm],
      ] as [Iteration, MediaFile][]) {
        await worker.provide(it.id, { projectId, fileId: it.drive_file_id ?? "", size: it.size, mime: mimeOf(it.filename), downloaded: m.state === "complete", getLink: m.getLink });
      }
      setStarted(true);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "Playback could not start");
    }
  };

  useEffect(() => (started && lv.current && rv.current ? syncVideos(lv.current, rv.current) : undefined), [started]);

  const toggle = useCallback(() => {
    const v = lv.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }, []);
  const seekTo = (s: number) => {
    if (lv.current) lv.current.currentTime = Math.min(Math.max(s, 0), duration || s);
  };
  const fps = fpsOf(left.checks);
  usePlayerKeys(
    {
      toggle,
      seekBy: (d) => seekTo((lv.current?.currentTime ?? 0) + d),
      step: (dir) => {
        lv.current?.pause();
        seekTo((lv.current?.currentTime ?? 0) + dir / fps);
      },
    },
    { enabled: started, container: area },
  );

  const pane = (it: Iteration, m: MediaFile, side: "left" | "right") => (
    <figure className="min-w-0 space-y-1">
      <figcaption className="flex items-center gap-2">
        <span className="osd text-xl">v{it.version}</span>
        <DownloadRing doneBytes={m.doneBytes} total={m.total} />
        {(side === "left") !== soundRight && <span className="label text-[10px] text-signal">Sound</span>}
      </figcaption>
      <div className="relative bg-ink">
        <PlaybackBar problem={playbackProblem(it.checks, cannot[side])} overlay={started} />
        {started ? (
          <video
            ref={side === "left" ? lv : rv}
            src={mediaUrl(it.id)}
            aria-label={`v${it.version}`}
            muted={(side === "left") === soundRight}
            className="aspect-video w-full bg-black"
            onClick={toggle}
            onLoadedMetadata={(e) => {
              if (!e.currentTarget.videoWidth) setCannot((c) => ({ ...c, [side]: true }));
              if (side === "left") setDuration(e.currentTarget.duration);
            }}
            onError={(e) => e.currentTarget.error?.code === 4 && setCannot((c) => ({ ...c, [side]: true }))}
            {...(side === "left" && {
              onTimeUpdate: (e: React.SyntheticEvent<HTMLVideoElement>) => setCurrent(e.currentTarget.currentTime),
              onPlay: () => setPaused(false),
              onPause: () => setPaused(true),
            })}
          />
        ) : (
          <div className="noise aspect-video w-full opacity-30" aria-hidden />
        )}
      </div>
      {m.error && <p className="text-xs text-rec">{m.error}</p>}
    </figure>
  );

  const swap = routeHash({ view: "iteration", projectId, tapeId, iterationId: right.id, vsId: left.id });
  return (
    <section ref={area} className="space-y-3" aria-label="Side by side">
      <header className="flex flex-wrap items-center gap-3">
        <h2 tabIndex={-1} className="stencil text-4xl">
          v{left.version} ↔ v{right.version}
        </h2>
        <a className={btn} href={swap}>
          Swap sides
        </a>
        <a className={btn} href={routeHash({ view: "iteration", projectId, tapeId, iterationId: left.id })}>
          Back to v{left.version}
        </a>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        {pane(left, lm, "left")}
        {pane(right, rm, "right")}
      </div>
      {!started ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btn} onClick={start} disabled={!worker.ready}>
            Play side by side
          </button>
          <span className="text-xs text-dim">Plays from what has downloaded, the rest from Drive.</span>
          {(startError ?? worker.error) && <p className="text-rec">{startError ?? worker.error}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <ScrubBar duration={duration} current={current} downloaded={downloadedRanges(lm.present, left.size)} size={left.size} markers={[]} onSeek={seekTo} onRangeSelect={() => {}} />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button type="button" className={btn} onClick={toggle}>
              {paused ? "Play" : "Pause"}
            </button>
            <span className="font-mono">
              {formatTime(current)} / {formatTime(duration)}
            </span>
            <button type="button" className={btn} aria-pressed={soundRight} onClick={() => setSoundRight((s) => !s)}>
              Sound: {soundRight ? `right (v${right.version})` : `left (v${left.version})`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
