/** 3:42, or 1:02:05 past the hour; `tenths` appends ".5". */
export function formatTime(s: number, tenths = false): string {
  const v = Number.isFinite(s) && s > 0 ? s : 0;
  const t = Math.floor(v);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const ss = String(t % 60).padStart(2, "0");
  const base = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
  return tenths ? `${base}.${Math.floor(v * 10) % 10}` : base;
}

/** "3:42.5", "1:02:05", "42" -> seconds; anything else null. */
export function parseTime(text: string): number | null {
  const s = text.trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const m = s.match(/^(?:(\d+):)?(\d+):(\d{2})(\.\d+)?$/);
  if (!m) return null;
  const [h, min, sec] = [Number(m[1] ?? 0), Number(m[2]), Number(m[3])];
  if (sec >= 60 || (m[1] !== undefined && min >= 60)) return null;
  return h * 3600 + min * 60 + sec + Number(m[4] ?? 0);
}
