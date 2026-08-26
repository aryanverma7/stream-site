"use client";

import { Dragon } from "./Dragon";

/**
 * Hero section - the dragon now scrolls away naturally once content exists
 * below it, rather than permanently covering the viewport. The heading
 * moved from `fixed` to sitting inside the same scrolling hero unit as the
 * dragon, so the whole hero scrolls away together as one piece - a
 * persistent sticky logo across the whole page would be a different,
 * deliberate choice if wanted later.
 */
export function Hero() {
  return (
    <section className="relative h-screen w-full overflow-hidden">
      <Dragon />

      <div className="pointer-events-none absolute left-1/2 top-12 z-20 -translate-x-1/2 text-center">
        <h1
          className="text-3xl tracking-[0.3em] text-[#ECE8E1]"
          style={{ fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700 }}
        >
          DUALBLADEX
        </h1>
      </div>
    </section>
  );
}
