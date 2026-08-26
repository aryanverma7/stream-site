"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

/**
 * Loads and runs the ORIGINAL "Sneeze the Dragon" CodePen's actual code
 * (public/dragon-original.js) against the SAME library versions the
 * original uses - TweenMax 1.16.1, Three.js r70, and the original's own
 * OrbitControls.js - rather than a modern translation. See
 * dragon-original.js for the full license/attribution notes and the two
 * small, clearly-marked additions on top of the otherwise-verbatim code.
 *
 * Script load order is genuinely dependency-sensitive: OrbitControls
 * extends THREE.OrbitControls, so it cannot load before THREE does, and
 * dragon-original.js uses globals from all three libraries immediately on
 * execution, so it must load last, only once everything else is ready.
 * This is tracked explicitly via React state rather than assumed from
 * script tag order, since that ordering isn't guaranteed by the browser
 * for plain scripts loaded this way.
 */
export function Dragon() {
  const [threeReady, setThreeReady] = useState(false);
  const [orbitReady, setOrbitReady] = useState(false);
  const [tweenReady, setTweenReady] = useState(false);
  const flashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Registered before any script loads, so it's ready whenever the
    // vanilla code eventually calls it (see the "ADDED FOR DUALBLADEX"
    // hook inside dragon-original.js's sneeze() function).
    (window as unknown as { __onDragonMaxSneeze?: () => void }).__onDragonMaxSneeze = () => {
      if (flashRef.current) {
        flashRef.current.style.transition = "opacity 0.6s ease-in";
        flashRef.current.style.opacity = "1";
      }
      // A real document navigation, deliberately NOT router.push(). The
      // dashboard is served and gated by the Python backend, not by Next:
      // a client-side push makes the router fetch its own route data from
      // /admin/__next.*.txt first, which the backend answers with a 401
      // when there's no session cookie yet - and a failed route-data fetch
      // surfaces as "This page couldn't load" instead of the login
      // redirect the person actually needs. Handing the URL to the browser
      // lets the backend's 302 to /auth/login do its job, and costs
      // nothing: /admin shares no state with this page.
      setTimeout(() => window.location.assign("/admin"), 850);
    };

    return () => {
      (window as unknown as { __dragonCleanup?: () => void }).__dragonCleanup?.();
      delete (window as unknown as { __onDragonMaxSneeze?: () => void }).__onDragonMaxSneeze;
    };
  }, []);

  return (
    <>
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r70/three.min.js"
        strategy="afterInteractive"
        onLoad={() => setThreeReady(true)}
      />
      {threeReady && (
        <Script
          src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/264161/OrbitControls.js"
          strategy="afterInteractive"
          onLoad={() => setOrbitReady(true)}
        />
      )}
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/gsap/1.16.1/TweenMax.min.js"
        strategy="afterInteractive"
        onLoad={() => setTweenReady(true)}
      />
      {orbitReady && tweenReady && (
        <Script src="/dragon-original.js" strategy="afterInteractive" />
      )}

      {/*
        Wraps everything in a normal-flow section, exactly one viewport
        tall, with position:relative - this is what lets the absolutely-
        positioned children below sit correctly WITHIN this section
        specifically (not the whole page), while the section itself
        scrolls away normally once content exists below it.
      */}
      <div style={{ position: "relative", height: "100vh", overflow: "hidden" }}>
        {/* Exact original HTML structure and CSS - #world, #instructions, #power.
            Changed from the original's position:fixed to position:absolute
            (relative to the wrapping section above) so this scrolls away
            with the page instead of permanently covering the viewport. */}
        <div id="world" style={{ position: "absolute", inset: 0, background: "#652e37", overflow: "hidden" }} />
        <div
          id="instructions"
          style={{
            position: "absolute",
            width: "100%",
            bottom: "40px",
            fontFamily: "'Open Sans', sans-serif",
            color: "#fdde8c",
            fontSize: ".8em",
            fontWeight: 800,
            textTransform: "uppercase",
            textAlign: "center",
            lineHeight: 1.5,
            userSelect: "none",
          }}
        >
          The longer you keep clicking, the harder he sneezes
          <br />
          <span style={{ color: "#f89a78", fontSize: ".9em" }}>- Press and drag to turn around -</span>
        </div>
        <div
          id="power"
          style={{
            position: "absolute",
            width: "100%",
            top: "50%",
            marginTop: "-220px",
            fontFamily: "'Open Sans', sans-serif",
            color: "#481f26",
            fontSize: "4em",
            fontWeight: 800,
            textTransform: "uppercase",
            textAlign: "center",
            lineHeight: 1.5,
            userSelect: "none",
          }}
        >
          00
        </div>

        <div ref={flashRef} style={{ position: "absolute", inset: 0, zIndex: 30, background: "#fff", opacity: 0, pointerEvents: "none" }} />
      </div>
    </>
  );
}
