"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import gsap from "gsap";
import { createTapCounter, isTap } from "@/lib/tapCounter";

// Room red, matching the hero's comic page. Spheres use the theme's reds, ink and paper.
const ROOM = "#d80f1d";
const COLORS = ["#ff1f30", "#e60012", "#8f000b", "#0b0b0b", "#f4f1ea", "#0b0b0b", "#ff1f30"];
const CENTRE_RADIUS = 1.9;
const COUNT = 42;
const PUSH_RADIUS = 2.2;

type Ball = {
  mesh: THREE.Mesh;
  home: THREE.Vector3;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  r: number;
  phase: number;
  rise: { y: number; s: number };
};

/** Deterministic layout, so the cluster looks the same on every load. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

/**
 * A cluster of cel-shaded spheres round one big centre sphere. They rise in,
 * breathe, get pushed by the pointer, bump each other and spring home; drag
 * orbits. The centre sphere is the admin door: five taps inside three seconds
 * flash the screen and navigate to /admin.
 */
export function Spheres() {
  const hostRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      return; // no WebGL: the red room behind stays, the hero still reads
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(ROOM);
    scene.fog = new THREE.Fog(ROOM, 16, 30);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight("#fff4ea", "#5a0008", 1.4));
    const sun = new THREE.DirectionalLight("#ffffff", 2.4);
    sun.position.set(5, 8, 6);
    scene.add(sun);

    // One geometry for every sphere and outline; one material per colour.
    const geometry = new THREE.SphereGeometry(1, 32, 24);
    const materials = new Map(COLORS.map((c) => [c, new THREE.MeshToonMaterial({ color: c })]));
    const outline = new THREE.MeshBasicMaterial({ color: "#0b0b0b", side: THREE.BackSide });

    const rand = seeded(7);
    const balls: Ball[] = [];
    const add = (home: THREE.Vector3, r: number, color: string) => {
      const mesh = new THREE.Mesh(geometry, materials.get(color));
      const edge = new THREE.Mesh(geometry, outline);
      edge.scale.setScalar(1.07);
      mesh.add(edge);
      scene.add(mesh);
      const ball: Ball = {
        mesh,
        home,
        pos: home.clone(),
        vel: new THREE.Vector3(),
        r,
        phase: rand() * Math.PI * 2,
        rise: { y: reduced ? 0 : -14, s: reduced ? 1 : 0 },
      };
      balls.push(ball);
      return ball;
    };
    const centre = add(new THREE.Vector3(), CENTRE_RADIUS, "#ff1f30");
    for (let i = 0; i < COUNT; i++) {
      // Fibonacci shell, jittered, so the cluster is round without overlapping much.
      const y = 1 - (2 * (i + 0.5)) / COUNT;
      const ring = Math.sqrt(1 - y * y);
      const a = i * 2.39996;
      const d = 2.9 + rand() * 1.9;
      add(
        new THREE.Vector3(Math.cos(a) * ring * d, y * d * 0.85, Math.sin(a) * ring * d),
        0.3 + rand() * 0.6,
        COLORS[i % COLORS.length],
      );
    }

    const rise = reduced
      ? null
      : gsap.to(
          balls.map((b) => b.rise),
          { y: 0, s: 1, duration: 1.4, ease: "back.out(1.4)", stagger: { each: 0.025, from: "center" } },
        );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minPolarAngle = Math.PI * 0.3;
    controls.maxPolarAngle = Math.PI * 0.7;
    controls.autoRotate = !reduced;
    controls.autoRotateSpeed = 0.6;
    // Let a vertical swipe still scroll the page on a phone; sideways drags orbit.
    renderer.domElement.style.touchAction = "pan-y";

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      // Pull back on narrow screens so the whole cluster fits.
      camera.position.setLength(16 / Math.min(1, camera.aspect * 1.25));
      camera.updateProjectionMatrix();
    };
    camera.position.set(0, 1.5, 16);
    resize();
    const sizer = new ResizeObserver(resize);
    sizer.observe(host);

    // Pointer: push, cursor circles, and the tap-counted admin door.
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let pointerIn = false;
    const ring = ringRef.current!;
    const dot = dotRef.current!;
    const ringX = gsap.quickTo(ring, "x", { duration: 0.35, ease: "power3" });
    const ringY = gsap.quickTo(ring, "y", { duration: 0.35, ease: "power3" });
    const dotX = gsap.quickTo(dot, "x", { duration: 0.08 });
    const dotY = gsap.quickTo(dot, "y", { duration: 0.08 });
    const tap = createTapCounter(5, 3000);
    let down: { x: number; y: number; t: number } | null = null;
    let leaving = false;

    const locate = (e: PointerEvent) => {
      const box = host.getBoundingClientRect();
      ndc.set(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1);
      return box;
    };
    const onMove = (e: PointerEvent) => {
      const box = locate(e);
      pointerIn = true;
      if (e.pointerType !== "mouse") return;
      const x = e.clientX - box.left;
      const y = e.clientY - box.top;
      ringX(x);
      ringY(y);
      dotX(x);
      dotY(y);
      gsap.to([ring, dot], { autoAlpha: 1, duration: 0.2, overwrite: "auto" });
    };
    const onLeave = () => {
      pointerIn = false;
      gsap.to([ring, dot], { autoAlpha: 0, duration: 0.2, overwrite: "auto" });
    };
    const onDown = (e: PointerEvent) => {
      locate(e);
      pointerIn = true;
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      gsap.fromTo(ring, { scale: 0.7 }, { scale: 1, duration: 0.4, ease: "back.out(3)" });
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") pointerIn = false;
      if (!down || leaving) return;
      const now = performance.now();
      const wasTap = isTap(e.clientX - down.x, e.clientY - down.y, now - down.t);
      down = null;
      if (!wasTap) return;
      locate(e);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.intersectObject(centre.mesh, false).length) return;
      gsap.fromTo(centre.rise, { s: 0.9 }, { s: 1, duration: 0.35, ease: "back.out(4)" });
      if (!tap(now)) return;
      leaving = true;
      const flash = flashRef.current!;
      flash.style.transition = reduced ? "none" : "opacity 0.6s ease-in";
      flash.style.opacity = "1";
      // A real document navigation, not router.push(): the backend gates
      // /admin and answers a session-less route-data fetch with a redirect
      // the client router cannot follow.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- see above
      setTimeout(() => window.location.assign("/admin"), reduced ? 0 : 850);
    };
    const canvas = renderer.domElement;
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onLeave);

    let visible = true;
    const seen = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    seen.observe(host);

    const clock = new THREE.Clock();
    const cp = new THREE.Vector3();
    const d = new THREE.Vector3();
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!visible) return;
      const dt = Math.min(clock.getDelta(), 1 / 30);
      const t = clock.elapsedTime;
      if (pointerIn) raycaster.setFromCamera(ndc, camera);
      const ray = raycaster.ray;

      for (const b of balls) {
        if (b === centre) continue;
        // Spring home (risen in), damped.
        d.copy(b.home).setY(b.home.y + b.rise.y).sub(b.pos);
        b.vel.addScaledVector(d, 30 * dt).multiplyScalar(1 - 5 * dt);
        if (pointerIn) {
          ray.closestPointToPoint(b.pos, cp);
          d.subVectors(b.pos, cp);
          const dist = d.length();
          if (dist < PUSH_RADIUS + b.r && dist > 1e-4) b.vel.addScaledVector(d, ((PUSH_RADIUS + b.r - dist) / dist) * 60 * dt);
        }
        b.pos.addScaledVector(b.vel, dt);
      }

      // Collisions: push overlapping pairs apart; the centre never moves.
      const size = (b: Ball) => b.r * b.rise.s * (reduced ? 1 : 1 + 0.04 * Math.sin(t * 1.6 + b.phase));
      for (let i = 0; i < balls.length; i++) {
        const a = balls[i];
        for (let j = i + 1; j < balls.length; j++) {
          const b = balls[j];
          d.subVectors(b.pos, a.pos);
          const dist = d.length();
          const overlap = size(a) + size(b) - dist;
          if (overlap <= 0 || dist < 1e-4) continue;
          d.multiplyScalar(overlap / dist);
          if (a === centre) b.pos.add(d);
          else {
            a.pos.addScaledVector(d, -0.5);
            b.pos.addScaledVector(d, 0.5);
          }
        }
      }

      for (const b of balls) {
        b.mesh.position.copy(b.pos);
        b.mesh.scale.setScalar(Math.max(size(b), 1e-3));
      }
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      rise?.kill();
      gsap.killTweensOf([ring, dot, centre.rise]);
      sizer.disconnect();
      seen.disconnect();
      controls.dispose();
      geometry.dispose();
      materials.forEach((m) => m.dispose());
      outline.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-fine:cursor-none" style={{ background: ROOM }}>
      <div ref={hostRef} className="absolute inset-0" />
      <div
        ref={ringRef}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 z-30 -mt-5 -ml-5 h-10 w-10 rounded-full border-2 border-ink opacity-0"
      />
      <div
        ref={dotRef}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 z-30 -mt-1 -ml-1 h-2 w-2 rounded-full bg-phosphor opacity-0"
      />
      <div ref={flashRef} className="pointer-events-none absolute inset-0 z-40 bg-ink opacity-0" />
    </div>
  );
}
