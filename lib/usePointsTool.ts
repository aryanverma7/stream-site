"use client";

import { useCallback, useState } from "react";

interface BalanceResult {
  username: string;
  points: number;
}

interface GrantResult {
  username: string;
  granted: number;
  // null when the backend confirmed the grant but cannot report a total.
  // The cloudbot points backend usually can't: Cloudbot's confirmation
  // carries the amount added, and there is no way to read a balance back.
  // Rendered as "granted", never as a balance of zero.
  new_balance: number | null;
}

/**
 * Points testing tool, per spec Section 14 - consumes GET /api/points/{username}
 * and POST /api/points/grant, both already built and tested in Task #4.
 * grantPoints() reuses the SAME backend function the real Streamlabs Tips
 * listener will eventually call, so testing here exercises the real code
 * path, not a separate simulation of it.
 *
 * Realistic expectation, not a bug if hit: both calls will 502 until a
 * real Streamlabs access token is set up in config.json (Task #5/#6) -
 * the backend correctly reports this as an error rather than faking success.
 */
export function usePointsTool() {
  const [balanceResult, setBalanceResult] = useState<BalanceResult | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const [grantResult, setGrantResult] = useState<GrantResult | null>(null);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantLoading, setGrantLoading] = useState(false);

  const checkBalance = useCallback(async (username: string) => {
    setBalanceLoading(true);
    setBalanceError(null);
    setBalanceResult(null);
    try {
      const res = await fetch(`/api/points/${encodeURIComponent(username)}`, { credentials: "same-origin" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `request failed: ${res.status}`);
      setBalanceResult(body);
    } catch (err) {
      setBalanceError(err instanceof Error ? err.message : "Balance lookup failed");
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const grantPoints = useCallback(async (username: string, amount: number) => {
    setGrantLoading(true);
    setGrantError(null);
    setGrantResult(null);
    try {
      const res = await fetch("/api/points/grant", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, amount }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `request failed: ${res.status}`);
      setGrantResult(body);
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : "Grant failed");
    } finally {
      setGrantLoading(false);
    }
  }, []);

  return {
    balanceResult,
    balanceError,
    balanceLoading,
    checkBalance,
    grantResult,
    grantError,
    grantLoading,
    grantPoints,
  };
}
