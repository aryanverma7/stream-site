import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { INTRO_END, SpheresLite, introPosition, nearest, pick } from "./SpheresLite";
import { HeroScene2 } from "./HeroScene2";

// jsdom has no WebGL2, so SpheresLite takes its fallback path: the static red room.
vi.stubGlobal("matchMedia", () => ({ matches: false }));

describe("SpheresLite", () => {
  it("falls back to the red room without WebGL2 and keeps the system cursor", () => {
    const { container } = render(<SpheresLite />);
    expect(container.querySelector("canvas")).toBeNull();
    expect(screen.getByTestId("spheres").style.background).not.toBe("");
    expect(screen.getByTestId("spheres").className).not.toContain("cursor-none");
  });

  it("clears the door's flash when Back restores the page from the bfcache", () => {
    const { container } = render(<SpheresLite />);
    const flash = container.querySelector<HTMLDivElement>(".z-40")!;
    flash.style.opacity = "1";
    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    expect(flash.style.opacity).toBe("0");
  });

  it("starts each sphere below the screen and ends the intro at home", () => {
    const p = [0, 0, 0];
    introPosition(1, 0, p);
    expect(p).toEqual([1.2, -25, -0.5]);
    introPosition(1, 3, p);
    expect(p).toEqual([1.2, 0.9, -0.5]);
  });

  it("runs the intro until the last sphere is home", () => {
    const end = [0, 0, 0];
    const last = 100;
    introPosition(last, 99, end);
    const p = [0, 0, 0];
    introPosition(last, INTRO_END, p);
    p.forEach((v, k) => expect(v).toBeCloseTo(end[k], 9));
    introPosition(last, 3, p); // the old 3 s cut-off left it mid-swing
    expect(p[1]).not.toBeCloseTo(end[1], 1);
  });

  it("lists the eight closest surfaces, nearest first, never itself", () => {
    const pos = new Float32Array(101 * 3).fill(100);
    for (let j = 0; j <= 9; j++) pos.set([j * 3, 0, 0], j * 3);
    const out = new Float32Array(8);
    nearest(pos, 0, out, 0);
    expect([...out]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("picks the nearest sphere on the ray", () => {
    const pos = new Float32Array(101 * 3).fill(100);
    pos.set([0, 0, 0], 0); // centre, radius 1
    pos.set([0, 0, 5], 3); // sphere 1, radius 0.6, in front of it
    const hit = [0, 0, 0];
    expect(pick(pos, [0, 0, 24], [0, 0, -1], hit)).toBe(1);
    expect(hit[2]).toBeCloseTo(5.6);
    expect(pick(pos, [0.8, 0, 24], [0, 0, -1], hit)).toBe(0);
    expect(pick(pos, [5, 5, 24], [0, 0, -1], hit)).toBe(-1);
  });
});

describe("HeroScene2", () => {
  // Every pointer-up asks matchMedia, and the tests below unstub globals as they finish.
  beforeEach(() => vi.stubGlobal("matchMedia", () => ({ matches: false })));

  it("clears the door's flash when Back restores the page from the bfcache", () => {
    const { container } = render(<HeroScene2 />);
    const flash = container.querySelector<HTMLDivElement>(".z-40")!;
    flash.style.opacity = "1";
    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    expect(flash.style.opacity).toBe("0");
  });

  it("opens the door on the fifth tap on the card", () => {
    vi.useFakeTimers();
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    render(<HeroScene2 random={() => 0} />); // the shortest slice gap
    const card = screen.getByRole("button", { name: "Calling card" });
    for (let i = 0; i < 5; i++) {
      delete card.dataset.knock;
      tap(card);
      expect(card.dataset.knock).toBe(""); // every rapid tap knocks
    }
    vi.advanceTimersByTime(1000);
    expect(assign).toHaveBeenCalledWith("/admin");
    expect(screen.queryByText(/: /)).toBeNull(); // taps draw no arcana
    expect(card.dataset.colourway).toBe("CLASSIC"); // and never slice
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("never counts a drag as a tap", () => {
    vi.useFakeTimers();
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    render(<HeroScene2 />);
    const card = screen.getByRole("button", { name: "Calling card" });
    for (let i = 0; i < 5; i++) {
      fireEvent.pointerDown(card, { button: 0, clientX: 10, clientY: 10 });
      vi.advanceTimersByTime(200); // slow, so not a flick either
      fireEvent.pointerMove(card, { clientX: 60, clientY: 10 });
      vi.advanceTimersByTime(200);
      fireEvent.pointerUp(card, { button: 0, clientX: 60, clientY: 10 });
    }
    vi.advanceTimersByTime(1000);
    expect(assign).not.toHaveBeenCalled();
    expect(screen.queryByText(/: /)).toBeNull();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("a flick draws an arcana with its fortune, cleared after 7 s", () => {
    vi.useFakeTimers();
    const { container } = render(<HeroScene2 random={() => 0.5} />); // no slice
    const card = screen.getByRole("button", { name: "Calling card" });
    const caption = container.querySelector("[aria-live]")!;
    flick(card);
    expect(caption.textContent).toMatch(/^[A-Z ]+: .+\.$/);
    act(() => vi.advanceTimersByTime(6900));
    expect(caption.textContent).not.toBe("");
    act(() => vi.advanceTimersByTime(200));
    expect(caption.textContent).toBe("");
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("a tap knocks: the blades flash for 150 ms, nothing else changes, a reading keeps showing", () => {
    vi.useFakeTimers();
    const { container } = render(<HeroScene2 random={() => 0.5} />);
    const card = screen.getByRole("button", { name: "Calling card" });
    const caption = container.querySelector("[aria-live]")!;
    tap(card);
    expect(card.dataset.knock).toBe("");
    expect(getComputedStyle(container.querySelector(".cc-blade")!).fill).toBe("var(--cc-knock)");
    expect(card.dataset.colourway).toBe("CLASSIC");
    expect(caption.textContent).toBe("");
    act(() => vi.advanceTimersByTime(150));
    expect(card.dataset.knock).toBeUndefined();
    flick(card);
    const fortune = caption.textContent;
    tap(card);
    expect(caption.textContent).toBe(fortune);
    expect(card.dataset.colourway).toBe("CLASSIC");
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("slices on the 4th flick, then again 4 flicks later (random 0), tarot in between", () => {
    vi.useFakeTimers();
    const { container } = render(<HeroScene2 random={() => 0} />);
    const card = screen.getByRole("button", { name: "Calling card" });
    const caption = container.querySelector("[aria-live]")!;
    for (const [n, colour] of [[1, "CLASSIC"], [2, "CLASSIC"], [3, "CLASSIC"], [4, "INKED"], [5, "INKED"], [6, "INKED"], [7, "INKED"], [8, "REDCARD"]] as const) {
      act(() => flick(card));
      if (n % 4) expect(caption.textContent, `flick ${n}`).not.toBe("");
      act(() => vi.advanceTimersByTime(1300));
      expect(card.dataset.colourway, `flick ${n}`).toBe(colour);
    }
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("after the idle slice the next 3 flicks do not slice", () => {
    vi.useFakeTimers();
    let t = 0;
    render(<HeroScene2 random={() => 0} now={() => t} />); // 40 s idle wait, gap 4
    const card = screen.getByRole("button", { name: "Calling card" });
    act(() => { t += 41_300; vi.advanceTimersByTime(41_300); });
    expect(card.dataset.colourway).toBe("INKED");
    for (let i = 0; i < 3; i++) {
      act(() => flick(card));
      act(() => vi.advanceTimersByTime(1300));
      expect(card.dataset.colourway).toBe("INKED");
    }
    act(() => flick(card));
    act(() => vi.advanceTimersByTime(1300));
    expect(card.dataset.colourway).toBe("REDCARD");
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("a sliced flick swaps in the next colourway, cycling CLASSIC -> INKED -> REDCARD -> CLASSIC", () => {
    vi.useFakeTimers();
    const { container } = render(<HeroScene2 random={() => 0} />);
    const card = screen.getByRole("button", { name: "Calling card" });
    const caption = container.querySelector("[aria-live]")!;
    for (const next of ["INKED", "REDCARD", "CLASSIC"]) {
      for (let i = 0; i < 4; i++) act(() => flick(card));
      act(() => vi.advanceTimersByTime(1300));
      expect(card.dataset.colourway).toBe(next);
      expect(caption.textContent).toBe(""); // a slice draws no arcana
    }
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("under reduced motion a slice only swaps the colourway", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const { container } = render(<HeroScene2 random={() => 0} />);
    const card = screen.getByRole("button", { name: "Calling card" });
    for (let i = 0; i < 4; i++) act(() => flick(card));
    expect(card.dataset.colourway).toBe("INKED");
    expect(container.querySelector(".cc-cuts")).toBeNull();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("slices once on its own after the idle wait, again only after an interaction", () => {
    vi.useFakeTimers();
    let t = 0;
    render(<HeroScene2 random={() => 1} now={() => t} />); // 70 s wait
    const card = screen.getByRole("button", { name: "Calling card" });
    const wait = (ms: number) => act(() => { t += ms; vi.advanceTimersByTime(ms); });
    wait(69_999);
    expect(card.dataset.colourway).toBe("CLASSIC");
    wait(1 + 1300);
    expect(card.dataset.colourway).toBe("INKED");
    wait(300_000);
    expect(card.dataset.colourway).toBe("INKED");
    fireEvent.pointerDown(window);
    wait(70_000 + 1300);
    expect(card.dataset.colourway).toBe("REDCARD");
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});

/** A press and release in place: a tap. */
function tap(card: HTMLElement) {
  fireEvent.pointerDown(card, { button: 0, clientX: 10, clientY: 10 });
  fireEvent.pointerUp(card, { button: 0, clientX: 10, clientY: 10 });
}

/** A fast drag and release: a real flick. Needs fake timers. */
function flick(card: HTMLElement) {
  fireEvent.pointerDown(card, { button: 0, clientX: 10, clientY: 10 });
  vi.advanceTimersByTime(10);
  fireEvent.pointerMove(card, { clientX: 90, clientY: 10 });
  fireEvent.pointerUp(card, { button: 0, clientX: 90, clientY: 10 });
}
