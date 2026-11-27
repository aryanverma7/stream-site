import { describe, expect, it } from "vitest";
import { ARCANA, createIdle, createReading, createSlicer, dealer, HOLD_MS } from "./tarot";

describe("createSlicer", () => {
  it("slices every 4-7 flicks, never twice in a row", () => {
    const s = createSlicer();
    const gaps = new Set<number>();
    let n = 0;
    for (let i = 0; i < 5000; i++) {
      n++;
      if (s.flick()) {
        gaps.add(n);
        s.reset();
        n = 0;
      }
    }
    expect([...gaps].sort()).toEqual([4, 5, 6, 7]);
  });

  it("keeps a refused slice for the next flick, and reset restarts the gap", () => {
    const s = createSlicer(() => 0);
    expect([s.flick(), s.flick(), s.flick(), s.flick(), s.flick()]).toEqual([false, false, false, true, true]);
    s.reset();
    expect([s.flick(), s.flick(), s.flick(), s.flick()]).toEqual([false, false, false, true]);
  });
});

describe("dealer", () => {
  it("never deals the same card twice in a row, across reshuffles, and deals them all", () => {
    const next = dealer(ARCANA);
    const seen = new Set<string>();
    let prev = next();
    for (let i = 0; i < 2000; i++) {
      const a = next();
      expect(a).not.toBe(prev);
      seen.add(a.name);
      prev = a;
    }
    expect(seen.size).toBe(20);
  });

  it("moves a repeat off the top of a fresh deck", () => {
    // First shuffle keeps [a, b], the second swaps to [b, a], which would repeat b.
    const rolls = [0.999, 0];
    const next = dealer(["a", "b"], () => rolls.shift() ?? 0.999);
    expect([next(), next(), next(), next()]).toEqual(["a", "b", "a", "b"]);
  });
});

describe("ARCANA", () => {
  it("has twenty distinct arcana, each with a fortune", () => {
    expect(ARCANA).toHaveLength(20);
    expect(new Set(ARCANA.map((a) => a.name)).size).toBe(20);
    expect(new Set(ARCANA.map((a) => a.n)).size).toBe(20);
    for (const a of ARCANA) expect(a.fortune).toMatch(/\.$/);
  });
});

describe("createIdle", () => {
  it("is due 40-70 s after the latest poke, once per quiet stretch", () => {
    let roll = 0;
    const idle = createIdle(() => roll);
    expect(idle.take(1e9)).toBe(false); // never poked
    expect(idle.poke(1000)).toBe(41_000);
    expect(idle.take(40_999)).toBe(false);
    roll = 1;
    expect(idle.poke(10_000)).toBe(80_000); // a poke restarts the wait
    expect(idle.take(79_999)).toBe(false);
    expect(idle.take(80_000)).toBe(true);
    expect(idle.take(200_000)).toBe(false);
  });
});

describe("createReading", () => {
  it("shows a draw for HOLD_MS, and a new draw restarts the hold", () => {
    let n = 0;
    const r = createReading(() => ++n);
    expect(HOLD_MS).toBe(7000);
    expect(r.current(0)).toBeNull();
    expect(r.draw(1000)).toBe(1);
    expect(r.current(7999)).toBe(1);
    expect(r.current(8000)).toBeNull();
    r.draw(10_000);
    expect(r.draw(15_000)).toBe(3);
    expect(r.until()).toBe(22_000);
    expect(r.current(21_999)).toBe(3);
    expect(r.current(22_000)).toBeNull();
  });
});
