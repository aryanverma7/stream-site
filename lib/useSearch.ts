"use client";

import { useEffect, useState } from "react";
import { editorApi } from "./editorApi";

export type Hit = {
  kind: "comment" | "reply";
  comment_id: number;
  iteration_id: number;
  tape_id: number;
  project_id: number;
  version: number;
  snippet: string;
  start_s: number | null;
};

export const MIN_QUERY = 2;
export const DEBOUNCE_MS = 250;

type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (id: unknown) => void };
const realTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) };

/**
 * Comment search, debounced. The query rides in the URL: it is search text,
 * not a secret. Under MIN_QUERY characters nothing is sent. `timers` is
 * injectable so tests need no fake clock.
 */
export function useSearch(q: string, timers: Timers = realTimers): { hits: Hit[]; loading: boolean; error: string | null } {
  const [state, setState] = useState<{ q: string; hits: Hit[]; error: string | null } | null>(null);
  const term = q.trim();
  const active = term.length >= MIN_QUERY;

  useEffect(() => {
    if (!active) return;
    let live = true;
    const t = timers.set(() => {
      editorApi<{ hits: Hit[] }>(`/search?q=${encodeURIComponent(term)}`)
        .then((d) => live && setState({ q: term, hits: d.hits, error: null }))
        .catch((e: Error) => live && setState({ q: term, hits: [], error: e.message }));
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      timers.clear(t);
    };
  }, [term, active, timers]);

  const current = active && state?.q === term ? state : null;
  return { hits: current?.hits ?? [], loading: active && !current, error: current?.error ?? null };
}
