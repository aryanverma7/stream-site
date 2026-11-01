"use client";

import { useState } from "react";
import { markersOf, parseTc, toEdl, toXmeml } from "@/lib/markerExport";
import type { Comment } from "@/lib/useComments";

const KEY = "editor.markerExport";
const btn = "label border border-seam px-2 py-1 text-[11px] text-phosphor hover:border-field disabled:opacity-40";
const input = "border border-seam bg-ink px-2 py-1 font-mono text-sm";

function remembered(): { fps?: number; startTc?: string } {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

function save(fps: number, startTc: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ fps, startTc }));
  } catch {
    /* a per-browser convenience only */
  }
}

function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * "Export markers": the version's open, timed comments as a Resolve EDL or a
 * Premiere XML. Frame rate comes from the version's check (else the last one
 * used here); the timeline start is remembered per browser.
 */
export function ExportMarkers({ comments, fps, title }: { comments: Comment[]; fps: number | null; title: string }) {
  const [rate, setRate] = useState(() => String(fps ?? remembered().fps ?? 60));
  const [startTc, setStartTc] = useState(() => remembered().startTc ?? "01:00:00:00");
  const n = Number(rate);
  const rateOk = Number.isFinite(n) && n > 0 && n <= 240;
  const tcOk = rateOk && parseTc(startTc, n) !== null;
  const count = rateOk ? markersOf(comments, n).length : 0;
  const go = (kind: "edl" | "xml") => {
    save(n, startTc);
    const input = { comments, fps: n, startTc, title };
    if (kind === "edl") download(toEdl(input), `${title} markers.edl`, "text/plain");
    else download(toXmeml(input), `${title} markers.xml`, "application/xml");
  };
  return (
    <details className="border border-seam bg-bezel text-sm">
      <summary className="label cursor-pointer px-2 py-1 text-[11px] text-phosphor">Export markers</summary>
      <div className="space-y-2 p-3">
        <div className="flex flex-wrap gap-3">
          <label className="space-y-1">
            <span className="block text-xs text-dim">Frame rate</span>
            <input className={`${input} w-24`} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-dim">Timeline start</span>
            <input className={`${input} w-32`} value={startTc} onChange={(e) => setStartTc(e.target.value)} />
          </label>
        </div>
        {!tcOk && <p className="text-xs text-rec">Use a frame rate and a start like 01:00:00:00</p>}
        {tcOk && !count && <p className="text-xs text-dim">No open comments with a time</p>}
        {tcOk && count > 0 && <p className="text-xs text-dim">{count} open comment{count > 1 ? "s" : ""} with a time</p>}
        <div className="space-y-2">
          <div>
            <button type="button" className={btn} disabled={!tcOk || !count} onClick={() => go("edl")}>
              DaVinci Resolve (.edl)
            </button>
            <p className="text-[11px] text-dim">Timelines › Import › Timeline Markers from EDL</p>
          </div>
          <div>
            <button type="button" className={btn} disabled={!tcOk || !count} onClick={() => go("xml")}>
              Premiere Pro (.xml)
            </button>
            <p className="text-[11px] text-dim">File › Import: makes a new sequence carrying the markers</p>
          </div>
        </div>
      </div>
    </details>
  );
}
