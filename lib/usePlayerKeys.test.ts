import { describe, expect, it, vi } from "vitest";
import { fireEvent, renderHook } from "@testing-library/react";
import { usePlayerKeys } from "./usePlayerKeys";

function setup() {
  const h = {
    toggle: vi.fn(), seekBy: vi.fn(), step: vi.fn(), speed: vi.fn(), seekPercent: vi.fn(), comment: vi.fn(),
    general: vi.fn(), compare: vi.fn(), fullscreen: vi.fn(), help: vi.fn(), escape: vi.fn(() => false),
  };
  renderHook(() => usePlayerKeys(h));
  return h;
}

describe("usePlayerKeys", () => {
  it("fires each handler", () => {
    const h = setup();
    const press = (key: string, init = {}) => fireEvent.keyDown(document.body, { key, ...init });
    press(" "); press("K"); expect(h.toggle).toHaveBeenCalledTimes(2);
    press("ArrowLeft"); press("ArrowRight"); press("j"); press("L");
    expect(h.seekBy.mock.calls.map((c) => c[0])).toEqual([-5, 5, -10, 10]);
    press(","); press(".");
    expect(h.step.mock.calls.map((c) => c[0])).toEqual([-1, 1]);
    press("<"); press(">");
    expect(h.speed.mock.calls.map((c) => c[0])).toEqual([-1, 1]);
    press("0"); press("9");
    expect(h.seekPercent.mock.calls.map((c) => c[0])).toEqual([0, 9]);
    press("c"); press("g"); press("v"); press("f"); press("?");
    for (const f of [h.comment, h.general, h.compare, h.fullscreen, h.help]) expect(f).toHaveBeenCalledTimes(1);
  });

  it("ignores typing fields and modifier chords", () => {
    const h = setup();
    const input = document.body.appendChild(document.createElement("input"));
    const area = document.body.appendChild(document.createElement("textarea"));
    fireEvent.keyDown(input, { key: "k" });
    fireEvent.keyDown(area, { key: "c" });
    fireEvent.keyDown(document.body, { key: "f", ctrlKey: true });
    expect(h.toggle).not.toHaveBeenCalled();
    expect(h.comment).not.toHaveBeenCalled();
    expect(h.fullscreen).not.toHaveBeenCalled();
    input.remove();
    area.remove();
  });

  it("Space on the slider plays; on a button it is the button's unless it opts in with data-player-keys", () => {
    const box = document.body.appendChild(document.createElement("div"));
    box.innerHTML = '<div role="slider" tabindex="0"></div><button>x</button><button data-player-keys>go</button>';
    const [slider, plain, goTo] = [...box.children] as HTMLElement[];
    const h = { toggle: vi.fn(), seekBy: vi.fn() };
    renderHook(() => usePlayerKeys(h, { container: { current: box } }));
    fireEvent.keyDown(slider, { key: " " });
    expect(h.toggle).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(h.seekBy).not.toHaveBeenCalled(); // the slider's own arrows
    fireEvent.keyDown(plain, { key: " " });
    expect(h.toggle).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(goTo, { key: " " });
    fireEvent.keyDown(goTo, { key: "k" });
    expect(h.toggle).toHaveBeenCalledTimes(3);
    box.remove();
  });

  it("Esc stops propagation only when something closed", () => {
    const h = setup();
    const after = vi.fn();
    window.addEventListener("keydown", after);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(after).toHaveBeenCalledTimes(1);
    h.escape.mockReturnValue(true);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(after).toHaveBeenCalledTimes(1);
    window.removeEventListener("keydown", after);
  });
});
