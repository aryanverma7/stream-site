/**
 * Keeps a follower <video> on its leader's clock for side-by-side compare:
 * play, pause, seek and speed are mirrored at once, and while playing any
 * drift over DRIFT_S is corrected every CHECK_MS. A shorter follower simply
 * stops at its end while the leader plays on. Returns the cleanup.
 */
export const DRIFT_S = 0.1;
export const CHECK_MS = 500;

type Video = Pick<HTMLVideoElement, "currentTime" | "paused" | "playbackRate" | "duration" | "play" | "pause" | "addEventListener" | "removeEventListener">;

export function syncVideos(
  leader: Video,
  follower: Video,
  every: (fn: () => void, ms: number) => ReturnType<typeof setInterval> = setInterval,
  stop: (id: ReturnType<typeof setInterval>) => void = clearInterval,
): () => void {
  const inRange = () => !(Number.isFinite(follower.duration) && leader.currentTime >= follower.duration);
  const seek = () => {
    follower.currentTime = Number.isFinite(follower.duration) ? Math.min(leader.currentTime, follower.duration) : leader.currentTime;
  };
  const play = () => {
    seek();
    if (inRange()) void Promise.resolve(follower.play()).catch(() => {}); // autoplay refusal: the leader's gesture covers the left only
  };
  const pause = () => {
    follower.pause();
    seek();
  };
  const rate = () => {
    follower.playbackRate = leader.playbackRate;
  };
  const handlers: [string, () => void][] = [
    ["play", play],
    ["pause", pause],
    ["seeking", seek],
    ["seeked", seek],
    ["ratechange", rate],
  ];
  for (const [e, h] of handlers) leader.addEventListener(e, h);
  const timer = every(() => {
    if (leader.paused || !inRange()) return;
    if (Math.abs(follower.currentTime - leader.currentTime) > DRIFT_S) seek();
    if (follower.paused) play();
  }, CHECK_MS);
  rate();
  return () => {
    stop(timer);
    for (const [e, h] of handlers) leader.removeEventListener(e, h);
  };
}
