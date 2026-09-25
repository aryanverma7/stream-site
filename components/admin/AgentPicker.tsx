"use client";

import { useState } from "react";
import { useAgent } from "@/lib/useAgent";

/**
 * Picks the agent being played, which sets how many credits the roulette
 * holds back for abilities before deciding which weapons are votable.
 *
 * A free-text field beside the list on purpose: a new agent ships with no
 * prices on file, and being unable to name them until somebody edits a
 * table would be worse than reserving a rough number under the right
 * name. Setting an unlisted agent is accepted and labelled.
 */
export function AgentPicker() {
  const { current, agents, kitCost, loading, saving, error, setAgent } = useAgent();
  const [typed, setTyped] = useState("");

  return (
    <div className="border border-seam bg-bezel p-6">
      <h3 className="stencil mb-4 text-4xl text-phosphor">Agent</h3>

      <p className="mb-4 max-w-prose text-[13px] leading-snug text-dim">
        Sets how many credits are reserved for abilities each round, which decides
        which weapons the roulette offers. Kits range from 600 to 900 - a whole
        tier of weapon - so this is worth keeping current. Prices live in{" "}
        <code className="text-field">roulette_agent_ability_costs</code> in the
        config editor below.
      </p>

      {error && <p className="mb-3 text-sm text-rec">{error}</p>}

      <div className="mb-5">
        <p className="text-xs uppercase tracking-widest text-dim">Playing</p>
        {loading ? (
          <p className="text-sm text-dim">Loading...</p>
        ) : current ? (
          <p className="text-sm text-phosphor">
            <span className="font-semibold text-field">{current}</span>
            {kitCost === null ? (
              <span className="text-dim"> - no ability prices on file, using the estimate</span>
            ) : (
              <span className="text-dim"> - {kitCost} creds reserved for abilities</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-dim">Not set - abilities are being estimated</p>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {agents.map((agent) => (
          <button
            key={agent.name}
            type="button"
            onClick={() => setAgent(agent.name)}
            disabled={saving}
            className={`px-3 py-1.5 text-xs uppercase tracking-widest disabled:opacity-40 ${
              agent.name === current
                ? "bg-field text-ink"
                : "bg-ink text-dim hover:text-phosphor"
            }`}
          >
            {agent.name}
            {agent.kit_cost !== null && (
              <span className={`ml-2 ${agent.name === current ? "text-ink/80" : "text-dim"}`}>{agent.kit_cost}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="another agent"
          className="flex-1 border border-seam bg-ink px-3 py-2 text-sm text-phosphor"
        />
        <button
          type="button"
          onClick={() => {
            void setAgent(typed);
            setTyped("");
          }}
          disabled={saving || !typed.trim()}
          className="wallpaper px-4 py-2 text-xs font-extrabold uppercase tracking-[0.08em] hover:bg-field-hot disabled:opacity-40"
        >
          {saving ? "Setting..." : "Set"}
        </button>
      </div>
    </div>
  );
}
