import { describe, expect, it } from "vitest";
import { createTapCounter, isTap } from "./tapCounter";

describe("createTapCounter", () => {
  it("opens on the fifth tap inside three seconds", () => {
    const tap = createTapCounter();
    expect([0, 500, 1000, 1500].map(tap)).toEqual([false, false, false, false]);
    expect(tap(2999)).toBe(true);
  });

  it("forgets taps older than the window", () => {
    const tap = createTapCounter();
    [0, 500, 1000, 1500].forEach(tap);
    expect(tap(3000)).toBe(false); // the tap at 0 has aged out
    expect(tap(3100)).toBe(true);
  });

  it("starts over after opening", () => {
    const tap = createTapCounter(2, 3000);
    expect(tap(0)).toBe(false);
    expect(tap(10)).toBe(true);
    expect(tap(20)).toBe(false);
  });
});

describe("isTap", () => {
  it("is a short press that barely moved", () => {
    expect(isTap(3, 4, 200)).toBe(true);
  });
  it("is not a drag or a long hold", () => {
    expect(isTap(30, 0, 200)).toBe(false);
    expect(isTap(0, 0, 900)).toBe(false);
  });
});
