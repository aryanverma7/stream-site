"use client";

import { useRef, useState } from "react";
import { formatTime } from "@/lib/timecode";

export type Marker = { id: number; start: number; end?: number; kind: string; active: boolean };

const TONE: Record<string, string> = { fix: "bg-rec", keep: "bg-signal", question: "bg-amber" };
const KIND: Record<string, string> = { fix: "Fix", keep: "Keep", question: "Question" };

/**
 * The timeline. Click seeks, a plain drag scrubs, Shift+drag (or dragging
 * from the Range handle while the composer is open) selects a range.
 * `downloaded` is in bytes of a `size`-byte file, drawn approximately in time.
 */
export function ScrubBar({
  duration,
  current,
  downloaded,
  size,
  markers,
  rangeMode = false,
  onSeek,
  onRangeSelect,
}: {
  duration: number;
  current: number;
  downloaded: [number, number][];
  size: number;
  markers: Marker[];
  rangeMode?: boolean;
  onSeek(s: number): void;
  onRangeSelect(start: number, end: number): void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<[number, number] | null>(null);
  const pct = (s: number) => (duration > 0 ? Math.min(Math.max(s / duration, 0), 1) * 100 : 0);

  function drag(e: React.MouseEvent, range: boolean) {
    const r = bar.current?.getBoundingClientRect();
    if (!r || !(r.width > 0) || !(duration > 0)) return;
    const at = (x: number) => Math.min(Math.max((x - r.left) / r.width, 0), 1) * duration;
    const from = range && !e.shiftKey && rangeMode ? current : at(e.clientX);
    let to = from;
    if (!range) onSeek(from);
    else setSel([from, from]);
    const move = (m: MouseEvent) => {
      to = at(m.clientX);
      if (range) setSel([Math.min(from, to), Math.max(from, to)]);
      else onSeek(to);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      setSel(null);
      if (range && to !== from) onRangeSelect(Math.min(from, to), Math.max(from, to));
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  return (
    <div className="flex items-center gap-2">
      {/* the markers are siblings laid over the slider: a slider's children are not reachable controls */}
      <div className="relative h-4 flex-1">
        <div
          ref={bar}
          role="slider"
          tabIndex={0}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          aria-valuetext={formatTime(current)}
          onMouseDown={(e) => drag(e, e.shiftKey)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            onSeek(Math.min(Math.max(current + (e.key === "ArrowLeft" ? -5 : 5), 0), duration));
          }}
          className="absolute inset-0 cursor-pointer select-none bg-seam shadow-[0_0_0_2px_var(--phosphor),4px_4px_0_2px_var(--field-deep)]"
        >
          {size > 0 &&
            downloaded.map(([a, b]) => (
              <div
                key={a}
                data-downloaded
                title="Downloaded (approx.)"
                className="absolute inset-y-0 bg-dim/50"
                style={{ left: `${pct((a / size) * duration)}%`, width: `${pct((b / size) * duration) - pct((a / size) * duration)}%` }}
              />
            ))}
          <div className="absolute inset-y-0 left-0 bg-field" style={{ width: `${pct(current)}%` }} />
          {sel && <div data-selection className="absolute inset-y-0 bg-amber/50" style={{ left: `${pct(sel[0])}%`, width: `${pct(sel[1]) - pct(sel[0])}%` }} />}
        </div>
        {markers.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-label={`${KIND[m.kind] ?? "Comment"} at ${formatTime(m.start)}`}
            onClick={() => onSeek(m.start)}
            className={`absolute inset-y-0 min-w-1 ${TONE[m.kind] ?? "bg-amber"} ${m.active ? "opacity-100" : "opacity-40"}`}
            style={{ left: `${pct(m.start)}%`, width: m.end !== undefined ? `${pct(m.end) - pct(m.start)}%` : "4px" }}
          />
        ))}
      </div>
      {rangeMode && (
        <button type="button" onMouseDown={(e) => drag(e, true)} className="label border-2 border-amber px-2 py-0.5 text-[10px] text-amber">
          Range
        </button>
      )}
    </div>
  );
}
