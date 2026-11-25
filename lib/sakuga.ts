/*
 * Sakuga motion for our own controls: presses squash and overshoot on a
 * spring, and one effects canvas throws impact stars, slashes, smoke and
 * comic SFX lettering on top. Ported in part from sakuga-vfx core.js
 * (Spring, squashy, puff, burst, slash, sfx) and restyled to the Persona
 * tokens in app/globals.css: their --sk-* palette maps to ours below.
 * Not ported: the custom elements, the traced Japanese word shapes (our
 * lettering is Anton caps drawn as text), and the other effects.
 *
 * MIT License
 *
 * Copyright (c) 2026 Justin Finkelman
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rnd = (a: number, b?: number) => (b === undefined ? (Math.random() - 0.5) * 2 * a : a + Math.random() * (b - a));
const out = (t: number) => 1 - (1 - t) ** 3;
const inn = (t: number) => t * t * t;
const back = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

/** A spring: overshoots and settles instead of stopping dead. */
export class Spring {
  v = 0;
  to: number;
  constructor(public x = 0, public k = 300, public d = 20) {
    this.to = x;
  }
  step(dt: number) {
    if (!(dt > 0)) return this.x;
    for (let n = Math.ceil(dt / 0.008), h = dt / n; n--; ) {
      this.v += (-this.k * (this.x - this.to) - this.d * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}

// --sk-* mapped to ours: card/fill = --phosphor, shade/acc = --field-deep / --field, line/ink = --ink.
const P = { fill: "#ffffff", shade: "#e60012", line: "#0b0b0b", accent: "#ff1f30", ink: "#0b0b0b" };
function readPalette() {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, dflt: string) => s.getPropertyValue(name).trim() || dflt;
  P.fill = v("--phosphor", P.fill);
  P.shade = v("--field-deep", P.shade);
  P.line = P.ink = v("--ink", P.ink);
  P.accent = v("--field", P.accent);
}

type Draw = (k: number, t: number) => void;
type Effect = { t: number; life: number; draw: Draw };

let calm = true; // until install() reads prefers-reduced-motion
let canvas: HTMLCanvasElement | null = null;
let g: CanvasRenderingContext2D | null = null;
let dpr = 1;
let live: Effect[] = [];
const frames = new Set<(dt: number) => boolean>(); // return false when settled
let running = false;
let last = 0;

function ensureCanvas() {
  if (canvas) return !!g;
  canvas = document.createElement("canvas");
  canvas.className = "sakuga-fx";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  g = canvas.getContext("2d");
  size();
  return !!g;
}
function size() {
  dpr = Math.min(2.5, window.devicePixelRatio || 1);
  if (canvas) {
    // the box the CSS gave it, not innerHeight/100vh: they disagree while a mobile toolbar shows
    canvas.width = (canvas.clientWidth || innerWidth) * dpr;
    canvas.height = (canvas.clientHeight || innerHeight) * dpr;
  }
}

/** Every effect goes through here; under reduced motion nothing is drawn. */
function add(life: number, draw: Draw) {
  if (calm || !ensureCanvas()) return;
  live.push({ t: 0, life, draw });
  start();
}

function loop(ms: number) {
  const dt = clamp((ms - last) / 1000, 0, 0.034);
  last = ms;
  for (const f of frames) if (!f(dt)) frames.delete(f);
  if (g && canvas) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    g.lineJoin = g.lineCap = "round";
    live = live.filter((p) => (p.t += dt) < p.life);
    for (const p of live) {
      g.save();
      p.draw(p.t / p.life, p.t);
      g.restore();
    }
  }
  if (!frames.size && !live.length) {
    running = false;
    return;
  }
  requestAnimationFrame(loop);
}
function start() {
  if (running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(loop);
}

// ------------------------------------------------------------ draw helpers
function blob(cs: [number, number, number][], lw: number, deep: number) {
  const c = g!;
  const u = new Path2D();
  for (const [x, y, r] of cs) if (r > 0.3) { u.moveTo(x + r, y); u.arc(x, y, r, 0, TAU); }
  c.save(); c.lineWidth = lw * 2; c.strokeStyle = P.line; c.stroke(u); c.restore();
  c.save(); c.clip(u); c.fillStyle = P.shade; c.fillRect(-1e4, -1e4, 2e4, 2e4);
  const r = cs[0] ? cs[0][2] : 8;
  c.translate(0.5 * r * 0.2 * deep, -r * 0.26 * deep); c.fillStyle = P.fill; c.fill(u);
  c.restore();
}
function shape(path: Path2D, lw: number, off: number) {
  const c = g!;
  c.save(); c.lineWidth = lw * 2; c.strokeStyle = P.line; c.stroke(path); c.restore();
  c.save(); c.clip(path); c.fillStyle = P.shade; c.fillRect(-1e4, -1e4, 2e4, 2e4);
  c.translate(-off * 0.7, -off); c.fillStyle = P.fill; c.fill(path); c.restore();
}

// ------------------------------------------------------------ effects
/** Smoke: lobes swell out with a little overshoot, roll, and shrink away. */
export function puff(x: number, y: number, { n = 5, size = 13, vx = 0, vy = -18, life = 0.8 } = {}) {
  const lobes = Array.from({ length: n }, (_, i) => ({ a: (i / n) * TAU + rnd(0.6), d: rnd(0.25, 0.9) * size, r: rnd(0.55, 1) * size, ph: rnd(TAU), sp: rnd(0.6, 1.3) }));
  lobes.unshift({ a: 0, d: 0, r: size, ph: 0, sp: 1 });
  add(life, (k, t) => {
    const grow = back(clamp(t / 0.22)), die = 1 - inn(clamp((k - 0.55) / 0.45));
    const px = x + vx * out(k) * life, py = y + vy * out(k) * life, o = 0.5 + out(k) * 0.9;
    blob(
      lobes.map((l) => [
        px + Math.cos(l.a + t * 0.9 * l.sp) * l.d * o,
        py + Math.sin(l.a + t * 0.9 * l.sp) * l.d * o - out(k) * 5 * l.sp,
        l.r * grow * die * (1 + Math.sin(t * 9 + l.ph) * 0.05),
      ]),
      1.5,
      1.5,
    );
  });
}

/** Impact: red needles, a red star, a white star on top; leaves by its points thinning away. */
export function burst(x: number, y: number, { r = 44, spikes = 13, life = 0.34 } = {}) {
  const j = Array.from({ length: spikes * 2 }, (_, i) => (i % 2 ? rnd(0.34, 0.5) : rnd(0.75, 1.15)));
  const rot = rnd(TAU);
  const pins = Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * TAU + rnd(0.5), l: rnd(1.25, 1.75), w: rnd(0.03, 0.055) }));
  const star = (R: number, turn: number, inner: number) => {
    const p = new Path2D();
    j.forEach((m, i) => {
      const a = rot + turn + (i / j.length) * TAU, rr = R * (i % 2 ? m * inner : m);
      if (i) p.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else p.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    });
    p.closePath();
    return p;
  };
  add(life, (k) => {
    const c = g!;
    const R = r * out(clamp(k / 0.3)), hollow = 1 + inn(clamp((k - 0.35) / 0.65)) * 1.3, r0 = R * 0.6 * Math.min(1.9, hollow);
    c.fillStyle = P.accent;
    c.beginPath();
    for (const n of pins) {
      const l = R * n.l;
      if (l <= r0) continue;
      c.moveTo(x + Math.cos(n.a - n.w) * r0, y + Math.sin(n.a - n.w) * r0);
      c.lineTo(x + Math.cos(n.a) * l, y + Math.sin(n.a) * l);
      c.lineTo(x + Math.cos(n.a + n.w) * r0, y + Math.sin(n.a + n.w) * r0);
    }
    c.fill();
    const big = star(R * 1.16, 0.19, hollow);
    c.fillStyle = P.shade; c.fill(big); c.strokeStyle = P.line; c.lineWidth = 1.2; c.stroke(big);
    shape(star(R * 0.84, 0, hollow), 1.4, 3);
  });
}

/** Slash: a crescent whose head races ahead and whose tail catches up. */
export function slash(x: number, y: number, { len = 110, ang = -0.5, life = 0.42, thick = 15 } = {}) {
  const R = len * 0.9, cx = x - Math.cos(ang - Math.PI / 2) * R * 0.86, cy = y - Math.sin(ang - Math.PI / 2) * R * 0.86;
  const a0 = ang - Math.PI / 2 - 0.62, sweep = 1.24;
  add(life, (k) => {
    const c = g!;
    const head = out(clamp(k / 0.42)), tail = inn(clamp((k - 0.22) / 0.78));
    if (head - tail < 0.01) return;
    const cres = (T: number) => {
      const p = new Path2D(), N = 26;
      for (let i = 0; i <= N; i++) {
        const a = a0 + sweep * lerp(tail, head, i / N);
        if (i) p.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        else p.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      }
      for (let i = N; i >= 0; i--) {
        const q = i / N, a = a0 + sweep * lerp(tail, head, q), rr = R - T * Math.sin(q * Math.PI) ** 0.7;
        p.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      p.closePath();
      return p;
    };
    c.fillStyle = P.accent; c.fill(cres(thick));
    c.fillStyle = P.fill; c.fill(cres(thick * 0.42));
    c.strokeStyle = P.line; c.lineWidth = 1.3; c.stroke(cres(thick));
  });
}

/** Comic SFX: a word lands a size too big and wobbles while it stays. Anton caps, ink edge, red offset. */
export function sfx(word: string, x: number, y: number, { size = 34, rot = -0.14, life = 0.9 } = {}) {
  const s = new Spring(0.2, 520, 17);
  s.to = 1;
  let lastT = 0;
  add(life, (k, t) => {
    const c = g!;
    const sc = s.step(t - lastT) * (1 - inn(clamp((k - 0.86) / 0.14)));
    lastT = t;
    c.translate(x + Math.sin(t * 31) * 0.8, y + Math.cos(t * 27) * 0.8);
    c.rotate(rot + Math.sin(t * 6) * 0.03);
    c.scale(sc, sc);
    c.font = `${size}px Anton, Impact, sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.lineWidth = size * 0.22;
    c.strokeStyle = P.line;
    c.fillStyle = P.shade;
    c.strokeText(word, size * 0.08, size * 0.08);
    c.fillText(word, size * 0.08, size * 0.08);
    c.strokeText(word, 0, 0);
    c.fillStyle = P.fill;
    c.fillText(word, 0, 0);
  });
}

// ------------------------------------------------------------ controls
/** Squash flat while held, overshoot on release. Uses `scale`/`rotate`, so a CSS transform (skew, menu lean) still applies. */
const squashes = new WeakMap<HTMLElement, { s: Spring; pop: Spring; step: (dt: number) => boolean }>();
export function press(el: HTMLElement, down: boolean, { low = 0.86, wide = 0.45 } = {}) {
  if (calm) return;
  let q = squashes.get(el);
  if (!q) {
    const s = new Spring(1, 520, 15), pop = new Spring(1, 300, 12);
    const step = (dt: number) => {
      const y = s.step(dt), p = pop.step(dt);
      const still = Math.abs(y - 1) < 0.001 && Math.abs(s.v) < 0.01 && Math.abs(p - 1) < 0.001 && Math.abs(pop.v) < 0.01;
      if (still) el.style.removeProperty("scale");
      else el.style.setProperty("scale", `${((1 + (1 - y) * wide) * p).toFixed(4)} ${(y * p).toFixed(4)}`);
      return !still;
    };
    q = { s, pop, step };
    squashes.set(el, q);
  }
  q.s.to = down ? low : 1;
  if (!down) q.pop.v += 3; // the release kick
  frames.add(q.step);
  start();
}

// not [role="slider"]: squashing the scrub bar would move the seek point off the cursor; it only gets smoke
const PRESSABLE = 'button, a.wallpaper, [role="tab"], input[type="checkbox"]';
const centre = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, r };
};

function onDown(e: PointerEvent) {
  const slider = (e.target as Element).closest?.('[role="slider"]') as HTMLElement | null;
  if (slider) return dragSmoke(slider, e);
  const el = (e.target as Element).closest?.(PRESSABLE) as HTMLElement | null;
  if (!el || (el as HTMLButtonElement).disabled) return;
  press(el, true);
  const up = () => {
    press(el, false);
    removeEventListener("pointerup", up);
    removeEventListener("pointercancel", up);
  };
  addEventListener("pointerup", up);
  addEventListener("pointercancel", up);
}

function dragSmoke(el: HTMLElement, e0: PointerEvent) {
  let lx = e0.clientX, lt = performance.now(), quiet = 0;
  const move = (e: PointerEvent) => {
    const now = performance.now(), v = Math.abs(e.clientX - lx) / Math.max(1, now - lt);
    if (v > 0.6 && now - quiet > 90) {
      puff(e.clientX - Math.sign(e.clientX - lx) * 10, e.clientY, { size: 7, n: 3, life: 0.5, vy: -10 });
      quiet = now;
    }
    lx = e.clientX;
    lt = now;
  };
  // a touch scrub that turns into a pan ends in pointercancel, not pointerup: no slash, but stop listening
  const end = (e: PointerEvent) => {
    if (e.type === "pointerup") slash(e.clientX, centre(el).y, { len: 46, thick: 8, life: 0.34 });
    removeEventListener("pointermove", move);
    removeEventListener("pointerup", end);
    removeEventListener("pointercancel", end);
  };
  addEventListener("pointermove", move);
  addEventListener("pointerup", end);
  addEventListener("pointercancel", end);
}

function onClick(e: MouseEvent) {
  const t = e.target as Element;
  const tab = t.closest?.('[role="tab"], .menu-pop');
  if (tab) {
    const c = centre(tab);
    slash(c.x, c.y, { len: Math.max(60, c.w * 0.8), thick: 11, ang: -0.4 });
    return;
  }
  const primary = t.closest?.("button.wallpaper, a.wallpaper") as HTMLButtonElement | null;
  if (primary && !primary.disabled) {
    const c = centre(primary);
    burst(c.x, c.y, { r: Math.min(56, Math.max(30, c.h * 1.1)) });
    puff(c.r.left + 6, c.r.bottom, { vx: -30, size: 10 });
    puff(c.r.right - 6, c.r.bottom, { vx: 30, size: 10 });
    sfx("BAM!", c.r.right + 4, c.r.top - 6, { size: 28 });
    return;
  }
  const btn = t.closest?.("button") as HTMLButtonElement | null;
  if (btn && !btn.disabled && e.detail > 0) {
    // a real click (not Enter, which also fires click) gets a small puff where it landed
    puff(e.clientX, e.clientY, { size: 6, n: 3, life: 0.45, vy: -14 });
  }
}

function onChange(e: Event) {
  const box = e.target as HTMLInputElement;
  if (box.type !== "checkbox") return;
  const c = centre(box);
  if (box.checked) {
    burst(c.x, c.y, { r: 20, spikes: 9, life: 0.3 });
    sfx("CHECK!", c.x + 30, c.y - 14, { size: 18, life: 0.7 });
  } else puff(c.x, c.y, { size: 7, n: 3, life: 0.45 });
}

/** A toast arriving (anything with .toast-in) lands with an impact at its leading edge. */
function onAdded(list: MutationRecord[]) {
  for (const m of list)
    for (const n of m.addedNodes) {
      if (!(n instanceof HTMLElement)) continue;
      const toast = n.matches(".toast-in") ? n : n.querySelector(".toast-in");
      if (!toast) continue;
      const r = toast.getBoundingClientRect();
      if (!r.width) continue;
      burst(r.left, r.top + r.height / 2, { r: 22, spikes: 9, life: 0.3 });
      sfx("!", r.left - 2, r.top - 4, { size: 26, life: 0.6 });
    }
}

/** Wires every control on the page through document-level listeners. Returns the uninstall. */
export function install() {
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  const setCalm = () => {
    calm = mq.matches;
    if (calm) live = [];
  };
  setCalm();
  readPalette();
  mq.addEventListener?.("change", setCalm);
  addEventListener("resize", size);
  document.addEventListener("pointerdown", onDown, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("change", onChange, true);
  const mo = new MutationObserver(onAdded);
  mo.observe(document.body, { childList: true, subtree: true });
  return () => {
    calm = true;
    mq.removeEventListener?.("change", setCalm);
    removeEventListener("resize", size);
    document.removeEventListener("pointerdown", onDown, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("change", onChange, true);
    mo.disconnect();
    canvas?.remove();
    canvas = g = null;
    live = [];
  };
}
