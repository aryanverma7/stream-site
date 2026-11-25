import { afterEach, describe, expect, it, vi } from "vitest";
import { Spring, install } from "./sakuga";

function motion(reduce: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches: reduce, addEventListener() {}, removeEventListener() {} }));
  // jsdom has no animation frames
  vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16));
}

describe("Spring", () => {
  it("overshoots its target, then settles on it", () => {
    const s = new Spring(1, 520, 15);
    s.to = 0.8;
    let low = 1;
    for (let i = 0; i < 60; i++) low = Math.min(low, s.step(1 / 60));
    expect(low).toBeLessThan(0.8);
    expect(s.x).toBeCloseTo(0.8, 3);
  });
});

describe("install", () => {
  let off: (() => void) | undefined;
  afterEach(() => {
    off?.();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("squashes a pressed button on a spring and lets go of it once still", async () => {
    motion(false);
    off = install();
    document.body.innerHTML = "<button>Go</button>";
    const b = document.querySelector("button")!;
    // jsdom drops the `scale` property, so watch the writes instead
    const set = vi.spyOn(b.style, "setProperty");
    const unset = vi.spyOn(b.style, "removeProperty");
    b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 120));
    const [prop, value] = set.mock.calls.at(-1)!;
    expect(prop).toBe("scale");
    const [sx, sy] = String(value).split(" ").map(Number);
    expect(sy).toBeLessThan(1); // squashed flat
    expect(sx).toBeGreaterThan(1); // and wide
    dispatchEvent(new PointerEvent("pointerup"));
    await vi.waitFor(() => expect(unset).toHaveBeenCalledWith("scale"), { timeout: 3000 });
  });

  it("never squashes the scrub slider, so the seek point stays under the cursor", async () => {
    motion(false);
    off = install();
    document.body.innerHTML = '<div role="slider" tabindex="0"></div>';
    const s = document.querySelector<HTMLElement>('[role="slider"]')!;
    const set = vi.spyOn(s.style, "setProperty");
    s.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    expect(set).not.toHaveBeenCalledWith("scale", expect.anything());
    dispatchEvent(new PointerEvent("pointerup"));
  });

  it("stops listening when a touch scrub is cancelled into a pan", () => {
    motion(false);
    off = install();
    document.body.innerHTML = '<div role="slider" tabindex="0"></div>';
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    document.querySelector('[role="slider"]')!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    dispatchEvent(new PointerEvent("pointercancel"));
    for (const t of ["pointermove", "pointerup", "pointercancel"]) {
      const added = add.mock.calls.find(([type]) => type === t)![1];
      expect(remove).toHaveBeenCalledWith(t, added);
    }
  });

  it("lets go of a held button when reduced motion turns on mid-hold", async () => {
    const mq = { matches: false, onchange: () => {}, addEventListener(_: string, f: () => void) { mq.onchange = f; }, removeEventListener() {} };
    vi.stubGlobal("matchMedia", () => mq);
    vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 16));
    off = install();
    document.body.innerHTML = "<button>Go</button>";
    const b = document.querySelector("button")!;
    const set = vi.spyOn(b.style, "setProperty");
    const unset = vi.spyOn(b.style, "removeProperty");
    b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    expect(set).toHaveBeenCalledWith("scale", expect.any(String));
    mq.matches = true;
    mq.onchange();
    dispatchEvent(new PointerEvent("pointerup"));
    expect(unset).toHaveBeenCalledWith("scale");
    set.mockClear();
    await new Promise((r) => setTimeout(r, 60));
    expect(set).not.toHaveBeenCalled(); // the frame loop no longer steps it
  });

  it("does nothing under reduced motion: no squash, no effects canvas", async () => {
    motion(true);
    off = install();
    document.body.innerHTML = '<button class="wallpaper">Save</button>';
    const b = document.querySelector("button")!;
    const set = vi.spyOn(b.style, "setProperty");
    b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    b.click();
    await new Promise((r) => setTimeout(r, 60));
    expect(set).not.toHaveBeenCalled();
    expect(document.querySelector("canvas.sakuga-fx")).toBeNull();
  });
});
