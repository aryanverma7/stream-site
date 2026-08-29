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
    <div className="rounded border border-[#34f5c5]/20 bg-[#151F2B] p-6">
      <h3 className="mb-4 text-sm uppercase tracking-widest text-[#ECE8E1]">Agent</h3>

      <p className="mb-4 text-xs text-[#9AA3AC]">
        Sets how many credits are reserved for abilities each round, which decides
        which weapons the roulette offers. Kits range from 600 to 900 - a whole
        tier of weapon - so this is worth keeping current. Prices live in{" "}
        <code className="text-[#34f5c5]">roulette_agent_ability_costs</code> in the
        config editor below.
      </p>

      {error && <p className="mb-3 text-sm text-[#B8323F]">{error}</p>}

      <div className="mb-4 rounded border border-[#34f5c5]/10 bg-[#0F1923] px-4 py-3">
        <p className="text-xs uppercase tracking-widest text-[#9AA3AC]">Playing</p>
        {loading ? (
          <p className="text-sm text-[#9AA3AC]">Loading...</p>
        ) : current ? (
          <p className="text-sm text-[#ECE8E1]">
            <span className="font-semibold text-[#34f5c5]">{current}</span>
            {kitCost === null ? (
              <span className="text-[#9AA3AC]"> - no ability prices on file, using the estimate</span>
            ) : (
              <span className="text-[#9AA3AC]"> - {kitCost} creds reserved for abilities</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-[#9AA3AC]">Not set - abilities are being estimated</p>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {agents.map((agent) => (
          <button
            key={agent.name}
            type="button"
            onClick={() => setAgent(agent.name)}
            disabled={saving}
            className={`rounded px-3 py-1.5 text-xs uppercase tracking-widest disabled:opacity-40 ${
              agent.name === current
                ? "bg-[#34f5c5]/20 text-[#34f5c5]"
                : "bg-[#0F1923] text-[#9AA3AC] hover:text-[#ECE8E1]"
            }`}
          >
            {agent.name}
            {agent.kit_cost !== null && (
              <span className="ml-2 text-[#9AA3AC]">{agent.kit_cost}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="another agent"
          className="flex-1 rounded border border-[#34f5c5]/20 bg-[#0F1923] px-3 py-2 text-sm text-[#ECE8E1]"
        />
        <button
          type="button"
          onClick={() => {
            void setAgent(typed);
            setTyped("");
          }}
          disabled={saving || !typed.trim()}
          className="rounded bg-[#34f5c5]/10 px-4 py-2 text-xs uppercase tracking-widest text-[#34f5c5] hover:bg-[#34f5c5]/20 disabled:opacity-40"
        >
          {saving ? "Setting..." : "Set"}
        </button>
      </div>
    </div>
  );
}
