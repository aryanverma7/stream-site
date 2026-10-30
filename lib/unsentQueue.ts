/**
 * Comments and replies written but not yet acknowledged by the backend,
 * kept in localStorage so a Mac Mini outage or a closed tab loses nothing.
 * Every storage access is guarded: with storage unavailable the entries live
 * in memory for this page only, and sending still works.
 */
export type Entry = {
  client_id: string;
  kind: "comment" | "reply";
  iterationId?: number;
  commentId?: number;
  payload: Record<string, unknown>;
  created_at: number;
  /** Who wrote it: only that person's session may send it (an entry without one is never sent). */
  username?: string;
};
export type Outcome = "sent" | "retry" | "drop";

const KEY = "editor.unsent";
let mem: Entry[] = [];
let useMem = false; // true once a write failed: memory is then the truth even if reads still work
// ponytail: used only while localStorage throws; lost on reload

/** 32 hex characters, which fits the backend's client_id pattern. */
export const newClientId = () => crypto.randomUUID().replaceAll("-", "");

export function list(): Entry[] {
  if (useMem) return mem;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return mem;
  }
}

function save(entries: Entry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
    useMem = false;
  } catch {
    mem = entries;
    useMem = true;
  }
}

export const enqueue = (e: Entry) => save([...list(), e]);
export const remove = (clientId: string) => save(list().filter((e) => e.client_id !== clientId));
/** Gives an entry saved before entries had a username to `username`, so their flush sends it. Never re-owns a named entry. */
export const claim = (clientId: string, username: string) =>
  save(list().map((e) => (e.client_id === clientId && !e.username ? { ...e, username } : e)));

/** `username`'s entries, oldest first; stops at the first "retry" so order is kept. Others' entries wait for their own login. */
export async function flush(send: (e: Entry) => Promise<Outcome>, username: string): Promise<void> {
  for (const e of list().filter((x) => x.username === username)) {
    const r = await send(e);
    if (r === "retry") return;
    remove(e.client_id);
  }
}
