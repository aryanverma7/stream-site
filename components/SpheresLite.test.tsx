import { describe, expect, it, vi } from "vitest";
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
    render(<HeroScene2 />);
    const card = screen.getByRole("button", { name: "Calling card" });
    for (let i = 0; i < 5; i++) {
      fireEvent.pointerDown(card, { button: 0, clientX: 10, clientY: 10 });
      fireEvent.pointerUp(card, { button: 0, clientX: 10, clientY: 10 });
    }
    vi.advanceTimersByTime(1000);
    expect(assign).toHaveBeenCalledWith("/admin");
    expect(screen.queryByText(/: /)).toBeNull(); // taps draw no arcana
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
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const { container } = render(<HeroScene2 />);
    const card = screen.getByRole("button", { name: "Calling card" });
    const caption = container.querySelector("[aria-live]")!;
    fireEvent.pointerDown(card, { button: 0, clientX: 10, clientY: 10 });
    vi.advanceTimersByTime(10);
    fireEvent.pointerMove(card, { clientX: 90, clientY: 10 });
    fireEvent.pointerUp(card, { button: 0, clientX: 90, clientY: 10 });
    expect(caption.textContent).toMatch(/^(THE \w+|DEATH): .+\.$/);
    act(() => vi.advanceTimersByTime(6900));
    expect(caption.textContent).not.toBe("");
    act(() => vi.advanceTimersByTime(200));
    expect(caption.textContent).toBe("");
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
