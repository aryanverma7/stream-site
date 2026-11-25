"use client";

import { useEffect, useRef } from "react";
import { createTapCounter, isTap } from "@/lib/tapCounter";

// Spheres.tsx's look and behaviour without three or gsap: raw WebGL2, one camera-facing quad
// per sphere, the sphere itself ray-traced in the fragment shader (exact normal and depth),
// the pen's three lights with three r128's legacy arithmetic, and the spot's shadow map
// replaced by an analytic soft shadow plus contact occlusion from every other sphere.

const ROOM = "#d80f1d";

const RADII = [
  1, 0.6, 0.8, 0.4, 0.9, 0.7, 0.9, 0.3, 0.2, 0.5, 0.6, 0.4, 0.5,
  0.6, 0.7, 0.3, 0.4, 0.8, 0.7, 0.5, 0.4, 0.6, 0.35, 0.38, 0.9, 0.3,
  0.6, 0.4, 0.2, 0.35, 0.5, 0.15, 0.2, 0.25, 0.4, 0.8, 0.76, 0.8, 1,
  0.8, 0.7, 0.8, 0.3, 0.5, 0.6, 0.55, 0.42, 0.75, 0.66, 0.6, 0.7, 0.5,
  0.6, 0.35, 0.35, 0.35, 0.8, 0.6, 0.7, 0.8, 0.4, 0.89, 0.3, 0.3, 0.6,
  0.4, 0.2, 0.52, 0.5, 0.15, 0.2, 0.25, 0.4, 0.8, 0.76, 0.8, 1, 0.8,
  0.7, 0.8, 0.3, 0.5, 0.6, 0.8, 0.7, 0.75, 0.66, 0.6, 0.7, 0.5, 0.6,
  0.35, 0.35, 0.35, 0.8, 0.6, 0.7, 0.8, 0.4, 0.89, 0.3,
];
// prettier-ignore
const POSITIONS = [
  0, 0, 0, 1.2, 0.9, -0.5, 1.8, -0.3, 0, -1, -1, 0, -1, 1.62, 0,
  -1.65, 0, -0.4, -2.13, -1.54, -0.4, 0.8, 0.94, 0.3, 0.5, -1, 1.2, -0.16, -1.2, 0.9,
  1.5, 1.2, 0.8, 0.5, -1.58, 1.4, -1.5, 1, 1.15, -1.5, -1.5, 0.99, -1.5, -1.5, -1.9,
  1.85, 0.8, 0.05, 1.5, -1.2, -0.75, 0.9, -1.62, 0.22, 0.45, 2, 0.65, 2.5, 1.22, -0.2,
  2.35, 0.7, 0.55, -1.8, -0.35, 0.85, -1.02, 0.2, 0.9, 0.2, 1, 1, -2.88, 0.7, 1,
  -2, -0.95, 1.5, -2.3, 2.4, -0.1, -2.5, 1.9, 1.2, -1.8, 0.37, 1.2, -2.4, 1.42, 0.05,
  -2.72, -0.9, 1.1, -1.8, -1.34, 1.67, -1.6, 1.66, 0.91, -2.8, 1.58, 1.69, -2.97, 2.3, 0.65,
  1.1, -0.2, -1.45, -4, 1.78, 0.38, 0.12, 1.4, -1.29, -1.64, 1.4, -1.79, -3.5, -0.58, 0.1,
  -0.1, -1, -2, -4.5, 0.55, -0.5, -3.87, 0, 1, -4.6, -0.1, 0.65, -3, 1.5, -0.7,
  -0.5, 0.2, -1.5, -1.3, -0.45, -1.5, -3.35, 0.25, -1.5, -4.76, -1.26, 0.4, -4.32, 0.85, 1.4,
  -3.5, -1.82, 0.9, -3.6, -0.6, 1.46, -4.55, -1.5, 1.63, -3.8, -1.15, 2.1, -2.9, -0.25, 1.86,
  -2.2, -0.4, 1.86, -5.1, -0.24, 1.86, -5.27, 1.24, 0.76, -5.27, 2, -0.4, -6.4, 0.4, 1,
  -5.15, 0.95, 2, -6.2, 0.5, -0.8, -4, 0.08, 1.8, 2, -0.95, 1.5, 2.3, 2.4, -0.1,
  2.5, 1.9, 1.2, 1.8, 0.37, 1.2, 3.24, 0.6, 1.05, 2.72, -0.9, 1.1, 1.8, -1.34, 1.67,
  1.6, 1.99, 0.91, 2.8, 1.58, 1.69, 2.97, 2.3, 0.65, -1.3, -0.2, -2.5, 4, 1.78, 0.38,
  1.72, 1.4, -1.29, 2.5, -1.2, -2, 3.5, -0.58, 0.1, 0.1, 0.4, -2.42, 4.5, 0.55, -0.5,
  3.87, 0, 1, 4.6, -0.1, 0.65, 3, 1.5, -0.7, 2.3, 0.6, -2.6, 4, 1.5, -1.6,
  3.35, 0.25, -1.5, 4.76, -1.26, 0.4, 4.32, 0.85, 1.4, 3.5, -1.82, 0.9, 3.6, -0.6, 1.46,
  4.55, -1.5, 1.63, 3.8, -1.15, 2.1, 2.9, -0.25, 1.86, 2.2, -0.4, 1.86, 5.1, -0.24, 1.86,
  5.27, 1.24, 0.76, 5.27, 2, -0.4, 6.4, 0.4, 1, 5.15, 0.95, 2, 6.2, 0.5, -0.8,
  4, 0.08, 1.8,
];
const N = RADII.length;

const INIT_Y = -25;
const REVOLUTION_RADIUS = 4;
const BREATHING_AMPLITUDE = 0.1;
const BREATHING_SPEED = 0.002;
const CAMERA_Z = 24;
const CLUSTER_HALF_WIDTH = 8;
const WIDE_CAMERA_Z = 30;
const FOV = (25 * Math.PI) / 180;
const DAMPING = 0.05;

const VERT = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aSphere;
layout(location=2) in float aPaper;
layout(location=3) in vec4 aNa;
layout(location=4) in vec4 aNb;
uniform mat4 uVP;
uniform vec3 uRight, uUp;
uniform float uShift;
out vec3 vPos;
flat out vec4 vSphere;
flat out float vPaper;
flat out ivec4 vNa, vNb;
void main() {
  vNa = ivec4(aNa); vNb = ivec4(aNb);
  vec3 p = aSphere.xyz + (uRight * aCorner.x + uUp * aCorner.y) * aSphere.w * 1.3;
  vPos = p; vSphere = aSphere; vPaper = aPaper;
  gl_Position = uVP * vec4(p, 1.0);
  gl_Position.y += uShift * gl_Position.w;
}`;

// Lighting is three's legacy Lambert/Blinn-Phong with the pen's lights: ambient 1,
// spot 0.52 at (14,24,30), directional 0.2 from below. Only the spot casts shadows.
const FRAG = `#version 300 es
precision highp float;
in vec3 vPos;
flat in vec4 vSphere;
flat in float vPaper;
flat in ivec4 vNa, vNb;
uniform mat4 uVP;
uniform vec3 uEye;
uniform vec4 uAll[${N}];
out vec4 outColor;
const vec3 SPOT = vec3(14.0, 24.0, 30.0);
const vec3 UNDER = vec3(0.0, -1.0, 0.0);
float shadow(vec3 p, vec3 l) {
  float s = 1.0;
  for (int k = 0; k < 8; k++) {
    int i = k < 4 ? vNa[k] : vNb[k - 4];
    vec3 oc = p - uAll[i].xyz;
    float b = dot(oc, l);
    if (b > 0.0) continue;
    float r = uAll[i].w;
    float h = b * b - dot(oc, oc) + r * r;
    float d = sqrt(max(0.0, r * r - h)) - r;
    s = min(s, smoothstep(0.0, 1.0, 6.0 * d / -b));
  }
  return s;
}
float occlusion(vec3 p, vec3 n) {
  float o = 0.0;
  for (int k = 0; k < 8; k++) {
    int i = k < 4 ? vNa[k] : vNb[k - 4];
    vec3 d = uAll[i].xyz - p;
    float l2 = dot(d, d);
    float r = uAll[i].w;
    o += max(dot(n, d) * inversesqrt(l2), 0.0) * r * r / l2;
  }
  return clamp(o, 0.0, 1.0);
}
vec3 spec(vec3 n, vec3 v, vec3 l, vec3 s) {
  vec3 h = normalize(l + v);
  vec3 f = s + (1.0 - s) * pow(1.0 - max(dot(v, h), 0.0), 5.0);
  return f * 2.5 * pow(max(dot(n, h), 0.0), 18.0);
}
void main() {
  vec3 rd = normalize(vPos - uEye);
  vec3 c = vSphere.xyz - uEye;
  float r = vSphere.w;
  float b = dot(c, rd);
  vec3 q = c - rd * b;
  float h = r * r - dot(q, q);
  float a = clamp(h / fwidth(h) + 0.5, 0.0, 1.0);
  if (a <= 0.0) discard;
  vec3 p = uEye + rd * (b - sqrt(max(h, 0.0)));
  vec3 n = normalize(p - vSphere.xyz);
  vec3 v = -rd;
  vec3 ls = normalize(SPOT - p);
  float ns = max(dot(n, ls), 0.0) * 0.52 * shadow(p, ls);
  float nu = max(dot(n, UNDER), 0.0) * 0.2;
  float amb = 1.0 - 0.55 * occlusion(p, n);
  vec3 col;
  if (vPaper > 0.5) {
    col = vec3(0.722, 0.698, 0.659) * (amb + ns + nu) + vec3(0.055, 0.039, 0.024);
  } else {
    vec3 s = vec3(0.227, 0.204, 0.204);
    col = vec3(0.133, 0.11, 0.11) * (amb + ns + nu) + ns * spec(n, v, ls, s) + nu * spec(n, v, UNDER, s);
  }
  vec4 clip = uVP * vec4(p, 1.0);
  gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
  outColor = vec4(col * a, a);
}`;

const easeOut = (p: number) => 1 - (1 - p) * (1 - p);

/** Where sphere i is `s` seconds into the intro: up and round, down, then home (the pen's timeline). */
export function introPosition(i: number, s: number, out: number[]): void {
  const ox = POSITIONS[i * 3], oy = POSITIONS[i * 3 + 1], oz = POSITIONS[i * 3 + 2];
  const t = s - i * 0.02;
  out[0] = ox;
  if (t <= 0) {
    out[1] = INIT_Y;
    out[2] = oz;
  } else if (t < 1) {
    out[1] = INIT_Y + (REVOLUTION_RADIUS - INIT_Y) * easeOut(t);
    out[2] = oz + Math.sin(t * Math.PI) * REVOLUTION_RADIUS;
  } else if (t < 2) {
    out[1] = REVOLUTION_RADIUS + (INIT_Y / 5 - REVOLUTION_RADIUS) * easeOut(t - 1);
    out[2] = oz - Math.sin((t - 1) * Math.PI) * REVOLUTION_RADIUS;
  } else if (t < 2.6) {
    const e = easeOut((t - 2) / 0.6);
    out[1] = INIT_Y / 5 + (oy - INIT_Y / 5) * e;
    out[2] = oz;
  } else {
    out[1] = oy;
    out[2] = oz;
  }
}

/** Nearest sphere hit by the ray o + t*d (d unit), or -1. Writes the hit point into `hit`. */
export function pick(pos: Float32Array, o: number[], d: number[], hit: number[]): number {
  let best = -1;
  let bestT = Infinity;
  for (let i = 0; i < N; i++) {
    const cx = pos[i * 3] - o[0], cy = pos[i * 3 + 1] - o[1], cz = pos[i * 3 + 2] - o[2];
    const b = cx * d[0] + cy * d[1] + cz * d[2];
    const h = RADII[i] * RADII[i] - (cx * cx + cy * cy + cz * cz - b * b);
    if (h < 0) continue;
    const t = b - Math.sqrt(h);
    if (t > 0 && t < bestT) {
      bestT = t;
      best = i;
    }
  }
  if (best >= 0) for (let k = 0; k < 3; k++) hit[k] = o[k] + d[k] * bestT;
  return best;
}

const gaps = new Float32Array(8);
/**
 * Writes the 8 spheres whose surfaces are closest to sphere i's into out[at..at+8]: the only
 * ones the shader lets shade it. ponytail: contact shadows only; a far caster's spot shadow
 * is dropped (the cluster packs tightly, so it barely shows); loop all spheres again on a GPU budget.
 */
export function nearest(pos: Float32Array, i: number, out: Float32Array, at: number): void {
  gaps.fill(Infinity);
  for (let j = 0; j < N; j++) {
    if (j === i) continue;
    const gap = Math.hypot(pos[j * 3] - pos[i * 3], pos[j * 3 + 1] - pos[i * 3 + 1], pos[j * 3 + 2] - pos[i * 3 + 2]) - RADII[j];
    if (gap >= gaps[7]) continue;
    let k = 7;
    for (; k > 0 && gaps[k - 1] > gap; k--) {
      gaps[k] = gaps[k - 1];
      out[at + k] = out[at + k - 1];
    }
    gaps[k] = gap;
    out[at + k] = j;
  }
}

function compile(gl: WebGL2RenderingContext): WebGLProgram | null {
  const program = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

/** Same cluster, same door as Spheres.tsx; about 4 KB gzipped instead of three + gsap. */
export function SpheresLite() {
  const hostRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);
  const followRef = useRef<HTMLDivElement>(null);
  const leavingRef = useRef(false);

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      leavingRef.current = false;
      const flash = flashRef.current;
      if (flash) {
        flash.style.transition = "none";
        flash.style.opacity = "0";
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    const host = hostRef.current!;
    const root = host.parentElement!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: true, premultipliedAlpha: true });
    const program = gl && compile(gl);
    if (!gl || !program) return; // no WebGL2: the red room stays, the hero still reads
    canvas.style.display = "block";
    canvas.style.width = canvas.style.height = "100%";
    canvas.style.touchAction = "pan-y"; // vertical swipes scroll the page, sideways ones orbit
    host.appendChild(canvas);

    gl.useProgram(program);
    const u = (name: string) => gl.getUniformLocation(program, name);
    const uVP = u("uVP"), uRight = u("uRight"), uUp = u("uUp"), uShift = u("uShift"), uEye = u("uEye"), uAll = u("uAll");
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const STRIDE = 13; // sphere xyzr, paper, 8 neighbour indices
    const instances = new Float32Array(N * STRIDE);
    const instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, instances.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, STRIDE * 4, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, STRIDE * 4, 16);
    gl.vertexAttribDivisor(2, 1);
    for (const loc of [3, 4]) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, STRIDE * 4, (5 + (loc - 3) * 4) * 4);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied edge coverage, drawn back to front
    gl.clearColor(0, 0, 0, 0);

    // World state: positions (xyz), and every sphere packed for the shader (xyz + radius).
    const pos = new Float32Array(N * 3);
    const all = new Float32Array(N * 4);
    const forces = new Float32Array(N * 3);
    const tmp = [0, 0, 0];
    for (let i = 0; i < N; i++) {
      introPosition(i, reduced ? 99 : 0, tmp);
      pos.set(tmp, i * 3);
    }
    const order = Array.from({ length: N }, (_, i) => i);
    const depth = new Float32Array(N);

    // Camera: OrbitControls' spherical orbit round the origin, damped.
    let theta = 0, phi = Math.PI / 2, dTheta = 0, dPhi = 0;
    let radius = CAMERA_Z, aspect = 1, shift = 0;
    const eye = [0, 0, CAMERA_Z], right = [1, 0, 0], up = [0, 1, 0], fwd = [0, 0, -1];
    const vp = new Float32Array(16);
    const updateCamera = () => {
      theta += reduced ? dTheta : dTheta * DAMPING;
      phi = Math.min(Math.PI - 0.01, Math.max(0.01, phi + (reduced ? dPhi : dPhi * DAMPING)));
      if (reduced) dTheta = dPhi = 0;
      else {
        dTheta *= 1 - DAMPING;
        dPhi *= 1 - DAMPING;
      }
      const sp = Math.sin(phi);
      eye[0] = radius * sp * Math.sin(theta);
      eye[1] = radius * Math.cos(phi);
      eye[2] = radius * sp * Math.cos(theta);
      for (let k = 0; k < 3; k++) fwd[k] = -eye[k] / radius;
      right[0] = -fwd[2]; right[1] = 0; right[2] = fwd[0]; // fwd x (0,1,0)
      const rl = Math.hypot(right[0], right[2]);
      right[0] /= rl; right[2] /= rl;
      up[0] = right[1] * fwd[2] - right[2] * fwd[1];
      up[1] = right[2] * fwd[0] - right[0] * fwd[2];
      up[2] = right[0] * fwd[1] - right[1] * fwd[0];
      // projection * view, column-major
      const f = 1 / Math.tan(FOV / 2), near = 0.1, far = 1000;
      const zA = (far + near) / (near - far), zB = (2 * far * near) / (near - far);
      const tx = -(right[0] * eye[0] + right[1] * eye[1] + right[2] * eye[2]);
      const ty = -(up[0] * eye[0] + up[1] * eye[1] + up[2] * eye[2]);
      const tz = fwd[0] * eye[0] + fwd[1] * eye[1] + fwd[2] * eye[2];
      for (let c = 0; c < 3; c++) {
        vp[c * 4] = (f / aspect) * right[c];
        vp[c * 4 + 1] = f * up[c];
        vp[c * 4 + 2] = -zA * fwd[c];
        vp[c * 4 + 3] = fwd[c];
      }
      vp[12] = (f / aspect) * tx;
      vp[13] = f * ty;
      vp[14] = zA * tz + zB;
      vp[15] = -tz;
    };

    const dpr = Math.min(window.devicePixelRatio, window.innerWidth < 768 ? 1.5 : 2);
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      aspect = w / h;
      // Same framing as Spheres.tsx: fit the cluster's width, lift it above the title band.
      const tall = aspect < 1;
      radius = tall ? Math.max(CAMERA_Z, CLUSTER_HALF_WIDTH / (Math.tan(FOV / 2) * aspect) + 2.5) : WIDE_CAMERA_Z;
      shift = 2 * (tall ? 0.12 : 0.08);
    };
    resize();
    const sizer = new ResizeObserver(resize);
    sizer.observe(host);

    // Pointer: hover force, cursor circle + follower (mouse only), drag orbit, the door.
    const circle = circleRef.current!;
    const follow = followRef.current!;
    const cursor = { x: 0, y: 0, cx: 0, cy: 0, fx: 0, fy: 0, shown: false };
    const showCursor = (on: boolean) => {
      for (const el of [circle, follow]) {
        el.style.transition = "opacity 0.2s";
        el.style.visibility = "visible";
        el.style.opacity = on ? "1" : "0";
      }
    };
    const tap = createTapCounter(5, 3000);
    let down: { x: number; y: number; t: number; id: number; lx: number; ly: number } | null = null;
    let leaving = 0;
    let loadingComplete = reduced;
    const started = performance.now();
    const hit = [0, 0, 0];
    const ray = [0, 0, 0];

    const aim = (e: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      const x = ((e.clientX - box.left) / box.width) * 2 - 1;
      const y = -((e.clientY - box.top) / box.height) * 2 + 1 - shift;
      const th = Math.tan(FOV / 2);
      for (let k = 0; k < 3; k++) ray[k] = fwd[k] + right[k] * x * th * aspect + up[k] * y * th;
      const l = Math.hypot(ray[0], ray[1], ray[2]);
      for (let k = 0; k < 3; k++) ray[k] /= l;
      return pick(pos, eye, ray, hit);
    };
    const onMove = (e: PointerEvent) => {
      if (down && down.id === e.pointerId) {
        // OrbitControls: a full canvas height of drag is one turn.
        const h = canvas.clientHeight || 1;
        // Deltas from clientX/Y: movementX/Y is 0 or missing for touch on some mobile browsers.
        dTheta -= (2 * Math.PI * (e.clientX - down.lx)) / h;
        dPhi -= (2 * Math.PI * (e.clientY - down.ly)) / h;
        down.lx = e.clientX;
        down.ly = e.clientY;
      }
      if (!loadingComplete) return;
      if (e.pointerType === "mouse") {
        const box = canvas.getBoundingClientRect();
        cursor.x = e.clientX - box.left;
        cursor.y = e.clientY - box.top;
        if (!cursor.shown || reduced) {
          cursor.cx = cursor.fx = cursor.x;
          cursor.cy = cursor.fy = cursor.y;
        }
        if (!cursor.shown) showCursor((cursor.shown = true));
        root.classList.add("pointer-fine:cursor-none");
      }
      if (reduced) return;
      const i = aim(e);
      if (i < 0) return;
      const dx = hit[0] - pos[i * 3], dy = hit[1] - pos[i * 3 + 1], dz = hit[2] - pos[i * 3 + 2];
      const l = Math.hypot(dx, dy, dz) || 1;
      forces[i * 3] = (dx / l) * 0.2;
      forces[i * 3 + 1] = (dy / l) * 0.2;
      forces[i * 3 + 2] = (dz / l) * 0.2;
    };
    const onLeave = () => {
      if (cursor.shown) showCursor((cursor.shown = false));
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, lx: e.clientX, ly: e.clientY };
      canvas.setPointerCapture?.(e.pointerId);
    };
    const onCancel = () => (down = null);
    const onUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      if (!d || e.button !== 0 || leavingRef.current) return;
      const now = performance.now();
      if (!isTap(e.clientX - d.x, e.clientY - d.y, now - d.t)) return;
      // Only the nearest sphere counts: a tap on one in front of the centre is not a door tap.
      if (aim(e) !== 0 || !tap(now)) return;
      leavingRef.current = true;
      const flash = flashRef.current!;
      flash.style.transition = reduced ? "none" : "opacity 0.6s ease-in";
      flash.style.opacity = "1";
      // A real document navigation, not router.push(): the backend gates /admin and answers
      // a session-less route-data fetch with a redirect the client router cannot follow.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- see above
      leaving = window.setTimeout(() => window.location.assign("/admin"), reduced ? 0 : 850);
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);

    let visible = true;
    const seen = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    seen.observe(host);

    const handleCollisions = () => {
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          let x = pos[j * 3] - pos[i * 3], y = pos[j * 3 + 1] - pos[i * 3 + 1], z = pos[j * 3 + 2] - pos[i * 3 + 2];
          const distance = Math.hypot(x, y, z);
          const minDistance = (RADII[i] + RADII[j]) * 1.2;
          if (distance >= minDistance) continue;
          const push = (minDistance - distance) * 0.4;
          const s = push / (distance || 1);
          x *= s; y *= s; z *= s;
          pos[i * 3] -= x; pos[i * 3 + 1] -= y; pos[i * 3 + 2] -= z;
          // Same arithmetic as the pen: the second push compounds onto the first.
          pos[j * 3] += x * push; pos[j * 3 + 1] += y * push; pos[j * 3 + 2] += z * push;
        }
      }
    };

    const step = (now: number) => {
      if (!loadingComplete) {
        const s = (now - started) / 1000;
        for (let i = 0; i < N; i++) {
          introPosition(i, s, tmp);
          pos.set(tmp, i * 3);
        }
        if (s >= 3) loadingComplete = true;
        return;
      }
      const time = reduced ? 0 : Date.now() * BREATHING_SPEED;
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        const fx = forces[k], fy = forces[k + 1], fz = forces[k + 2];
        if (fx || fy || fz) {
          pos[k] += fx; pos[k + 1] += fy; pos[k + 2] += fz;
          const done = Math.hypot(fx, fy, fz) * 0.95 < 0.01;
          forces[k] = done ? 0 : fx * 0.95;
          forces[k + 1] = done ? 0 : fy * 0.95;
          forces[k + 2] = done ? 0 : fz * 0.95;
        }
        const offset = i * 0.2;
        const tx = POSITIONS[k];
        const ty = POSITIONS[k + 1] + (reduced ? 0 : Math.sin(time + offset) * BREATHING_AMPLITUDE);
        const tz = POSITIONS[k + 2] + (reduced ? 0 : Math.cos(time + offset) * BREATHING_AMPLITUDE * 0.5);
        pos[k] += (tx - pos[k]) * 0.018;
        pos[k + 1] += (ty - pos[k + 1]) * 0.018;
        pos[k + 2] += (tz - pos[k + 2]) * 0.018;
      }
      handleCollisions();
    };

    let frame = 0;
    let last = performance.now();
    const animate = (now: number) => {
      frame = requestAnimationFrame(animate);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!visible) return;
      step(now);
      updateCamera();
      if (cursor.shown) {
        // gsap.quickTo(0.6s, power3) stand-in: exponential approach.
        const k = 1 - Math.exp(-dt * 7);
        cursor.cx += (cursor.x - cursor.cx) * k;
        cursor.cy += (cursor.y - cursor.cy) * k;
        cursor.fx += (cursor.x - cursor.fx) * k;
        cursor.fy += (cursor.y - cursor.fy) * k;
        circle.style.transform = `translate(${cursor.cx}px,${cursor.cy}px) translate(-50%,-50%)`;
        follow.style.transform = `translate(${cursor.fx}px,${cursor.fy}px) translate(-50%,-50%)`;
      }
      // Back to front, so each sphere's anti-aliased edge blends over what is behind it.
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        depth[i] = (pos[k] - eye[0]) * fwd[0] + (pos[k + 1] - eye[1]) * fwd[1] + (pos[k + 2] - eye[2]) * fwd[2];
        all[i * 4] = pos[k];
        all[i * 4 + 1] = pos[k + 1];
        all[i * 4 + 2] = pos[k + 2];
        all[i * 4 + 3] = RADII[i];
      }
      order.sort((a, b) => depth[b] - depth[a]);
      order.forEach((i, n) => {
        instances.set(all.subarray(i * 4, i * 4 + 4), n * STRIDE);
        instances[n * STRIDE + 4] = i % 3 === 2 ? 1 : 0;
        nearest(pos, i, instances, n * STRIDE + 5);
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, instances);
      gl.uniformMatrix4fv(uVP, false, vp);
      gl.uniform3fv(uRight, right);
      gl.uniform3fv(uUp, up);
      gl.uniform3fv(uEye, eye);
      gl.uniform1f(uShift, shift);
      gl.uniform4fv(uAll, all);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, N);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(leaving);
      root.classList.remove("pointer-fine:cursor-none");
      sizer.disconnect();
      seen.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, []);

  return (
    <div data-testid="spheres" className="absolute inset-0" style={{ background: ROOM }}>
      <div ref={hostRef} className="absolute inset-0" />
      <div
        ref={circleRef}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 z-30 h-2.5 w-2.5 rounded-full bg-paper opacity-0 mix-blend-difference"
      />
      <div
        ref={followRef}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 z-30 h-10 w-10 rounded-full border border-paper opacity-0 mix-blend-difference"
      />
      <div ref={flashRef} className="pointer-events-none absolute inset-0 z-40 bg-ink opacity-0" />
    </div>
  );
}
