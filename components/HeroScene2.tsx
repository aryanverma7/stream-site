"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { createTapCounter, isTap } from "@/lib/tapCounter";
import { ARCANA, SLICE_CHANCE, createIdle, createReading, dealer, type Arcana } from "@/lib/tarot";

// "Calling card": a gale of cut paper shards (ink, paper, deep red) tears diagonally across
// the red room in three depths, under a halftone, while a hand-cut card turns slowly in the
// middle and leans toward the pointer. The card is the admin door (five taps in three seconds).
// Flick it and it spins with momentum, knocks the loose shards around it and lands on a tarot
// card with a fortune; after HOLD_MS it springs back to the calling card. About one real flick in
// five (and once after 40-70 s of no interaction) the card is sliced instead: two blades cross it,
// the quarters fall away and a new card in the next colourway slams in. The idle turn is CSS;
// per-frame JS runs only while the card or a loose shard is still moving.

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
const COLOURWAYS = [
  { name: "CLASSIC", card: "#f4efe6", star: "#0b0b0b", blade: "#d80f1d", eye: "#f4efe6", plate: "#0b0b0b", text: "#f4efe6", edge: "#0b0b0b" },
  { name: "INKED", card: "#0b0b0b", star: "#f4efe6", blade: "#d80f1d", eye: "#0b0b0b", plate: "#d80f1d", text: "#f4efe6", edge: "#f4efe6" },
  { name: "REDCARD", card: "#b80c18", star: "#0b0b0b", blade: "#f4efe6", eye: "#b80c18", plate: "#f4efe6", text: "#0b0b0b", edge: "#0b0b0b" },
];
/** The slice's quarters: clip, translate x %, y %, rotate deg (corner-to-corner X cut). */
const PIECES: [string, number, number, number][] = [
  ["polygon(-5% -5%,110% -5%,110% 3.6%,50% 50%,-5% 3.6%)", -6, 70, -22],
  ["polygon(110% 3.6%,110% 110%,110% 96.4%,50% 50%)", 45, 60, 32],
  ["polygon(-5% 96.4%,50% 50%,110% 96.4%,110% 110%,-5% 110%)", 6, 90, 14],
  ["polygon(-5% 3.6%,50% 50%,-5% 96.4%)", -45, 55, -34],
];
const CUTS = `<svg class="cc-cuts" viewBox="0 0 200 280" preserveAspectRatio="none">${["M0 10 L200 270", "M200 10 L0 270"]
  .map((d, k) => `<path class="i${k ? " two" : ""}" d="${d}"/><path class="e${k ? " two" : ""}" d="${d}"/>`)
  .join("")}</svg>`;
const LOOSE = 12; // loose shards around the card that a flick knocks about
const FLICK_SPEED = 300; // px/s at release

const CSS = `
.cc-shard{position:absolute;left:0;animation:cc-fly linear infinite;will-change:transform}
@keyframes cc-fly{from{transform:translate3d(-20vw,-12vh,0) rotate(0)}to{transform:translate3d(120vw,14vh,0) rotate(540deg)}}
.cc-card{animation:cc-turn 7s ease-in-out infinite;will-change:transform;transform-style:preserve-3d}
@keyframes cc-turn{0%,100%{transform:rotateY(-18deg) rotateZ(-7deg) translateY(0)}50%{transform:rotateY(18deg) rotateZ(-3deg) translateY(-2%)}}
.cc-flip{position:relative;transform-style:preserve-3d}
.cc-face{backface-visibility:hidden;-webkit-backface-visibility:hidden}
.cc-loose{position:absolute;left:-14px;top:-11px;width:28px;height:22px;will-change:transform}
.cc-cuts{position:absolute;inset:-4%;width:108%;height:108%;overflow:visible;z-index:1}
.cc-cuts path{fill:none;stroke-linecap:round;stroke-dasharray:420;stroke-dashoffset:420;animation:cc-cut .15s ease-out forwards}
.cc-cuts .i{stroke:#0b0b0b;stroke-width:12}.cc-cuts .e{stroke:#f4efe6;stroke-width:5}.cc-cuts .two{animation-delay:.12s}
@keyframes cc-cut{to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){.cc-shard,.cc-card{animation:none}}
`;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The flick: drag the card and throw it; it spins with momentum, springs home and knocks the
 * loose shards. A real flick (fast release, never a tap) draws an arcana and lands tarot-up;
 * the reading's hold ends with the card springing back. Under reduced motion nothing spins:
 * a flick just turns the card over. A sliced flick (`random() < SLICE_CHANCE`) asks `onSlice` to
 * cut the card instead, which refuses (false) while a slice is still running.
 */
function mountFlick(
  card: HTMLElement,
  flip: HTMLElement,
  looseEls: HTMLElement[],
  onReading: (a: Arcana | null) => void,
  random: () => number,
  onSlice: () => boolean,
) {
  const reading = createReading(dealer(ARCANA));
  const s = { x: 0, y: 0, a: 0, z: 0, vx: 0, vy: 0, va: 0, vz: 0 };
  let w = card.getBoundingClientRect().width;
  const bits = looseEls.map((el, k) => ({ el, k, rx: 0, ry: 0, ox: 0, oy: 0, r: k * 37, vx: 0, vy: 0, vr: 0 }));
  // The ring is sized from the card, so it is re-placed whenever the card's width changes (rotation, resize).
  const place = () => {
    for (const b of bits) {
      const ang = (b.k / LOOSE) * Math.PI * 2 + 0.3;
      const reach = w * (0.82 + (b.k % 3) * 0.12);
      b.rx = Math.cos(ang) * reach;
      b.ry = Math.sin(ang) * reach * 0.8;
    }
  };
  place();
  let face = 0; // 0 = calling card up, 180 = tarot up
  let drag: null | { sx: number; sy: number; t0: number; a0: number; x0: number; y0: number; px: number; py: number; pt: number; vx: number; vy: number } = null;
  let raf = 0;
  let last = 0;
  let hold = 0;

  const draw = () => {
    flip.style.transform = `translate(${s.x}px,${s.y}px) rotateY(${s.a}deg) rotateZ(${s.z}deg)`;
    for (const b of bits) b.el.style.transform = `translate(${b.rx + b.ox}px,${b.ry + b.oy}px) rotate(${b.r}deg)`;
  };
  const idle = (on: boolean) => (card.style.animationPlayState = on ? "" : "paused");

  const loop = (t: number) => {
    const dt = Math.min(0.032, Math.max(0, (t - last) / 1000));
    last = t;
    let moving = !!drag;
    if (!drag) {
      s.vx += (-170 * s.x - 14 * s.vx) * dt;
      s.x += s.vx * dt;
      s.vy += (-170 * s.y - 14 * s.vy) * dt;
      s.y += s.vy * dt;
      s.vz += (-120 * s.z - 12 * s.vz) * dt;
      s.z += s.vz * dt;
      const goal = () => Math.round((s.a - face) / 360) * 360 + face;
      if (Math.abs(s.va) > 260) s.va *= Math.exp(-1.4 * dt);
      else s.va += (-90 * (s.a - goal()) - 12 * s.va) * dt;
      s.a += s.va * dt;
      moving =
        Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.z) + Math.abs(s.a - goal()) > 0.3 ||
        Math.abs(s.vx) + Math.abs(s.vy) + Math.abs(s.va) > 3;
      if (!moving) Object.assign(s, { x: 0, y: 0, z: 0, a: face, vx: 0, vy: 0, va: 0, vz: 0 });
    }
    for (const b of bits) {
      b.vx += (-26 * b.ox - 4 * b.vx) * dt;
      b.ox += b.vx * dt;
      b.vy += (-26 * b.oy - 4 * b.vy) * dt;
      b.oy += b.vy * dt;
      b.vr *= Math.exp(-2 * dt);
      b.r += b.vr * dt;
      if (Math.abs(b.ox) + Math.abs(b.oy) > 0.5 || Math.abs(b.vx) + Math.abs(b.vy) + Math.abs(b.vr) > 4) moving = true;
    }
    draw();
    if (moving) raf = requestAnimationFrame(loop);
    else {
      raf = 0;
      idle(true);
    }
  };

  /** Spring to `to` (0 or 180), or turn at once under reduced motion. */
  const land = (to: number) => {
    face = to;
    if (reducedMotion()) {
      Object.assign(s, { x: 0, y: 0, z: 0, a: face, vx: 0, vy: 0, va: 0, vz: 0 });
      draw();
      idle(true);
      return;
    }
    idle(false);
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };

  const settle = () => {
    const left = reading.until() - Date.now();
    if (left > 0) {
      hold = window.setTimeout(settle, left);
      return;
    }
    onReading(null);
    land(0);
  };

  /** Cut the card: the reading ends and the new card rests calling-card up. */
  const slice = () => {
    if (!onSlice()) return false;
    window.clearTimeout(hold);
    onReading(null);
    Object.assign(s, { x: 0, y: 0, a: 0, z: 0, vx: 0, vy: 0, va: 0, vz: 0 });
    draw();
    land(0);
    return true;
  };

  const flick = (vx: number, vy: number) => {
    if (random() < SLICE_CHANCE && slice()) return;
    onReading(reading.draw(Date.now()));
    window.clearTimeout(hold);
    hold = window.setTimeout(settle, reading.until() - Date.now());
    if (!reducedMotion()) {
      Object.assign(s, { va: vx * 0.9, vx: vx * 0.2, vy: vy * 0.2, vz: vx * 0.05 });
      const speed = Math.hypot(vx, vy);
      for (const b of bits) {
        const d = Math.hypot(b.rx, b.ry) || 1;
        const f = speed * 0.55 * (w ? w / (w + d * 0.5) : 1) * rand(0.6, 1.2);
        b.vx += (b.rx / d) * f + vx * 0.25;
        b.vy += (b.ry / d) * f + vy * 0.25;
        b.vr += rand(-1, 1) * speed;
      }
    }
    land(180);
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    card.setPointerCapture?.(e.pointerId);
    const now = Date.now();
    drag = { sx: e.clientX, sy: e.clientY, t0: now, a0: s.a - (s.x / 0.6) * 0.5, x0: e.clientX - s.x / 0.6, y0: e.clientY - s.y / 0.6, px: e.clientX, py: e.clientY, pt: now, vx: 0, vy: 0 };
    Object.assign(s, { vx: 0, vy: 0, va: 0, vz: 0 });
    idle(false);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const now = Date.now();
    const dtm = Math.max(1, now - drag.pt);
    drag.vx = drag.vx * 0.5 + ((e.clientX - drag.px) / dtm) * 500;
    drag.vy = drag.vy * 0.5 + ((e.clientY - drag.py) / dtm) * 500;
    Object.assign(drag, { px: e.clientX, py: e.clientY, pt: now });
    if (reducedMotion()) return;
    const dx = e.clientX - drag.x0;
    Object.assign(s, { x: dx * 0.6, y: (e.clientY - drag.y0) * 0.6, a: drag.a0 + dx * 0.5, z: dx * 0.05 });
    draw();
  };
  const onUp = (e: PointerEvent) => {
    const d = drag;
    drag = null;
    if (!d) return;
    const now = Date.now();
    // Taps belong to the door; a pause before letting go is not a flick.
    const thrown = !isTap(e.clientX - d.sx, e.clientY - d.sy, now - d.t0) && now - d.pt <= 80 && Math.hypot(d.vx, d.vy) > FLICK_SPEED;
    if (thrown) flick(d.vx, d.vy);
    else land(face);
  };
  const onCancel = () => {
    if (!drag) return;
    drag = null;
    land(face);
  };

  draw();
  const resized = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
    w = card.getBoundingClientRect().width;
    place();
    draw();
  });
  resized?.observe(card);
  card.addEventListener("pointerdown", onDown);
  card.addEventListener("pointermove", onMove);
  card.addEventListener("pointerup", onUp);
  card.addEventListener("pointercancel", onCancel);
  const stop = () => {
    resized?.disconnect();
    card.removeEventListener("pointerdown", onDown);
    card.removeEventListener("pointermove", onMove);
    card.removeEventListener("pointerup", onUp);
    card.removeEventListener("pointercancel", onCancel);
    cancelAnimationFrame(raf);
    window.clearTimeout(hold);
  };
  return { stop, slice };
}

function TarotFace({ a }: { a: Arcana }) {
  return (
    <svg viewBox="0 0 200 280" className="block w-full drop-shadow-[10px_12px_0_#0b0b0b]">
      <polygon points="8,14 192,2 196,268 2,278" fill="#f4efe6" stroke="#0b0b0b" strokeWidth="6" />
      <polygon points="8,14 52,12 8,58" fill="#d80f1d" />
      <polygon points="196,268 152,270 196,222" fill="#d80f1d" />
      <g transform="rotate(-4 100 31)">
        <rect x="66" y="18" width="68" height="26" fill="#0b0b0b" />
        <text x="100" y="39" textAnchor="middle" fontSize="22" fontWeight="900" fill="#f4efe6" fontFamily="inherit">
          {a.n}
        </text>
      </g>
      <g dangerouslySetInnerHTML={{ __html: a.art }} />
      <g transform="rotate(-3 100 247)">
        <rect x="22" y="232" width="156" height="30" fill="#0b0b0b" />
        <text
          x="100"
          y="254"
          textAnchor="middle"
          fontSize={a.name.length > 11 ? 17 : 20}
          fontWeight="900"
          fill="#f4efe6"
          fontFamily="inherit"
          {...(a.name.length > 9 ? { textLength: 140, lengthAdjust: "spacingAndGlyphs" } : {})}
        >
          {a.name}
        </text>
      </g>
    </svg>
  );
}

/** `random` decides slices and the idle wait, `now` is the idle slice's clock (both injectable for tests). */
export function HeroScene2({ random = Math.random, now = Date.now }: { random?: () => number; now?: () => number } = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLButtonElement>(null);
  const flipRef = useRef<HTMLDivElement>(null);
  const looseRef = useRef<HTMLDivElement>(null);
  const slamRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const [colour, setColour] = useState(0);
  const tap = useRef(createTapCounter(5, 3000));
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const leaving = useRef(false);
  const navTimer = useRef(0);
  // The arcana on the card's back (kept while it turns home) and whether its fortune is showing.
  const [reading, setReading] = useState<{ a: Arcana; on: boolean } | null>(null);
  useEffect(() => () => window.clearTimeout(navTimer.current), []);

  useEffect(() => {
    const timers: number[] = [];
    const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
    let slicing = false;
    const nextColour = () => setColour((c) => (c + 1) % COLOURWAYS.length);
    // Two blades cross the card, its quarters fall away with shards, the next colourway slams in.
    const onSlice = () => {
      if (slicing || leaving.current) return false;
      if (reducedMotion()) {
        nextColour();
        return true;
      }
      slicing = true;
      const fx = fxRef.current!;
      const slam = slamRef.current!;
      const face = flipRef.current!.querySelector("svg")!.outerHTML;
      fx.style.transform = getComputedStyle(cardRef.current!).transform.replace("none", "");
      fx.innerHTML = CUTS;
      later(300, () => {
        fx.innerHTML = "";
        slam.style.opacity = "0";
        const fall = (el: HTMLElement, to: string, ms: number) =>
          el.animate?.([{ transform: "none", opacity: 1 }, { transform: to, opacity: 0 }], { duration: ms, easing: "cubic-bezier(.3,0,.8,.6)", fill: "forwards" });
        for (const [clip, tx, ty, rot] of PIECES) {
          const p = document.createElement("div");
          p.className = "absolute inset-0";
          p.style.clipPath = clip;
          p.innerHTML = face;
          fx.append(p);
          fall(p, `translate(${tx}%,${ty}%) rotate(${rot}deg)`, 850);
        }
        for (let k = 0; k < 16; k++) {
          const b = document.createElement("span");
          b.className = "absolute left-1/2 top-1/2 h-[18px] w-[22px]";
          Object.assign(b.style, { background: FILLS[k % 4], clipPath: SHAPES[k % 3] });
          fx.append(b);
          const a = rand(0, Math.PI * 2);
          const r = rand(90, 220);
          fall(b, `translate(${Math.cos(a) * r}px,${Math.sin(a) * r}px) rotate(${rand(-540, 540)}deg) scale(${rand(0.6, 1.6)})`, 800);
        }
        nextColour();
      });
      later(450, () => {
        const side = Math.random() < 0.5 ? -1 : 1;
        slam.style.opacity = "";
        slam.animate?.(
          [
            { transform: `translate(${side * 110}vw,-45vh) rotate(${side * -600}deg) scale(1.3)` },
            { transform: `translate(${side * -4}%,2%) rotate(${side * 7}deg) scale(.94)`, offset: 0.72 },
            { transform: "none" },
          ],
          { duration: 750, easing: "cubic-bezier(.2,.7,.3,1)" },
        );
      });
      later(1300, () => {
        fx.innerHTML = "";
        slicing = false;
      });
      return true;
    };
    const flick = mountFlick(
      cardRef.current!,
      flipRef.current!,
      [...looseRef.current!.children] as HTMLElement[],
      (a) => setReading((r) => (a ? { a, on: true } : r && { ...r, on: false })),
      random,
      onSlice,
    );
    // Once per quiet stretch, 40-70 s after the last pointer or key press, the card is sliced on its own.
    const idle = createIdle(random);
    let idleTimer = 0;
    const arm = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => idle.take(now()) && flick.slice(), idle.poke(now()) - now());
    };
    arm();
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    return () => {
      flick.stop();
      timers.forEach(window.clearTimeout);
      window.clearTimeout(idleTimer);
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, [random, now]);

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
    const reduced = reducedMotion();
    const flash = flashRef.current!;
    flash.style.transition = reduced ? "none" : "opacity 0.6s ease-in";
    flash.style.opacity = "1";
    // A real document navigation: the backend gates /admin with a redirect the router cannot follow.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- see above
    navTimer.current = window.setTimeout(() => window.location.assign("/admin"), reduced ? 0 : 850);
  };

  const cw = COLOURWAYS[colour];
  const fortune = reading?.on ? `${reading.a.name}: ${reading.a.fortune}` : "";

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
      <div className="absolute inset-0 z-[1] flex flex-col items-center justify-start pt-[14vh] [perspective:900px] md:pt-[10vh]">
        <div
          className="relative"
          style={{
            transform: "rotateY(calc(var(--lx, 0) * 24deg)) rotateX(calc(var(--ly, 0) * -18deg))",
            transition: "transform 0.4s cubic-bezier(.2,.8,.2,1)",
          } as CSSProperties}
        >
          <div ref={slamRef}>
          <button
            ref={cardRef}
            type="button"
            aria-label="Calling card"
            data-colourway={cw.name}
            tabIndex={-1}
            onPointerDown={onDown}
            onPointerUp={onUp}
            className="cc-card block w-[min(62vw,22rem)] cursor-default touch-pan-y select-none"
          >
            <div ref={flipRef} className="cc-flip">
              <svg viewBox="0 0 200 280" className="cc-face block w-full drop-shadow-[10px_12px_0_#0b0b0b]">
                <polygon points="8,14 192,2 196,268 2,278" fill={cw.card} stroke={cw.edge} strokeWidth="6" />
                <polygon
                  fill={cw.star}
                  points={Array.from({ length: 24 }, (_, k) => {
                    const r = k % 2 ? 38 : 78 + (k % 4) * 4;
                    const a = (k / 24) * Math.PI * 2;
                    return `${(100 + Math.cos(a) * r).toFixed(1)},${(128 + Math.sin(a) * r).toFixed(1)}`;
                  }).join(" ")}
                />
                <path d="M58 70 L150 186 L136 196 L46 82 Z M146 64 L160 76 L62 194 L48 182 Z" fill={cw.blade} />
                <circle cx="100" cy="128" r="14" fill={cw.eye} stroke="#0b0b0b" strokeWidth="5" />
                <rect x="22" y="232" width="156" height="30" fill={cw.plate} transform="rotate(-3 100 247)" />
                <text x="100" y="254" textAnchor="middle" fontSize="20" fontWeight="900" fill={cw.text} fontFamily="inherit" transform="rotate(-3 100 247)">
                  DUALBLADEX
                </text>
              </svg>
              <div aria-hidden className="cc-face absolute inset-0 [transform:rotateY(180deg)]">
                {reading && <TarotFace a={reading.a} />}
              </div>
            </div>
          </button>
          </div>
          <div ref={fxRef} aria-hidden className="pointer-events-none absolute inset-0 z-[3]" />
          <div ref={looseRef} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-[2] h-0 w-0">
            {Array.from({ length: LOOSE }, (_, k) => (
              <span key={k} className="cc-loose" style={{ background: FILLS[k % 4], clipPath: SHAPES[k % 3] }} />
            ))}
          </div>
        </div>
      </div>
      {/* The fortune sits above every hero overlay (Hero's slashes, sticker and tags are z-10/z-20),
          under the card by a card-sized spacer, 16px from the viewport edges. */}
      <div className="pointer-events-none absolute inset-x-4 inset-y-0 z-30 flex flex-col items-center pt-[14vh] md:pt-[10vh]">
        <div aria-hidden className="aspect-[5/7] w-[min(62vw,22rem)] shrink-0" />
        <p
          aria-live="polite"
          className={`stencil no-shadow mt-6 max-w-[min(100%,30rem)] -rotate-2 border-2 border-paper bg-ink px-3.5 py-2 text-center text-[clamp(15px,2.4vw,20px)] !leading-tight tracking-[0.03em] text-paper shadow-[5px_5px_0_#7a0710] ${
            fortune ? "" : "invisible"
          }`}
        >
          {fortune}
        </p>
      </div>
      <div ref={flashRef} className="pointer-events-none absolute inset-0 z-40 bg-ink opacity-0" />
    </div>
  );
}
