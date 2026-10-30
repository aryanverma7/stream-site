"use client";

import { useEffect, useId, useRef, useState } from "react";
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

/**
 * Comment search for the top bar; "/" focuses it. Snippets are plain text, never HTML.
 * A combobox: ArrowUp/ArrowDown/Home/End move the active result (focus stays in the box,
 * aria-activedescendant names the result), Enter opens it, or the first one if none is active.
 */
export function SearchBox() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { hits, loading, error } = useSearch(q);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const shown = hits.slice(0, 50);
  const optionId = (i: number) => `${listId}-${i}`;

  useEffect(() => {
    if (active >= 0) document.getElementById(optionId(active))?.scrollIntoView?.({ block: "nearest" });
  });

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
    input.current?.blur(); // focus left in the box would swallow the player's keys
    go(h);
  };
  const searching = q.trim().length >= 2;
  const listOpen = open && searching;

  return (
    <div
      className="relative"
      onBlur={(e) => {
        // focus leaving the box and its results (a click elsewhere) closes them
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <input
        ref={input}
        type="search"
        aria-label="Search comments"
        placeholder="Search comments ( / )"
        value={q}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={listOpen}
        aria-controls={listOpen ? listId : undefined}
        aria-activedescendant={listOpen && active >= 0 && active < shown.length ? optionId(active) : undefined}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          const last = shown.length - 1;
          const move = (to: number) => {
            e.preventDefault();
            setOpen(true);
            setActive(to);
          };
          if (e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
            setActive(-1);
          } else if (e.key === "Enter") {
            const h = listOpen ? (shown[active] ?? shown[0]) : undefined;
            if (h) pick(h);
          } else if (last < 0 || !searching) return;
          else if (e.key === "ArrowDown") move(active >= last ? 0 : active + 1);
          else if (e.key === "ArrowUp") move(active <= 0 ? last : active - 1);
          else if (e.key === "Home" && listOpen) move(0);
          else if (e.key === "End" && listOpen) move(last);
        }}
        className="w-40 border border-ink/40 bg-transparent px-2 py-1.5 text-xs placeholder:text-ink/60 sm:w-56"
      />
      {listOpen && (
        <ul id={listId} role="listbox" aria-label="Search results" className="absolute right-0 z-30 mt-1 max-h-80 w-80 max-w-[90vw] overflow-y-auto border border-seam bg-bezel text-phosphor shadow-lg">
          {loading && <li className="px-3 py-2 text-sm text-dim">Searching…</li>}
          {error && <li className="px-3 py-2 text-sm text-rec">{error}</li>}
          {!loading && !error && hits.length === 0 && <li className="px-3 py-2 text-sm text-dim">No matches</li>}
          {shown.map((h, i) => (
            <li key={`${h.kind}-${h.comment_id}-${h.snippet}`} id={optionId(i)} role="option" aria-selected={i === active}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault() /* keep focus in the box until the click lands */}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(h)}
                className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-bezel-2 ${i === active ? "bg-bezel-2 outline outline-1 -outline-offset-1 outline-field" : ""}`}
              >
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
