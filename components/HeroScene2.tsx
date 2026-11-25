"use client";

import { useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { createTapCounter, isTap } from "@/lib/tapCounter";

// "Calling card": a gale of cut paper shards (ink, paper, deep red) tears diagonally across
// the red room in three depths, under a halftone, while a hand-cut card turns slowly in the
// middle and leans toward the pointer. The card is the admin door (five taps in three seconds).
// Pure CSS animation on transforms: no per-frame JS at all.

/** Deterministic shards: [layer, top %, size rem, delay fraction, fill, shape]. */
function shards() {
  const out: { layer: number; top: number; size: number; delay: number; fill: number; shape: number }[] = [];
  for (let i = 0; i < 42; i++) {
    const r = (k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
    const layer = i % 3;
    out.push({ layer, top: r(1) * 110 - 5, size: (0.6 + r(2)) * (1 + layer * 1.4), delay: r(3), fill: i % 4, shape: i % 3 });
  }
  return out;
}
const SHARDS = shards();
const FILLS = ["#0b0b0b", "#f4efe6", "#0b0b0b", "#7a0710"];
const SHAPES = ["polygon(0 0,100% 30%,20% 100%)", "polygon(10% 0,100% 0,0 100%)", "polygon(0 40%,100% 0,70% 100%)"];
const DURATIONS = [9, 6, 3.6];

const CSS = `
.cc-shard{position:absolute;left:0;animation:cc-fly linear infinite;will-change:transform}
@keyframes cc-fly{from{transform:translate3d(-20vw,-12vh,0) rotate(0)}to{transform:translate3d(120vw,14vh,0) rotate(540deg)}}
.cc-card{animation:cc-turn 7s ease-in-out infinite;will-change:transform}
@keyframes cc-turn{0%,100%{transform:rotateY(-18deg) rotateZ(-7deg) translateY(0)}50%{transform:rotateY(18deg) rotateZ(-3deg) translateY(-2%)}}
@media (prefers-reduced-motion:reduce){.cc-shard,.cc-card{animation:none}}
`;

export function HeroScene2() {
  const rootRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const tap = useRef(createTapCounter(5, 3000));
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const leaving = useRef(false);

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      leaving.current = false;
      if (flashRef.current) {
        flashRef.current.style.transition = "none";
        flashRef.current.style.opacity = "0";
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // The card leans toward the pointer through two CSS variables.
  const onMove = (e: ReactPointerEvent) => {
    const root = rootRef.current!;
    const box = root.getBoundingClientRect();
    root.style.setProperty("--lx", ((e.clientX - box.left) / box.width - 0.5).toFixed(3));
    root.style.setProperty("--ly", ((e.clientY - box.top) / box.height - 0.5).toFixed(3));
  };

  const onDown = (e: ReactPointerEvent) => {
    down.current = e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
  };
  const onUp = (e: ReactPointerEvent) => {
    const d = down.current;
    down.current = null;
    if (!d || e.button !== 0 || leaving.current) return;
    const now = performance.now();
    if (!isTap(e.clientX - d.x, e.clientY - d.y, now - d.t) || !tap.current(now)) return;
    leaving.current = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const flash = flashRef.current!;
    flash.style.transition = reduced ? "none" : "opacity 0.6s ease-in";
    flash.style.opacity = "1";
    // A real document navigation: the backend gates /admin with a redirect the router cannot follow.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- see above
    window.setTimeout(() => window.location.assign("/admin"), reduced ? 0 : 850);
  };

  return (
    <div
      ref={rootRef}
      data-testid="hero-scene2"
      onPointerMove={onMove}
      className="absolute inset-0 overflow-hidden"
      style={{ background: "radial-gradient(circle at 50% 40%, #e3141f 0%, #d80f1d 45%, #8c0711 100%)" }}
    >
      <style>{CSS}</style>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {SHARDS.map((s, i) => (
          <span
            key={i}
            className="cc-shard"
            style={{
              top: `${s.top}%`,
              width: `${s.size}rem`,
              height: `${s.size * 0.8}rem`,
              background: FILLS[s.fill],
              clipPath: SHAPES[s.shape],
              opacity: s.layer === 0 ? 0.55 : 1,
              animationDuration: `${DURATIONS[s.layer]}s`,
              animationDelay: `${-s.delay * DURATIONS[s.layer]}s`,
              zIndex: s.layer === 2 ? 2 : 0,
            }}
          />
        ))}
      </div>
      {/* halftone over the room, under the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-25 mix-blend-multiply"
        style={{ backgroundImage: "radial-gradient(#000 1.2px, transparent 1.6px)", backgroundSize: "9px 9px" }}
      />
      <div className="absolute inset-0 z-[1] flex items-start justify-center pt-[14vh] [perspective:900px] md:pt-[10vh]">
        <div
          style={{
            transform: "rotateY(calc(var(--lx, 0) * 24deg)) rotateX(calc(var(--ly, 0) * -18deg))",
            transition: "transform 0.4s cubic-bezier(.2,.8,.2,1)",
          } as CSSProperties}
        >
          <button
            type="button"
            aria-label="Calling card"
            tabIndex={-1}
            onPointerDown={onDown}
            onPointerUp={onUp}
            className="cc-card block w-[min(62vw,22rem)] cursor-default touch-pan-y select-none"
          >
            <svg viewBox="0 0 200 280" className="block w-full drop-shadow-[10px_12px_0_#0b0b0b]">
              <polygon points="8,14 192,2 196,268 2,278" fill="#f4efe6" stroke="#0b0b0b" strokeWidth="6" />
              <polygon
                fill="#0b0b0b"
                points={Array.from({ length: 24 }, (_, k) => {
                  const r = k % 2 ? 38 : 78 + (k % 4) * 4;
                  const a = (k / 24) * Math.PI * 2;
                  return `${(100 + Math.cos(a) * r).toFixed(1)},${(128 + Math.sin(a) * r).toFixed(1)}`;
                }).join(" ")}
              />
              <path d="M58 70 L150 186 L136 196 L46 82 Z M146 64 L160 76 L62 194 L48 182 Z" fill="#d80f1d" />
              <circle cx="100" cy="128" r="14" fill="#f4efe6" stroke="#0b0b0b" strokeWidth="5" />
              <rect x="22" y="232" width="156" height="30" fill="#0b0b0b" transform="rotate(-3 100 247)" />
              <text x="100" y="254" textAnchor="middle" fontSize="20" fontWeight="900" fill="#f4efe6" fontFamily="inherit" transform="rotate(-3 100 247)">
                DUALBLADEX
              </text>
            </svg>
          </button>
        </div>
      </div>
      <div ref={flashRef} className="pointer-events-none absolute inset-0 z-40 bg-ink opacity-0" />
    </div>
  );
}
