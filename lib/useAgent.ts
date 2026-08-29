"use client";

import { useCallback, useEffect, useState } from "react";

export interface AgentEntry {
  name: string;
  /** null when this agent has no ability prices on file. */
  kit_cost: number | null;
}

/**
 * Reads and sets the agent the streamer is playing.
 *
 * The agent decides how many credits are held back for abilities before
 * the votable weapon roster is built, and kits range from 600 to 900 -
 * a whole tier of weapon. It changes once per match, not once per round,
 * which is why it is typed rather than read off the screen: adding a
 * second OCR target would multiply every failure mode the credit reader
 * already has, for a value that moves this rarely.
 *
 * `agents` is the merged view of the built-in price table and config's
 * overrides, so the dropdown lists exactly what the roster calculation
 * will actually find. Any other name can still be set - it is accepted
 * with a null kit_cost, and the panel says the prices are missing, which
 * is how a new agent gets noticed and added.
 */
export function useAgent(): {
  current: string | null;
  agents: AgentEntry[];
  kitCost: number | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  setAgent: (name: string) => Promise<void>;
} {
  const [current, setCurrent] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error(`Agents request failed (${res.status})`);
      const data = await res.json();
      setCurrent(data.current ?? null);
      setAgents(Array.isArray(data.agents) ? data.agents : []);
      setError(null);
    } catch (e) {
      // A backend older than this build has no /api/agents at all. Leave
      // the panel empty and say so, rather than rendering a dropdown that
      // silently cannot save.
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setAgent = useCallback(async (name: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: name }),
      });
      if (!res.ok) throw new Error(`Couldn't set the agent (${res.status})`);
      const data = await res.json();
      setCurrent(data.agent ?? null);
      setAgents((previous) =>
        previous.some((a) => a.name === data.agent)
          ? previous
          : [...previous, { name: data.agent, kit_cost: data.kit_cost ?? null }].sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, []);

  const kitCost = agents.find((a) => a.name === current)?.kit_cost ?? null;

  return { current, agents, kitCost, loading, saving, error, setAgent };
}
