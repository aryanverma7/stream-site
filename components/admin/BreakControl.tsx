"use client";

import { useState } from "react";
import { useBreakTimer } from "@/lib/useBreakTimer";

const PRESETS = [5, 10, 15, 20];

function formatRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Starts and stops the break screen's countdown.
 *
 * Presets rather than only a free-text box, because this gets used in the
 * ten seconds before switching scenes - one click has to be enough. The
 * box is still there for the break that isn't five, ten, fifteen or
 * twenty minutes long.
 *
 * Set it BEFORE switching to the break scene: once that scene is live it
 * is the only thing on stream, and this panel is on the other monitor.
 */
export function BreakControl() {
  const { state, error, busy, start, stop } = useBreakTimer();
  const [minutes, setMinutes] = useState("");
  const [message, setMessage] = useState("");

  const chosen = Number(minutes) || state?.default_minutes || 10;

  return (
    <div className="flex flex-col gap-6">
      <div className="border border-seam bg-bezel p-6">
        <h3 className="stencil mb-3 text-4xl text-phosphor">Break screen</h3>

        {state?.active ? (
          <>
            <div className="flex items-baseline gap-3">
              <span
                className={`osd text-8xl tabular-nums ${
                  state.overdue ? "text-amber" : "text-field"
                }`}
              >
                {formatRemaining(state.remaining_seconds)}
              </span>
              <span className="text-xs uppercase tracking-widest text-dim">
                {state.overdue ? "Overdue - screen says “any moment now”" : "remaining"}
              </span>
            </div>
            <p className="mt-1 max-w-prose text-[13px] leading-snug text-dim">Showing: {state.message}</p>
          </>
        ) : (
          <p className="text-sm text-dim">
            No break running. Set one here <em>before</em> switching to the break scene.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-1">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={busy}
              onClick={() => start(preset, message)}
              className="label border border-seam bg-ink px-4 py-2.5 text-sm text-phosphor transition-colors hover:border-field hover:text-field disabled:opacity-40"
            >
              {preset} min
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="number"
            min="1"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder={String(state?.default_minutes ?? 10)}
            aria-label="Break length in minutes"
            className="w-24 border border-seam bg-ink px-3 py-2 text-sm text-phosphor"
          />
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Back in a moment"
            aria-label="Message on the break screen"
            className="min-w-48 flex-1 border border-seam bg-ink px-3 py-2 text-sm text-phosphor"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => start(chosen, message)}
            className="wallpaper px-5 py-2 text-xs font-extrabold uppercase tracking-[0.08em] hover:bg-field-hot disabled:opacity-40"
          >
            {state?.active ? "Restart" : "Start"}
          </button>
          {state?.active && (
            <button
              type="button"
              disabled={busy}
              onClick={() => stop()}
              className="border border-rec px-5 py-2 text-xs uppercase tracking-widest text-rec hover:bg-rec/15 disabled:opacity-40"
            >
              End
            </button>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-rec">{error}</p>}

        <p className="mt-4 max-w-prose text-[13px] leading-snug text-dim">
          Restarting is how you add time - it sets the clock running again from now. The screen
          never counts past zero; it switches to “any moment now” and stays up.
        </p>
      </div>
    </div>
  );
}
