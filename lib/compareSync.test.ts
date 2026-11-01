import { describe, expect, it, vi } from "vitest";
import { CHECK_MS, syncVideos } from "./compareSync";

class FakeVideo extends EventTarget {
  currentTime = 0;
  paused = true;
  playbackRate = 1;
  duration = 100;
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
}

function setup(followerDuration = 100) {
  const l = new FakeVideo();
  const f = new FakeVideo();
  f.duration = followerDuration;
  let tick = () => {};
  const stop = vi.fn();
  const done = syncVideos(l as unknown as HTMLVideoElement, f as unknown as HTMLVideoElement, (fn, ms) => {
    expect(ms).toBe(CHECK_MS);
    tick = fn;
    return 1 as unknown as ReturnType<typeof setInterval>;
  }, stop);
  return { l, f, tick: () => tick(), done, stop };
}

describe("syncVideos", () => {
  it("mirrors play, pause, seek and speed", () => {
    const { l, f } = setup();
    l.currentTime = 12;
    l.paused = false;
    l.dispatchEvent(new Event("play"));
    expect(f.play).toHaveBeenCalled();
    expect(f.currentTime).toBe(12);
    l.currentTime = 30;
    l.dispatchEvent(new Event("seeked"));
    expect(f.currentTime).toBe(30);
    l.playbackRate = 2;
    l.dispatchEvent(new Event("ratechange"));
    expect(f.playbackRate).toBe(2);
    l.dispatchEvent(new Event("pause"));
    expect(f.pause).toHaveBeenCalled();
  });

  it("corrects drift over 0.1 s while playing, and none under it", () => {
    const { l, f, tick } = setup();
    l.paused = false;
    f.paused = false;
    l.currentTime = 10;
    f.currentTime = 10.05;
    tick();
    expect(f.currentTime).toBe(10.05);
    f.currentTime = 10.3;
    tick();
    expect(f.currentTime).toBe(10);
  });

  it("leaves a shorter follower stopped at its end while the leader plays on", () => {
    const { l, f, tick } = setup(20);
    l.paused = false;
    l.currentTime = 25;
    l.dispatchEvent(new Event("play"));
    expect(f.play).not.toHaveBeenCalled();
    expect(f.currentTime).toBe(20);
    tick();
    expect(f.play).not.toHaveBeenCalled();
  });

  it("stops listening on cleanup", () => {
    const { l, f, done, stop } = setup();
    done();
    expect(stop).toHaveBeenCalledWith(1);
    l.dispatchEvent(new Event("play"));
    expect(f.play).not.toHaveBeenCalled();
  });
});
