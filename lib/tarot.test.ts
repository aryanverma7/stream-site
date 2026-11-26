import { describe, expect, it } from "vitest";
import { ARCANA, createReading, dealer, HOLD_MS } from "./tarot";

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
    expect(seen.size).toBe(10);
  });

  it("moves a repeat off the top of a fresh deck", () => {
    // First shuffle keeps [a, b], the second swaps to [b, a], which would repeat b.
    const rolls = [0.999, 0];
    const next = dealer(["a", "b"], () => rolls.shift() ?? 0.999);
    expect([next(), next(), next(), next()]).toEqual(["a", "b", "a", "b"]);
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
