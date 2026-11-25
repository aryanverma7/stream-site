/** A press is a tap when it barely moved and was short; anything else is a drag. */
export function isTap(dx: number, dy: number, ms: number, maxMove = 8, maxMs = 500): boolean {
  return Math.hypot(dx, dy) <= maxMove && ms <= maxMs;
}

/**
 * Counts taps against an injected clock. Returns a function that records a
 * tap at `now` (ms) and answers true on the `taps`-th tap inside `windowMs`,
 * then starts over.
 */
export function createTapCounter(taps = 5, windowMs = 3000): (now: number) => boolean {
  let times: number[] = [];
  return (now) => {
    times = times.filter((t) => now - t < windowMs);
    times.push(now);
    if (times.length < taps) return false;
    times = [];
    return true;
  };
}
