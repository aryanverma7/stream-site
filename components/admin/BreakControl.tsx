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
      <div className="rounded border border-[#34f5c5]/20 bg-[#151F2B] p-6">
        <h3 className="mb-3 text-sm uppercase tracking-widest text-[#ECE8E1]">Break screen</h3>

        {state?.active ? (
          <>
            <div className="flex items-baseline gap-3">
              <span
                className={`text-4xl font-bold tabular-nums ${
                  state.overdue ? "text-[#E8B33F]" : "text-[#34f5c5]"
                }`}
              >
                {formatRemaining(state.remaining_seconds)}
              </span>
              <span className="text-xs uppercase tracking-widest text-[#9AA3AC]">
                {state.overdue ? "Overdue - screen says “any moment now”" : "remaining"}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#9AA3AC]">Showing: {state.message}</p>
          </>
        ) : (
          <p className="text-sm text-[#9AA3AC]">
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
              className="rounded border border-[#34f5c5]/20 px-4 py-2 text-xs uppercase tracking-widest text-[#9AA3AC] hover:border-[#34f5c5]/50 hover:text-[#ECE8E1] disabled:opacity-40"
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
            className="w-24 rounded border border-[#34f5c5]/20 bg-[#0F1923] px-3 py-2 text-sm text-[#ECE8E1]"
          />
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Back in a moment"
            className="min-w-48 flex-1 rounded border border-[#34f5c5]/20 bg-[#0F1923] px-3 py-2 text-sm text-[#ECE8E1]"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => start(chosen, message)}
            className="rounded bg-[#34f5c5]/10 px-5 py-2 text-xs uppercase tracking-widest text-[#34f5c5] hover:bg-[#34f5c5]/20 disabled:opacity-40"
          >
            {state?.active ? "Restart" : "Start"}
          </button>
          {state?.active && (
            <button
              type="button"
              disabled={busy}
              onClick={() => stop()}
              className="rounded border border-[#B8323F]/40 px-5 py-2 text-xs uppercase tracking-widest text-[#B8323F] hover:bg-[#B8323F]/10 disabled:opacity-40"
            >
              End
            </button>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-[#B8323F]">{error}</p>}

        <p className="mt-4 text-xs text-[#9AA3AC]">
          Restarting is how you add time - it sets the clock running again from now. The screen
          never counts past zero; it switches to “any moment now” and stays up.
        </p>
      </div>
    </div>
  );
}
