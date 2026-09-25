"use client";

import { useEffect, useState } from "react";
import { Dragon } from "./Dragon";
import { useLiveStatus } from "@/lib/useLiveStatus";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** The camera's burned-in clock. Null until mounted so the static export
    doesn't bake a build-time timestamp into the HTML. */
function useClock(): string | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!now) return null;
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(
    now.getMinutes(),
  )}:${pad(now.getSeconds())}`;
}

/** Viewfinder corner brackets. Four of them, drawn once, never interactive. */
function Brackets() {
  const corner = "absolute h-8 w-8 border-ink/80 md:h-12 md:w-12";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-3 z-10 md:inset-6">
      <span className={`${corner} left-0 top-0 border-l-2 border-t-2`} />
      <span className={`${corner} right-0 top-0 border-r-2 border-t-2`} />
      <span className={`${corner} bottom-0 left-0 border-b-2 border-l-2`} />
      <span className={`${corner} bottom-0 right-0 border-b-2 border-r-2`} />
    </div>
  );
}

/**
 * The dragon plays as CAM 01. Everything laid over it is pointer-events:
 * none except the one link, because the dragon is also the admin door -
 * charging it to a max sneeze navigates to /admin - and an overlay that
 * ate clicks would quietly lock the streamer out.
 */
export function Hero() {
  const clock = useClock();
  const live = useLiveStatus();

  return (
    <section className="crt relative h-screen w-full overflow-hidden">
      <Dragon />
      <Brackets />

      <div className="pointer-events-none absolute inset-x-6 top-6 z-20 flex items-start justify-between gap-4 text-ink md:inset-x-12 md:top-10">
        <p className="osd text-xl md:text-2xl">CAM 01 · LEVEL 0</p>
        {/* REC only while the stream is actually recording - offline, the
            camera says so instead of pretending. */}
        <p className="osd flex items-center gap-2 text-xl md:text-2xl">
          {live ? (
            <>
              <span className="rec-dot inline-block h-3 w-3 rounded-full bg-rec" aria-hidden />
              REC
            </>
          ) : live === false ? (
            <span className="bg-ink px-1.5 text-field">NO SIGNAL</span>
          ) : null}
          <span className="hidden tabular-nums text-ink/75 sm:inline">{clock ?? "\u00A0"}</span>
        </p>
      </div>

      <div className="pointer-events-none absolute inset-x-6 bottom-8 z-20 md:inset-x-12 md:bottom-14">
        <h1 className="stencil text-[clamp(3.75rem,13vw,6rem)] text-ink">DualBladeX</h1>

        <div className="pointer-events-auto mt-4 inline-flex max-w-full flex-wrap items-stretch shadow-[0_10px_24px_rgb(10_12_18_/_0.3)]">
          <p
            className={`osd flex items-center gap-2 px-3 py-2 text-xl ${
              live ? "bg-rec text-phosphor" : "bg-bezel-2 text-phosphor"
            }`}
          >
            {live === null ? (
              "Tuning…"
            ) : live ? (
              <>
                <span className="rec-dot inline-block h-2.5 w-2.5 rounded-full bg-phosphor" aria-hidden />
                Live now
              </>
            ) : (
              "No signal"
            )}
          </p>
          <a
            href="#feed"
            className="label flex items-center bg-ink px-4 py-2 text-sm text-field transition-colors hover:text-field-hot"
          >
            {live ? "Watch the stream" : "Watch the tapes"}
            <svg viewBox="0 0 16 16" className="ml-2 h-3.5 w-3.5" aria-hidden>
              <path d="M8 2v10M3 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.2" />
            </svg>
          </a>
        </div>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element -- static export, local sticker */}
      <img
        src="/stickers/king.png"
        alt=""
        className="sticker absolute -right-3 bottom-48 z-20 w-24 rotate-[-10deg] sm:w-32 md:-right-6 md:bottom-24 md:w-40 lg:w-48"
      />
    </section>
  );
}
