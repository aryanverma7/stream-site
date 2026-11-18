"use client";

import { useEffect, useState, type CSSProperties } from "react";
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-existing mount-time load/sync; restructuring would change behavior
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!now) return null;
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(
    now.getMinutes(),
  )}:${pad(now.getSeconds())}`;
}

/** Ransom-note paper for each letter: picked from position and code, never
    at random, and never the same paper twice in a row. Shared with the
    editor and admin headers. */
export function ransomStyles(text: string): number[] {
  const out: number[] = [];
  [...text].forEach((ch, i) => {
    let n = (i * 3 + ch.charCodeAt(0)) % 5;
    if (n === out[i - 1]) n = (n + 2) % 5;
    out.push(n);
  });
  return out;
}

/** A word cut out of five papers. The letters are decoration (aria-hidden);
    the word itself is read once, from the sr-only copy. */
export function Ransom({ text, className = "" }: { text: string; className?: string }) {
  const styles = ransomStyles(text);
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden className={`ransom ${className}`}>
        {[...text].map((ch, i) => (
          <span key={i} className={`rn${styles[i]}`} style={{ "--i": i } as CSSProperties}>
            {ch}
          </span>
        ))}
      </span>
    </>
  );
}

/** The comic-page furniture: a turning starburst behind the title and a
    black slash across the bottom-left for it to sit on. Never interactive. */
function Slashes() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <svg className="absolute -left-40 bottom-[-18rem] h-[42rem] w-[42rem] opacity-90 spin-slow md:-left-48 md:bottom-[-22rem] md:h-[52rem] md:w-[52rem]" viewBox="-100 -100 200 200">
        <polygon
          fill="#0b0b0b"
          points={Array.from({ length: 36 }, (_, k) => {
            const r = k % 2 ? 46 : 100;
            const a = (k / 36) * Math.PI * 2;
            return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
          }).join(" ")}
        />
      </svg>
      <div className="absolute -bottom-10 -left-10 h-44 w-[130%] origin-bottom-left -rotate-[4deg] bg-ink md:h-56" />
      <div className="absolute bottom-40 -left-10 h-2 w-[70%] origin-bottom-left -rotate-[4deg] bg-phosphor md:bottom-52" />
      <div className="absolute -right-24 top-0 h-full w-40 skew-x-[-14deg] bg-ink/90 md:w-56" />
      <div className="absolute -right-24 top-0 h-full w-44 skew-x-[-14deg] border-l-4 border-phosphor md:w-60" style={{ marginRight: "3.5rem" }} />
    </div>
  );
}

/**
 * The dragon in a red room, framed like a comic page. Everything laid over it is pointer-events:
 * none except the one link, because the dragon is also the admin door -
 * charging it to a max sneeze navigates to /admin - and an overlay that
 * ate clicks would quietly lock the streamer out.
 */
export function Hero() {
  const clock = useClock();
  const live = useLiveStatus();

  return (
    <section className="relative h-screen w-full overflow-hidden">
      <Dragon />
      <Slashes />

      <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex items-start justify-end gap-3 md:inset-x-10 md:top-8">
        {/* ON AIR only while the stream is actually live; offline, the plate under the title says so. */}
        {live && (
          <p className="tag slam flex items-center gap-2 bg-phosphor text-sm text-field-deep md:text-base">
            <span className="rec-dot inline-block h-2.5 w-2.5 rounded-full bg-field-deep" aria-hidden />
            On air
          </p>
        )}
        <p className="osd hidden rotate-[2deg] border-2 border-phosphor bg-ink px-3 py-1 text-xl tabular-nums text-phosphor shadow-[4px_4px_0_var(--field-deep)] sm:block">
          {clock ?? "\u00A0"}
        </p>
      </div>

      <div className="pointer-events-none absolute inset-x-4 bottom-8 z-20 md:inset-x-12 md:bottom-12">
        <h1 className="text-[clamp(3.25rem,11vw,6rem)] leading-none">
          <Ransom text="DualBladeX" />
        </h1>

        <div className="pointer-events-auto mt-5 inline-flex max-w-full -rotate-2 flex-wrap items-stretch">
          <p
            className={`label flex items-center gap-2 border-2 border-phosphor px-3 py-2 text-sm ${
              live ? "bg-field-deep text-phosphor" : "bg-ink text-phosphor"
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
            className="menu-pop label flex items-center border-2 border-l-0 border-phosphor bg-phosphor px-4 py-2 text-sm text-ink shadow-[5px_5px_0_var(--field-deep)] hover:bg-paper"
          >
            {live ? "Watch the stream" : "Watch the tapes"}
            <svg viewBox="0 0 16 16" className="ml-2 h-3.5 w-3.5" aria-hidden>
              <path d="M8 2v10M3 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.6" />
            </svg>
          </a>
        </div>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element -- static export, local sticker */}
      <img
        src="/stickers/king.png"
        alt=""
        className="sticker absolute right-3 bottom-52 z-20 w-24 rotate-[-10deg] sm:w-32 md:right-10 md:bottom-28 md:w-40 lg:w-48"
      />
    </section>
  );
}
