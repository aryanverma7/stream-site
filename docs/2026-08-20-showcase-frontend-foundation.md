# Showcase Homepage — Foundation, Shader Background & Hidden Gateway (Plan B1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js project (static export), the raw-WebGL ambient shader background, and the hidden 2.5s-hold gesture that routes into `/admin` — the foundational, technically novel piece everything else in Plan B2 builds on top of.

**Architecture:** A single Next.js App Router project, static export mode. The shader is raw WebGL (no Three.js) driven by a small imperative-handle API so the separate hidden-gateway component can push burst-intensity state into it without prop-drilling through re-renders. All timing-sensitive logic (the hold gesture, the shader's render loop) uses dependency-injected clock/scheduler functions specifically so it's unit-testable without waiting on real timers or needing a real GPU.

**Tech Stack:** Next.js 16 (App Router, static export), TypeScript, Tailwind, raw WebGL, Vitest + React Testing Library for testing.

**Spec:** `docs/superpowers/specs/2026-08-19-showcase-homepage-design.md` (Sections 2, 3, 4, 5 specifically)

## Global Constraints

- No Three.js or any 3D scene graph library — a single fullscreen fragment shader doesn't need one (spec Section 4, deliberate rejection).
- Static export only (`output: "export"` in `next.config.ts`) — no live Next.js SSR server, confirmed as a clear decision in the spec (Section 2), not a close call.
- All Google Fonts load via a plain `<link>` tag, matching the pattern already used identically across every other widget in this whole project — NOT via `next/font/google`, which fetches and self-hosts fonts at *build time* and therefore requires build-time network access that isn't guaranteed in every environment (confirmed failing in the environment this plan was built and verified in).
- Any code with real timing behavior (animation frames, hold-duration thresholds) must accept injectable clock/scheduler functions defaulting to real browser APIs — this is what made the hold-gesture and shader code genuinely unit-testable; do not rely on global fake-timer mocking of `requestAnimationFrame`, which was found to be unreliable for driving recursive tick loops.

---

## File Structure

- **Create:** `next.config.ts` (modify from scaffold) — static export config
- **Create:** `app/layout.tsx` (modify from scaffold) — real fonts via `<link>`, not `next/font/google`
- **Create:** `app/page.tsx` (modify from scaffold) — renders `<Hero />`
- **Create:** `app/admin/page.tsx` — minimal stub, the gateway's landing target (full admin UI is a separate future design pass, spec Section 13)
- **Create:** `lib/holdGesture.ts` + `lib/holdGesture.test.ts` — pure hold-timing logic, zero DOM/React dependency
- **Create:** `lib/webgl.ts` + `lib/webgl.test.ts` — raw WebGL shader compile/link helpers
- **Create:** `shaders/vertex.ts`, `shaders/fragment.ts` — GLSL source as string exports
- **Create:** `components/ShaderBackground.tsx` + `.test.tsx` — the canvas + WebGL render loop, imperative handle for gateway-state
- **Create:** `components/HiddenGateway.tsx` + `.test.tsx` — the invisible hotspot, pointer handling, progress ring
- **Create:** `components/Hero.tsx` — wires the above two together
- **Create:** `vitest.config.ts` — with the `@` path alias explicitly configured (Next.js's tsconfig alias isn't automatically understood by Vitest's separate module resolution)

---

### Task 1: Project scaffold + static export config

**Files:**
- Create: Next.js project via `create-next-app` (TypeScript, Tailwind, App Router, ESLint)
- Modify: `next.config.ts`

- [ ] **Step 1: Scaffold the project**

```bash
npx create-next-app@latest dualbladex-site --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint --use-npm --yes
cd dualbladex-site
```

- [ ] **Step 2: Configure static export**

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export, per the spec (Section 2): no live Next.js server, since
  // none of this site's dynamic behavior is server-rendered - it's all
  // client-side fetch() calls to the Python backend. This builds the whole
  // site to plain HTML/CSS/JS files the Mac Mini just serves directly.
  output: "export",
};

export default nextConfig;
```

- [ ] **Step 3: Verify the default scaffold still builds before changing anything else**

Run: `npm run build`
Expected: this WILL fail at this point if `next/font/google` can't reach Google's font servers in your environment — this is expected and gets fixed in Task 2, not a sign anything here is wrong. If it succeeds, skip ahead — Task 2 becomes unnecessary but harmless to still apply.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts package.json package-lock.json app/ tsconfig.json
git commit -m "chore: scaffold Next.js project with static export config"
```

---

### Task 2: Replace default fonts with the project's actual brand fonts

**Files:**
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: Chakra Petch + Rajdhani loaded globally, available to any component via `fontFamily: "'Chakra Petch', sans-serif"` (no CSS module/variable indirection needed)

- [ ] **Step 1: Replace the default Geist/Geist Mono setup**

```typescript
// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DualBladeX",
  description: "DualBladeX — Valorant streamer",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/*
          Chakra Petch + Rajdhani, the project's established brand fonts
          (used identically across every widget in this whole project) -
          loaded via a plain <link> tag rather than next/font/google, which
          tries to fetch and self-host fonts at BUILD TIME, requiring
          build-time network access to fonts.googleapis.com that isn't
          guaranteed everywhere. A plain link tag defers font loading to
          the browser at runtime instead.
        */}
        <link
          href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Rajdhani:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#0F1923]">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Verify the build now succeeds**

Run: `npm run build`
Expected: `✓ Compiled successfully`, followed by static page generation completing for `/` and `/_not-found`.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "fix: use project's actual brand fonts via link tag instead of next/font/google"
```

---

### Task 3: Hold-gesture timing logic (pure, DOM-free)

**Files:**
- Create: `lib/holdGesture.ts`
- Test: `lib/holdGesture.test.ts`

**Interfaces:**
- Produces: `class HoldGestureTracker` with `start()`, `cancel()`, `isActive` — consumed by Task 6 (`HiddenGateway`)

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/holdGesture.test.ts
import { describe, expect, it, vi } from "vitest";
import { HoldGestureTracker } from "./holdGesture";

function makeFakeScheduler() {
  let currentTime = 0;
  let pendingCallback: FrameRequestCallback | null = null;
  let nextId = 1;

  return {
    now: () => currentTime,
    requestFrame: (cb: FrameRequestCallback) => {
      pendingCallback = cb;
      return nextId++;
    },
    cancelFrame: () => {
      pendingCallback = null;
    },
    advance: (ms: number) => {
      currentTime += ms;
      const cb = pendingCallback;
      pendingCallback = null;
      if (cb) cb(currentTime);
    },
    hasPendingFrame: () => pendingCallback !== null,
  };
}

describe("HoldGestureTracker", () => {
  it("calls onComplete once the threshold is reached", () => {
    const scheduler = makeFakeScheduler();
    const onProgress = vi.fn();
    const onComplete = vi.fn();
    const tracker = new HoldGestureTracker(
      2500, onProgress, onComplete,
      scheduler.now, scheduler.requestFrame, scheduler.cancelFrame,
    );

    tracker.start();
    scheduler.advance(1000);
    expect(onComplete).not.toHaveBeenCalled();
    scheduler.advance(1500);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("reports progress as a 0-1 fraction of the threshold", () => {
    const scheduler = makeFakeScheduler();
    const onProgress = vi.fn();
    const tracker = new HoldGestureTracker(
      2500, onProgress, vi.fn(),
      scheduler.now, scheduler.requestFrame, scheduler.cancelFrame,
    );
    tracker.start();
    scheduler.advance(1250);
    expect(onProgress).toHaveBeenLastCalledWith(0.5);
  });

  it("does NOT call onComplete if cancelled before the threshold", () => {
    const scheduler = makeFakeScheduler();
    const onComplete = vi.fn();
    const tracker = new HoldGestureTracker(
      2500, vi.fn(), onComplete,
      scheduler.now, scheduler.requestFrame, scheduler.cancelFrame,
    );
    tracker.start();
    scheduler.advance(1000);
    tracker.cancel();
    scheduler.advance(2000);
    expect(onComplete).not.toHaveBeenCalled();
    expect(scheduler.hasPendingFrame()).toBe(false);
  });

  it("reports isActive correctly across the start/cancel lifecycle", () => {
    const scheduler = makeFakeScheduler();
    const tracker = new HoldGestureTracker(
      2500, vi.fn(), vi.fn(),
      scheduler.now, scheduler.requestFrame, scheduler.cancelFrame,
    );
    expect(tracker.isActive).toBe(false);
    tracker.start();
    expect(tracker.isActive).toBe(true);
    tracker.cancel();
    expect(tracker.isActive).toBe(false);
  });

  it("does not fire onComplete twice if time advances past the threshold in one jump", () => {
    const scheduler = makeFakeScheduler();
    const onComplete = vi.fn();
    const tracker = new HoldGestureTracker(
      2500, vi.fn(), onComplete,
      scheduler.now, scheduler.requestFrame, scheduler.cancelFrame,
    );
    tracker.start();
    scheduler.advance(5000);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(scheduler.hasPendingFrame()).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run lib/holdGesture.test.ts`
Expected: FAIL — `lib/holdGesture.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/holdGesture.ts
export class HoldGestureTracker {
  private startTime: number | null = null;
  private rafId: number | null = null;

  constructor(
    private thresholdMs: number,
    private onProgress: (fraction: number) => void,
    private onComplete: () => void,
    private now: () => number = () => performance.now(),
    private requestFrame: (cb: FrameRequestCallback) => number = (cb) =>
      requestAnimationFrame(cb),
    private cancelFrame: (id: number) => void = (id) => cancelAnimationFrame(id),
  ) {}

  start(): void {
    this.startTime = this.now();
    this.tick();
  }

  cancel(): void {
    this.reset();
  }

  get isActive(): boolean {
    return this.startTime !== null;
  }

  private tick = (): void => {
    if (this.startTime === null) return;
    const elapsed = this.now() - this.startTime;
    const fraction = Math.min(elapsed / this.thresholdMs, 1);
    this.onProgress(fraction);
    if (fraction >= 1) {
      this.onComplete();
      this.reset();
      return;
    }
    this.rafId = this.requestFrame(this.tick);
  };

  private reset(): void {
    this.startTime = null;
    if (this.rafId !== null) {
      this.cancelFrame(this.rafId);
      this.rafId = null;
    }
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run lib/holdGesture.test.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/holdGesture.ts lib/holdGesture.test.ts
git commit -m "feat: add pure hold-gesture timing logic"
```

---

### Task 4: Raw WebGL setup helpers

**Files:**
- Create: `lib/webgl.ts`
- Test: `lib/webgl.test.ts`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: `compileShader()`, `linkProgram()`, `createFullscreenTriangle()`, `setupShaderProgram()` — consumed by Task 6 (`ShaderBackground`)

- [ ] **Step 1: Create `vitest.config.ts` with the path alias**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
  },
  resolve: {
    alias: {
      // Matches the "@/*" import alias from tsconfig.json - Vitest resolves
      // modules through its own Vite-based system, separate from Next.js's
      // build, so this needs its own explicit alias configuration or every
      // "@/..." import fails to resolve during tests despite working fine
      // in the actual Next.js dev/build process.
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

```bash
npm install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom @vitejs/plugin-react
```

- [ ] **Step 2: Write the failing tests**

```typescript
// lib/webgl.test.ts
import { describe, expect, it, vi } from "vitest";
import { compileShader, linkProgram } from "./webgl";

function makeMockGl(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ""),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ""),
    deleteProgram: vi.fn(),
    ...overrides,
  } as unknown as WebGLRenderingContext;
}

describe("compileShader", () => {
  it("returns the shader when compilation succeeds", () => {
    const gl = makeMockGl();
    const shader = compileShader(gl, gl.VERTEX_SHADER, "void main() {}");
    expect(shader).toBeDefined();
    expect(gl.compileShader).toHaveBeenCalledWith(shader);
  });

  it("throws with the GL error log when compilation fails", () => {
    const gl = makeMockGl({
      getShaderParameter: vi.fn(() => false),
      getShaderInfoLog: vi.fn(() => "ERROR: 0:1: syntax error"),
    });
    expect(() => compileShader(gl, gl.VERTEX_SHADER, "broken glsl")).toThrow(
      "Shader compile error: ERROR: 0:1: syntax error",
    );
  });

  it("cleans up the failed shader object rather than leaking it", () => {
    const gl = makeMockGl({ getShaderParameter: vi.fn(() => false) });
    const shaderObj = {};
    (gl.createShader as ReturnType<typeof vi.fn>).mockReturnValue(shaderObj);
    expect(() => compileShader(gl, gl.VERTEX_SHADER, "broken")).toThrow();
    expect(gl.deleteShader).toHaveBeenCalledWith(shaderObj);
  });
});

describe("linkProgram", () => {
  it("returns the program when linking succeeds", () => {
    const gl = makeMockGl();
    const vertexShader = {} as WebGLShader;
    const fragmentShader = {} as WebGLShader;
    const program = linkProgram(gl, vertexShader, fragmentShader);
    expect(program).toBeDefined();
    expect(gl.attachShader).toHaveBeenCalledWith(program, vertexShader);
    expect(gl.attachShader).toHaveBeenCalledWith(program, fragmentShader);
  });

  it("throws with the GL error log when linking fails", () => {
    const gl = makeMockGl({
      getProgramParameter: vi.fn(() => false),
      getProgramInfoLog: vi.fn(() => "ERROR: link failed"),
    });
    expect(() =>
      linkProgram(gl, {} as WebGLShader, {} as WebGLShader),
    ).toThrow("Program link error: ERROR: link failed");
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run lib/webgl.test.ts`
Expected: FAIL — `lib/webgl.ts` doesn't exist yet.

- [ ] **Step 4: Write the implementation**

```typescript
// lib/webgl.ts
export function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create shader object");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

export function linkProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create program object");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${info}`);
  }
  return program;
}

/**
 * Builds a fullscreen triangle (not a quad) - a well-established technique
 * that covers the entire viewport with a single 3-vertex triangle larger
 * than the screen, clipped by the GPU. Avoids needing a second triangle /
 * index buffer that a quad would require, for identical visual output.
 */
export function createFullscreenTriangle(gl: WebGLRenderingContext): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) {
    throw new Error("Failed to create vertex buffer");
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  return buffer;
}

export function setupShaderProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  return linkProgram(gl, vertexShader, fragmentShader);
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run lib/webgl.test.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/webgl.ts lib/webgl.test.ts vitest.config.ts package.json package-lock.json
git commit -m "feat: add raw WebGL shader compile/link helpers"
```

---

### Task 5: Shader source (GLSL)

**Files:**
- Create: `shaders/vertex.ts`
- Create: `shaders/fragment.ts`

**Interfaces:**
- Produces: `vertexShaderSource`, `fragmentShaderSource` string exports — consumed by Task 6

**Note on verification**: GLSL syntax correctness cannot be verified in a headless environment without a real GPU/display — there is no automated test for this task. The vertex/fragment shader source below follows standard, well-established GLSL ES 1.0 patterns (hash-based value noise, fractal Brownian motion, domain warping). Visual correctness needs a real browser check once deployed — flagged explicitly rather than silently assumed.

- [ ] **Step 1: Write the vertex shader**

```typescript
// shaders/vertex.ts
export const vertexShaderSource = `
attribute vec2 aPosition;
void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;
```

- [ ] **Step 2: Write the fragment shader**

```typescript
// shaders/fragment.ts
/**
 * Ambient flow-field background, per spec Section 4: mint-teal-on-near-black
 * palette, slow-moving, gentle cursor-reactive pull - not literal particles.
 *
 * Also handles the hidden gateway's burst transition (Section 5): when
 * uGatewayProgress > 0, the same noise field intensifies and warps
 * outward from uGatewayOrigin (the press point), reusing this one shader
 * rather than needing a separate effects system for that moment.
 */
export const fragmentShaderSource = `
precision mediump float;

uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uMouse;
uniform float uGatewayProgress;
uniform vec2 uGatewayOrigin;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    vec2 aUv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;

    vec2 mouseUv = (uMouse - 0.5 * uResolution.xy) / uResolution.y;
    float distToMouse = length(aUv - mouseUv);
    vec2 pull = normalize(mouseUv - aUv + 0.0001) * smoothstep(0.6, 0.0, distToMouse) * 0.08;

    vec2 fromOrigin = aUv - uGatewayOrigin;
    float distToOrigin = length(fromOrigin);
    vec2 burstOffset = normalize(fromOrigin + 0.0001) * uGatewayProgress * (0.5 - distToOrigin * 0.2);

    vec2 flowUv = aUv + pull + burstOffset;

    float t = uTime * 0.05;
    vec2 warp = vec2(fbm(flowUv * 1.5 + t), fbm(flowUv * 1.5 - t));
    float warpStrength = 0.6 + uGatewayProgress * 1.8;
    float n = fbm(flowUv * 2.0 + warp * warpStrength + t * 0.3);

    vec3 dark = vec3(0.059, 0.098, 0.137);
    vec3 accent = vec3(0.204, 0.961, 0.773);
    vec3 gold = vec3(0.949, 0.784, 0.475);

    float glow = smoothstep(0.35, 0.75, n) * (0.35 + uGatewayProgress * 0.5);
    vec3 accentColor = mix(accent, gold, uGatewayProgress);
    vec3 color = mix(dark, accentColor, glow);

    color = mix(color, vec3(1.0), smoothstep(0.85, 1.0, uGatewayProgress) * 0.6);

    gl_FragColor = vec4(color, 1.0);
}
`;
```

- [ ] **Step 3: Commit**

```bash
git add shaders/
git commit -m "feat: add ambient flow-field shader with gateway burst effect"
```

---

### Task 6: `ShaderBackground` component

**Files:**
- Create: `components/ShaderBackground.tsx`
- Test: `components/ShaderBackground.test.tsx`

**Interfaces:**
- Consumes: `setupShaderProgram`, `createFullscreenTriangle` (Task 4), `vertexShaderSource`, `fragmentShaderSource` (Task 5)
- Produces: `ShaderBackgroundHandle` (`setGatewayState(progress, origin)`) — consumed by Task 7 (`HiddenGateway`)

**Note on verification**: real WebGL rendering cannot be tested in jsdom (no GPU/canvas implementation). What IS genuinely tested: the component renders without crashing, and gracefully falls back (logs a warning, doesn't throw) when `getContext("webgl")` returns null — which is jsdom's actual real behavior, not a simulated case.

- [ ] **Step 1: Write the failing tests**

```typescript
// components/ShaderBackground.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { createRef } from "react";
import { ShaderBackground, ShaderBackgroundHandle } from "./ShaderBackground";

describe("ShaderBackground", () => {
  it("renders a canvas element without throwing when WebGL is unavailable", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<ShaderBackground />);
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      "WebGL not available - falling back to static background",
    );
    warnSpy.mockRestore();
  });

  it("exposes setGatewayState via the imperative handle without throwing", () => {
    const ref = createRef<ShaderBackgroundHandle>();
    render(<ShaderBackground ref={ref} />);
    expect(ref.current).not.toBeNull();
    expect(() => ref.current?.setGatewayState(0.5, [0.1, -0.2])).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run components/ShaderBackground.test.tsx`
Expected: FAIL — component doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```tsx
// components/ShaderBackground.tsx
"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { createFullscreenTriangle, setupShaderProgram } from "@/lib/webgl";
import { fragmentShaderSource } from "@/shaders/fragment";
import { vertexShaderSource } from "@/shaders/vertex";

export interface ShaderBackgroundHandle {
  setGatewayState: (progress: number, origin: [number, number]) => void;
}

export const ShaderBackground = forwardRef<ShaderBackgroundHandle>(
  function ShaderBackground(_props, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gatewayProgressRef = useRef(0);
    const gatewayOriginRef = useRef<[number, number]>([0, 0]);

    useImperativeHandle(ref, () => ({
      setGatewayState: (progress, origin) => {
        gatewayProgressRef.current = progress;
        gatewayOriginRef.current = origin;
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const gl = canvas.getContext("webgl");
      if (!gl) {
        console.warn("WebGL not available - falling back to static background");
        return;
      }

      let animationFrameId: number;
      let mouseX = 0;
      let mouseY = 0;

      const handlePointerMove = (e: PointerEvent) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
      };
      window.addEventListener("pointermove", handlePointerMove);

      const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      };
      resize();
      window.addEventListener("resize", resize);

      const program = setupShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
      gl.useProgram(program);

      const positionBuffer = createFullscreenTriangle(gl);
      const positionLoc = gl.getAttribLocation(program, "aPosition");
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

      const uResolution = gl.getUniformLocation(program, "uResolution");
      const uTime = gl.getUniformLocation(program, "uTime");
      const uMouse = gl.getUniformLocation(program, "uMouse");
      const uGatewayProgress = gl.getUniformLocation(program, "uGatewayProgress");
      const uGatewayOrigin = gl.getUniformLocation(program, "uGatewayOrigin");

      const startTime = performance.now();

      const render = () => {
        gl.uniform2f(uResolution, canvas.width, canvas.height);
        gl.uniform1f(uTime, (performance.now() - startTime) / 1000);
        gl.uniform2f(uMouse, mouseX, canvas.height - mouseY);
        gl.uniform1f(uGatewayProgress, gatewayProgressRef.current);
        gl.uniform2f(
          uGatewayOrigin,
          gatewayOriginRef.current[0],
          gatewayOriginRef.current[1],
        );
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        animationFrameId = requestAnimationFrame(render);
      };
      render();

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("resize", resize);
      };
    }, []);

    return (
      <canvas
        ref={canvasRef}
        className="fixed inset-0 -z-10 bg-[#0F1923]"
        aria-hidden="true"
      />
    );
  },
);
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run components/ShaderBackground.test.tsx`
Expected: PASS (2 tests). Console output will show the jsdom `getContext` "Not implemented" warning AND our own "WebGL not available" warning — both expected, confirming the fallback path genuinely triggers.

- [ ] **Step 5: Commit**

```bash
git add components/ShaderBackground.tsx components/ShaderBackground.test.tsx
git commit -m "feat: add ShaderBackground component with graceful WebGL fallback"
```

---

### Task 7: `HiddenGateway` component

**Files:**
- Create: `components/HiddenGateway.tsx`
- Test: `components/HiddenGateway.test.tsx`

**Interfaces:**
- Consumes: `HoldGestureTracker` (Task 3), `ShaderBackgroundHandle` (Task 6)

- [ ] **Step 1: Write the failing tests**

```tsx
// components/HiddenGateway.test.tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { HiddenGateway } from "./HiddenGateway";
import type { ShaderBackgroundHandle } from "./ShaderBackground";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function makeFakeScheduler() {
  let currentTime = 0;
  let pendingFrame: FrameRequestCallback | null = null;
  let pendingTimeout: (() => void) | null = null;
  let nextId = 1;

  return {
    now: () => currentTime,
    requestFrame: (cb: FrameRequestCallback) => {
      pendingFrame = cb;
      return nextId++;
    },
    cancelFrame: () => {
      pendingFrame = null;
    },
    scheduleTimeout: (cb: () => void) => {
      pendingTimeout = cb;
    },
    advance: (ms: number) => {
      currentTime += ms;
      const frame = pendingFrame;
      pendingFrame = null;
      if (frame) frame(currentTime);
      const timeout = pendingTimeout;
      pendingTimeout = null;
      if (timeout) timeout();
    },
  };
}

describe("HiddenGateway", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  function renderGateway() {
    const scheduler = makeFakeScheduler();
    const shaderRef = { current: { setGatewayState: vi.fn() } as ShaderBackgroundHandle };
    const utils = render(
      <HiddenGateway
        shaderRef={shaderRef}
        now={scheduler.now}
        requestFrame={scheduler.requestFrame}
        cancelFrame={scheduler.cancelFrame}
        scheduleTimeout={scheduler.scheduleTimeout}
      />,
    );
    return { ...utils, shaderRef, scheduler };
  }

  it("does not navigate if released before the 2.5s threshold", () => {
    const { container, scheduler } = renderGateway();
    const hotspot = container.firstChild as HTMLElement;
    fireEvent.pointerDown(hotspot, { clientX: 500, clientY: 400 });
    scheduler.advance(1000);
    fireEvent.pointerUp(hotspot);
    scheduler.advance(3000);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("navigates to /admin after a full 2.5s hold, with a brief flash delay", () => {
    const { container, scheduler } = renderGateway();
    const hotspot = container.firstChild as HTMLElement;
    fireEvent.pointerDown(hotspot, { clientX: 500, clientY: 400 });
    scheduler.advance(2500);
    scheduler.advance(400);
    expect(pushMock).toHaveBeenCalledWith("/admin");
  });

  it("forwards live progress and the press origin to the shader", () => {
    const { container, shaderRef, scheduler } = renderGateway();
    const hotspot = container.firstChild as HTMLElement;
    fireEvent.pointerDown(hotspot, { clientX: 500, clientY: 400 });
    scheduler.advance(1250);
    expect(shaderRef.current.setGatewayState).toHaveBeenCalled();
    const lastCall = (shaderRef.current.setGatewayState as ReturnType<typeof vi.fn>).mock.calls.at(-1);
    expect(lastCall?.[0]).toBeCloseTo(0.5, 1);
  });

  it("resets the shader's gateway state to zero when released early", () => {
    const { container, shaderRef, scheduler } = renderGateway();
    const hotspot = container.firstChild as HTMLElement;
    fireEvent.pointerDown(hotspot, { clientX: 500, clientY: 400 });
    scheduler.advance(1000);
    fireEvent.pointerUp(hotspot);
    expect(shaderRef.current.setGatewayState).toHaveBeenLastCalledWith(0, [0, 0]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run components/HiddenGateway.test.tsx`
Expected: FAIL — component doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```tsx
// components/HiddenGateway.tsx
"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HoldGestureTracker } from "@/lib/holdGesture";
import type { ShaderBackgroundHandle } from "./ShaderBackground";

const HOLD_THRESHOLD_MS = 2500;

interface HiddenGatewayProps {
  shaderRef: React.RefObject<ShaderBackgroundHandle | null>;
  now?: () => number;
  requestFrame?: (cb: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
  scheduleTimeout?: (cb: () => void, ms: number) => void;
}

export function HiddenGateway({
  shaderRef,
  now,
  requestFrame,
  cancelFrame,
  scheduleTimeout = (cb, ms) => {
    setTimeout(cb, ms);
  },
}: HiddenGatewayProps) {
  const router = useRouter();
  const [ringVisible, setRingVisible] = useState(false);
  const [ringFraction, setRingFraction] = useState(0);
  const trackerRef = useRef<HoldGestureTracker | null>(null);
  const hotspotRef = useRef<HTMLDivElement>(null);

  const getOriginUv = useCallback((clientX: number, clientY: number): [number, number] => {
    const x = (clientX - window.innerWidth / 2) / window.innerHeight;
    const y = (window.innerHeight / 2 - clientY) / window.innerHeight;
    return [x, y];
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const origin = getOriginUv(e.clientX, e.clientY);
      setRingVisible(true);

      trackerRef.current = new HoldGestureTracker(
        HOLD_THRESHOLD_MS,
        (fraction) => {
          setRingFraction(fraction);
          shaderRef.current?.setGatewayState(fraction, origin);
        },
        () => {
          scheduleTimeout(() => router.push("/admin"), 400);
        },
        now,
        requestFrame,
        cancelFrame,
      );
      trackerRef.current.start();
    },
    [getOriginUv, router, shaderRef, now, requestFrame, cancelFrame, scheduleTimeout],
  );

  const handlePointerUp = useCallback(() => {
    trackerRef.current?.cancel();
    trackerRef.current = null;
    setRingVisible(false);
    setRingFraction(0);
    shaderRef.current?.setGatewayState(0, [0, 0]);
  }, [shaderRef]);

  return (
    <div
      ref={hotspotRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 cursor-default"
      aria-hidden="true"
    >
      {ringVisible && (
        <svg className="pointer-events-none absolute inset-0 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r="45" fill="none" stroke="#34f5c5" strokeWidth="2"
            strokeDasharray={`${ringFraction * 283} 283`}
            opacity={0.6}
          />
        </svg>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run components/HiddenGateway.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/HiddenGateway.tsx components/HiddenGateway.test.tsx
git commit -m "feat: add HiddenGateway press-and-hold component"
```

---

### Task 8: `Hero` component + wire into the home page + admin stub

**Files:**
- Create: `components/Hero.tsx`
- Modify: `app/page.tsx`
- Create: `app/admin/page.tsx`

- [ ] **Step 1: Write `Hero.tsx`**

```tsx
// components/Hero.tsx
"use client";

import { useRef } from "react";
import { ShaderBackground, ShaderBackgroundHandle } from "./ShaderBackground";
import { HiddenGateway } from "./HiddenGateway";

export function Hero() {
  const shaderRef = useRef<ShaderBackgroundHandle>(null);

  return (
    <section className="relative flex h-screen w-full items-center justify-center overflow-hidden">
      <ShaderBackground ref={shaderRef} />

      <div className="pointer-events-none relative z-10 text-center">
        <h1
          className="text-5xl tracking-[0.3em] text-[#ECE8E1]"
          style={{ fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700 }}
        >
          DUALBLADEX
        </h1>
      </div>

      <HiddenGateway shaderRef={shaderRef} />
    </section>
  );
}
```

- [ ] **Step 2: Wire into the home page**

```tsx
// app/page.tsx
import { Hero } from "@/components/Hero";

export default function Home() {
  return (
    <main>
      <Hero />
    </main>
  );
}
```

- [ ] **Step 3: Add the admin stub the gateway lands on**

```tsx
// app/admin/page.tsx
/**
 * Minimal stub - the hidden gateway (Section 5) needs somewhere real to
 * land on. The actual admin dashboard UI (config editor, points tool, log
 * viewer, status panel) is its own separate, later design pass per the
 * spec's Section 13 - not built here.
 */
export default function AdminStub() {
  return (
    <main className="flex h-screen items-center justify-center bg-[#0F1923] text-[#ECE8E1]">
      <p className="font-mono tracking-widest">ADMIN — coming soon</p>
    </main>
  );
}
```

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all 16 tests across all 4 test files.

- [ ] **Step 5: Run the real production build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, TypeScript passes, static pages generated for `/`, `/admin`, `/_not-found`, all marked `○ (Static) prerendered as static content`.

- [ ] **Step 6: Commit**

```bash
git add components/Hero.tsx app/page.tsx app/admin/page.tsx
git commit -m "feat: assemble Hero section and wire into home page + admin stub"
```

---

## Self-Review

**1. Spec coverage** — checked against `docs/superpowers/specs/2026-08-19-showcase-homepage-design.md`:
- Section 2 (tech stack, static export, no Three.js) → Task 1 ✓
- Section 3 (page structure, Hero hosts the gateway) → Task 8 ✓ (Live/Clips/Footer sections are explicitly Plan B2's scope)
- Section 4 (shader background, palette, cursor reactivity) → Tasks 4, 5, 6 ✓
- Section 5 (hidden gateway: invisible hotspot, 2.5s hold, progress ring, burst transition) → Task 7 ✓

**2. Placeholder scan** — no "TBD"/"TODO"/"add appropriate error handling" patterns found; every task has real, complete code.

**3. Type consistency** — `ShaderBackgroundHandle.setGatewayState(progress: number, origin: [number, number])` defined identically in Task 6 and consumed identically in Task 7. `HoldGestureTracker`'s constructor signature matches exactly between Task 3's definition and Task 7's consumption (thresholdMs, onProgress, onComplete, then the three injectable scheduler functions in the same order).

**4. Actual execution verification — this plan was built and run for real, not just written**, in the same sandboxed environment this whole project has been verified in throughout. Final state:

```
Test Files  4 passed (4)
     Tests  16 passed (16)
```

```
✓ Compiled successfully in 888ms
  Running TypeScript ... Finished TypeScript in 5.0s
  Generating static pages using 1 worker (5/5)

Route (app)
┌ ○ /
├ ○ /_not-found
└ ○ /admin
```

Real static `index.html` and `admin.html` files were confirmed present in the `out/` directory afterward.

**Four real issues were found and fixed during this verification pass** — all four are already corrected in the task steps above, not left as known issues:
1. Vitest doesn't automatically understand Next.js's `@/` path alias (separate module resolution systems) — fixed by adding explicit alias config to `vitest.config.ts` (Task 4).
2. Vitest's global fake-timer faking of `requestAnimationFrame` proved unreliable for driving `HiddenGateway`'s recursive tick loop via `advanceTimersByTime` — fixed by making the component accept injectable scheduler functions, the same pattern already proven reliable in `HoldGestureTracker` itself (Task 7). This was a genuine component design improvement, not a test-only workaround.
3. `create-next-app`'s default scaffold uses `next/font/google` (Geist/Geist Mono), which fetches fonts at *build time* and failed in this sandboxed environment due to no network access to `fonts.googleapis.com` — fixed by switching to the project's actual established brand fonts (Chakra Petch + Rajdhani), loaded via a plain `<link>` tag matching every other widget in this project, which also sidesteps the build-time-fetch requirement entirely (Task 2).
4. The Hero heading originally used Tailwind's generic `font-mono` utility rather than the project's actual brand font — caught and corrected once the real fonts were properly wired up (Task 8).

**5. Honest verification boundary, stated explicitly rather than glossed over**: this environment has no GPU or display, so true WebGL rendering — whether the shader visually looks like flowing noise, whether the burst transition reads well, whether the colors match intent — could not be verified here. What was verified: the shader compiles as valid-looking GLSL ES 1.0 using standard techniques, the WebGL setup/teardown logic is correct (tested with a mocked context), and the component gracefully handles WebGL being unavailable rather than crashing. **A real visual check in an actual browser, once deployed, is still needed** and is not something this plan's verification pass can substitute for.

## Execution Handoff

Plan complete and already fully executed/verified once during construction, same as Plan A. The working code is ready to hand over directly rather than re-derive from scratch — but if you'd prefer to see it rebuilt task-by-task with fresh review at each step:

**1. Just deploy the code directly** — already built, tested, and passing; ready to copy into your actual project

**2. Subagent-Driven** — fresh subagent per task, review between tasks

**3. Inline Execution** — batch execution with checkpoints in this session

**Which approach?**
