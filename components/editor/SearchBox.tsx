"use client";

import { useEffect, useRef, useState } from "react";
import { useSearch, type Hit } from "@/lib/useSearch";
import { routeHash } from "@/lib/useHashRoute";
import { formatTime } from "@/lib/timecode";
import { isTyping } from "@/lib/isTyping";

const go = (h: Hit) => {
  window.location.hash = routeHash({
    view: "iteration",
    projectId: h.project_id,
    tapeId: h.tape_id,
    iterationId: h.iteration_id,
    ...(h.start_s !== null && { seekS: h.start_s }),
  });
};

/** Comment search for the top bar; "/" focuses it. Snippets are plain text, never HTML. */
export function SearchBox() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { hits, loading, error } = useSearch(q);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.altKey || e.metaKey || isTyping(e)) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pick = (h: Hit) => {
    setOpen(false);
    go(h);
  };
  const searching = q.trim().length >= 2;

  return (
    <div className="relative">
      <input
        ref={input}
        type="search"
        aria-label="Search comments"
        placeholder="Search comments ( / )"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
          } else if (e.key === "Enter" && hits[0]) pick(hits[0]);
        }}
        className="w-40 border border-ink/40 bg-transparent px-2 py-1.5 text-xs placeholder:text-ink/60 sm:w-56"
      />
      {open && searching && (
        <ul role="listbox" aria-label="Search results" className="absolute right-0 z-30 mt-1 max-h-80 w-80 max-w-[90vw] overflow-y-auto border border-seam bg-bezel text-phosphor shadow-lg">
          {loading && <li className="px-3 py-2 text-sm text-dim">Searching…</li>}
          {error && <li className="px-3 py-2 text-sm text-rec">{error}</li>}
          {!loading && !error && hits.length === 0 && <li className="px-3 py-2 text-sm text-dim">No matches</li>}
          {hits.slice(0, 50).map((h) => (
            <li key={`${h.kind}-${h.comment_id}-${h.snippet}`} role="option" aria-selected={false}>
              <button type="button" onClick={() => pick(h)} className="block w-full px-3 py-2 text-left text-sm hover:bg-bezel-2">
                <span className="label mr-2 text-[10px] text-dim">{h.kind === "reply" ? "Reply" : "Comment"}</span>
                v{h.version}
                {h.start_s !== null && ` · ${formatTime(h.start_s)}`} · {h.snippet}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
