"use client";

import { useEffect, useRef } from "react";
import { isTyping } from "./isTyping";

export type PlayerKeyHandlers = {
  toggle?(): void;
  seekBy?(delta: number): void;
  step?(dir: 1 | -1): void;
  speed?(dir: 1 | -1): void;
  seekPercent?(n: number): void;
  comment?(): void;
  general?(): void;
  compare?(): void;
  fullscreen?(): void;
  help?(): void;
  /** True when it closed something; only then does Esc stop here. */
  escape?(): boolean;
};

/**
 * Single-key shortcuts on window, in the capture phase so Esc can stop the
 * shell's zoom-out. Ignored while typing and with Ctrl/Alt/Meta held.
 */
export function usePlayerKeys(handlers: PlayerKeyHandlers, { enabled = true }: { enabled?: boolean } = {}) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || isTyping(e)) return;
      const h = ref.current;
      const el = e.target as HTMLElement | null;
      const key = e.key.toLowerCase();
      let handled = true;
      if (key === "escape") {
        if (h.escape?.()) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      // A focused button/link keeps its own Space; the slider keeps its own arrows.
      if (key === " " && el?.closest?.("button, a, [role=slider]")) return;
      if ((key === "arrowleft" || key === "arrowright") && el?.closest?.("[role=slider]")) return;
      if (key === " " || key === "k") h.toggle?.();
      else if (key === "arrowleft") h.seekBy?.(-5);
      else if (key === "arrowright") h.seekBy?.(5);
      else if (key === "j") h.seekBy?.(-10);
      else if (key === "l") h.seekBy?.(10);
      else if (key === ",") h.step?.(-1);
      else if (key === ".") h.step?.(1);
      else if (key === "<") h.speed?.(-1);
      else if (key === ">") h.speed?.(1);
      else if (/^\d$/.test(key)) h.seekPercent?.(Number(key));
      else if (key === "c") h.comment?.();
      else if (key === "g") h.general?.();
      else if (key === "v") h.compare?.();
      else if (key === "f") h.fullscreen?.();
      else if (key === "?") h.help?.();
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled]);
}
