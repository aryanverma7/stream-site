"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import gsap from "gsap";
import { createTapCounter, isTap } from "@/lib/tapCounter";

// A port of the "Festivity" sphere-collision CodePen: its radii, positions, intro,
// hover force, collisions, breathing, material and lighting, verbatim.

// Room red behind the canvas.
const ROOM = "#d80f1d";

// Sphere paints [colour, emissive], lit by the pen's own rig. Colours sit
// well below white so the pen's light-to-shadow gradient still shows.
const PAPER: [string, string] = ["#b8b2a8", "#0e0a06"];
const INK: [string, string] = ["#1a1a1a", "#140002"];
// Sphere i takes paint i % length: v1 [PAPER], v2 [INK], v3 [INK, INK, PAPER].
const LOOK: [string, string][] = [INK, INK, PAPER];

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
const POSITIONS: [number, number, number][] = [
  [0, 0, 0], [1.2, 0.9, -0.5], [1.8, -0.3, 0], [-1, -1, 0], [-1, 1.62, 0],
  [-1.65, 0, -0.4], [-2.13, -1.54, -0.4], [0.8, 0.94, 0.3], [0.5, -1, 1.2], [-0.16, -1.2, 0.9],
  [1.5, 1.2, 0.8], [0.5, -1.58, 1.4], [-1.5, 1, 1.15], [-1.5, -1.5, 0.99], [-1.5, -1.5, -1.9],
  [1.85, 0.8, 0.05], [1.5, -1.2, -0.75], [0.9, -1.62, 0.22], [0.45, 2, 0.65], [2.5, 1.22, -0.2],
  [2.35, 0.7, 0.55], [-1.8, -0.35, 0.85], [-1.02, 0.2, 0.9], [0.2, 1, 1], [-2.88, 0.7, 1],
  [-2, -0.95, 1.5], [-2.3, 2.4, -0.1], [-2.5, 1.9, 1.2], [-1.8, 0.37, 1.2], [-2.4, 1.42, 0.05],
  [-2.72, -0.9, 1.1], [-1.8, -1.34, 1.67], [-1.6, 1.66, 0.91], [-2.8, 1.58, 1.69], [-2.97, 2.3, 0.65],
  [1.1, -0.2, -1.45], [-4, 1.78, 0.38], [0.12, 1.4, -1.29], [-1.64, 1.4, -1.79], [-3.5, -0.58, 0.1],
  [-0.1, -1, -2], [-4.5, 0.55, -0.5], [-3.87, 0, 1], [-4.6, -0.1, 0.65], [-3, 1.5, -0.7],
  [-0.5, 0.2, -1.5], [-1.3, -0.45, -1.5], [-3.35, 0.25, -1.5], [-4.76, -1.26, 0.4], [-4.32, 0.85, 1.4],
  [-3.5, -1.82, 0.9], [-3.6, -0.6, 1.46], [-4.55, -1.5, 1.63], [-3.8, -1.15, 2.1], [-2.9, -0.25, 1.86],
  [-2.2, -0.4, 1.86], [-5.1, -0.24, 1.86], [-5.27, 1.24, 0.76], [-5.27, 2, -0.4], [-6.4, 0.4, 1],
  [-5.15, 0.95, 2], [-6.2, 0.5, -0.8], [-4, 0.08, 1.8], [2, -0.95, 1.5], [2.3, 2.4, -0.1],
  [2.5, 1.9, 1.2], [1.8, 0.37, 1.2], [3.24, 0.6, 1.05], [2.72, -0.9, 1.1], [1.8, -1.34, 1.67],
  [1.6, 1.99, 0.91], [2.8, 1.58, 1.69], [2.97, 2.3, 0.65], [-1.3, -0.2, -2.5], [4, 1.78, 0.38],
  [1.72, 1.4, -1.29], [2.5, -1.2, -2], [3.5, -0.58, 0.1], [0.1, 0.4, -2.42], [4.5, 0.55, -0.5],
  [3.87, 0, 1], [4.6, -0.1, 0.65], [3, 1.5, -0.7], [2.3, 0.6, -2.6], [4, 1.5, -1.6],
  [3.35, 0.25, -1.5], [4.76, -1.26, 0.4], [4.32, 0.85, 1.4], [3.5, -1.82, 0.9], [3.6, -0.6, 1.46],
  [4.55, -1.5, 1.63], [3.8, -1.15, 2.1], [2.9, -0.25, 1.86], [2.2, -0.4, 1.86], [5.1, -0.24, 1.86],
  [5.27, 1.24, 0.76], [5.27, 2, -0.4], [6.4, 0.4, 1], [5.15, 0.95, 2], [6.2, 0.5, -0.8],
  [4, 0.08, 1.8],
];

const INIT_Y = -25; // intro starts below the screen
const REVOLUTION_RADIUS = 4;
const REVOLUTION_DURATION = 2; // seconds
const BREATHING_AMPLITUDE = 0.1;
const BREATHING_SPEED = 0.002;
const CAMERA_Z = 24;
const CLUSTER_HALF_WIDTH = 8;
const WIDE_CAMERA_Z = 30;

/**
 * The sphere cluster. Spheres swing up from below, breathe, are shoved by
 * the pointer, collide and drift home; drag orbits. The big centre sphere
 * (index 0) is the admin door: five taps inside three seconds flash the
 * screen and navigate to /admin.
 */
export function Spheres() {
  const hostRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);
  const followRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // The pen was written for three r1xx's legacy colour and light handling:
    // no colour management, linear output, light intensities without the PI factor.
    THREE.ColorManagement.enabled = false;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // no WebGL: the red room stays, the hero still reads
    }
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 1000);
    camera.position.z = CAMERA_Z;

    // The pen's three lights at its numbers (legacy units: x PI, spot without decay).
    scene.add(new THREE.AmbientLight(0xffffff, 1 * Math.PI));
    const spot = new THREE.SpotLight(0xffffff, 0.52 * Math.PI, 0, Math.PI / 3, 0, 0);
    spot.position.set(14, 24, 30);
    spot.castShadow = true;
    scene.add(spot);
    const under = new THREE.DirectionalLight(0xffffff, 0.2 * Math.PI);
    under.position.set(0, -4, 0);
    scene.add(under);

    // One geometry for all, scaled per sphere; the pen's one material.
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    const materials = LOOK.map(([color, emissive]) => new THREE.MeshLambertMaterial({ color, emissive }));
    const group = new THREE.Group();
    const spheres = POSITIONS.map(([x, y, z], i) => {
      const sphere = new THREE.Mesh(geometry, materials[i % materials.length]);
      sphere.scale.setScalar(RADII[i]);
      sphere.position.set(x, reduced ? y : INIT_Y, z);
      sphere.userData = { original: new THREE.Vector3(x, y, z), radius: RADII[i] };
      sphere.castShadow = true;
      sphere.receiveShadow = true;
      group.add(sphere);
      return sphere;
    });
    scene.add(group);
    const centre = spheres[0];

    // Intro: each sphere swings up and round, then settles home.
    let loadingComplete = reduced;
    const intro = reduced
      ? []
      : spheres.map((sphere, i) => {
          const o = sphere.userData.original as THREE.Vector3;
          return gsap
            .timeline({ delay: i * 0.02 })
            .to(sphere.position, {
              duration: REVOLUTION_DURATION / 2,
              y: REVOLUTION_RADIUS,
              ease: "power1.out",
              onUpdate() {
                sphere.position.z = o.z + Math.sin(this.progress() * Math.PI) * REVOLUTION_RADIUS;
              },
            })
            .to(sphere.position, {
              duration: REVOLUTION_DURATION / 2,
              y: INIT_Y / 5,
              ease: "power1.out",
              onUpdate() {
                sphere.position.z = o.z - Math.sin(this.progress() * Math.PI) * REVOLUTION_RADIUS;
              },
            })
            .to(sphere.position, { duration: 0.6, x: o.x, y: o.y, z: o.z, ease: "power1.out" });
        });
    const ready = reduced ? 0 : window.setTimeout(() => (loadingComplete = true), (REVOLUTION_DURATION + 1) * 1000);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    // Zoom and pan would steal the page's wheel scroll and two-finger gestures.
    controls.enableZoom = false;
    controls.enablePan = false;
    // A vertical swipe still scrolls the page on a phone; sideways drags orbit.
    canvas.style.touchAction = "pan-y";

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      // Pull back until the whole cluster fits (about 8 units each side wide,
      // a little further on wide screens so it clears the title band in height),
      // then lift it into the space above that band.
      const tall = camera.aspect < 1;
      const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
      camera.position.setLength(tall ? Math.max(CAMERA_Z, CLUSTER_HALF_WIDTH / halfTan + 2.5) : WIDE_CAMERA_Z);
      camera.setViewOffset(w, h, 0, h * (tall ? 0.12 : 0.08), w, h);
    };
    resize();
    const sizer = new ResizeObserver(resize);
    sizer.observe(host);

    // Pointer: hover force, the cursor circle + follower (mouse only), and the door.
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const forces = new Map<THREE.Object3D, THREE.Vector3>();
    const circle = circleRef.current!;
    const follow = followRef.current!;
    gsap.set([circle, follow], { xPercent: -50, yPercent: -50 });
    const xTo = gsap.quickTo(circle, "x", { duration: 0.6, ease: "power3" });
    const yTo = gsap.quickTo(circle, "y", { duration: 0.6, ease: "power3" });
    const xFollow = gsap.quickTo(follow, "x", { duration: 0.6, ease: "power3" });
    const yFollow = gsap.quickTo(follow, "y", { duration: 0.6, ease: "power3" });
    const tap = createTapCounter(5, 3000);
    let down: { x: number; y: number; t: number } | null = null;
    let leaving = false;

    const aim = (e: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      mouse.set(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1);
      raycaster.setFromCamera(mouse, camera);
      return box;
    };
    const onMove = (e: PointerEvent) => {
      if (!loadingComplete) return;
      const box = aim(e);
      if (e.pointerType === "mouse") {
        xTo(e.clientX - box.left);
        yTo(e.clientY - box.top);
        xFollow(e.clientX - box.left);
        yFollow(e.clientY - box.top);
        gsap.to([circle, follow], { autoAlpha: 1, duration: 0.2, overwrite: "auto" });
      }
      const hit = raycaster.intersectObjects(spheres, false)[0];
      if (hit) forces.set(hit.object, new THREE.Vector3().subVectors(hit.point, hit.object.position).normalize().multiplyScalar(0.2));
    };
    const onLeave = () => gsap.to([circle, follow], { autoAlpha: 0, duration: 0.2, overwrite: "auto" });
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const onUp = (e: PointerEvent) => {
      if (!down || leaving) return;
      const now = performance.now();
      const wasTap = isTap(e.clientX - down.x, e.clientY - down.y, now - down.t);
      down = null;
      if (!wasTap) return;
      aim(e);
      if (!raycaster.intersectObject(centre, false).length || !tap(now)) return;
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
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);

    let visible = true;
    const seen = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    seen.observe(host);

    const temp = new THREE.Vector3();
    const handleCollisions = () => {
      for (let i = 0; i < spheres.length; i++) {
        const a = spheres[i];
        for (let j = i + 1; j < spheres.length; j++) {
          const b = spheres[j];
          const distance = a.position.distanceTo(b.position);
          const minDistance = (a.userData.radius + b.userData.radius) * 1.2;
          if (distance >= minDistance) continue;
          temp.subVectors(b.position, a.position).normalize();
          const push = (minDistance - distance) * 0.4;
          // Same arithmetic as the pen: the second multiply compounds onto the first.
          a.position.sub(temp.multiplyScalar(push));
          b.position.add(temp.multiplyScalar(push));
        }
      }
    };

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (!visible) return;
      if (loadingComplete) {
        const time = reduced ? 0 : Date.now() * BREATHING_SPEED;
        spheres.forEach((sphere, i) => {
          const offset = i * 0.2;
          const force = forces.get(sphere);
          if (force) {
            sphere.position.add(force);
            force.multiplyScalar(0.95);
            if (force.length() < 0.01) forces.delete(sphere);
          }
          const o = sphere.userData.original as THREE.Vector3;
          temp.set(
            o.x,
            o.y + (reduced ? 0 : Math.sin(time + offset) * BREATHING_AMPLITUDE),
            o.z + (reduced ? 0 : Math.cos(time + offset) * BREATHING_AMPLITUDE * 0.5),
          );
          sphere.position.lerp(temp, 0.018);
        });
        handleCollisions();
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(ready);
      intro.forEach((t) => t.kill());
      gsap.killTweensOf([circle, follow]);
      sizer.disconnect();
      seen.disconnect();
      controls.dispose();
      geometry.dispose();
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      canvas.remove();
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-fine:cursor-none" style={{ background: ROOM }}>
      <div ref={hostRef} className="absolute inset-0" />
      <div
        ref={circleRef}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 z-30 h-2.5 w-2.5 rounded-full bg-ink opacity-0 transition-all duration-[50ms]"
      />
      <div
        ref={followRef}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 z-30 h-10 w-10 rounded-full border border-ink opacity-0 transition-all duration-100"
      />
      <div ref={flashRef} className="pointer-events-none absolute inset-0 z-40 bg-ink opacity-0" />
    </div>
  );
}
