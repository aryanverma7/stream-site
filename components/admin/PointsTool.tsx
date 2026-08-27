"use client";

import { useState } from "react";
import { usePointsTool } from "@/lib/usePointsTool";
import { usePointsBackend, type PointsBackend } from "@/lib/usePointsBackend";

const BACKEND_LABELS: Record<PointsBackend, string> = {
  api: "Streamlabs API",
  cloudbot: "Cloudbot",
  local: "Local file",
};

/**
 * What each ledger actually is, in the terms that matter when choosing
 * one: whose balance it holds, and what is wrong with it right now.
 * "Cloudbot" and "Streamlabs API" are the SAME wallet reached two ways,
 * which is the thing most worth saying out loud - only "Local file" is a
 * different set of numbers from the one `!points` reports.
 */
const BACKEND_NOTES: Record<PointsBackend, { tone: string; lead: string; body: string }> = {
  api: {
    tone: "text-[#34f5c5]",
    lead: "Streamlabs API.",
    body: "Viewers' real balances, over REST. Every call returns 401 until Streamlabs approves this app's Loyalty Points access.",
  },
  cloudbot: {
    tone: "text-[#34f5c5]",
    lead: "Cloudbot.",
    body: "The same wallet !points reports, reached by asking Cloudbot in chat. Needs the bot account to be a moderator, and each lookup costs a visible chat line.",
  },
  local: {
    tone: "text-[#E8B33F]",
    lead: "Local file.",
    body: "A ledger on the Mac Mini. Not what !points reports - it holds nothing anyone earned by watching, so viewers see two different balances. Testing only.",
  },
};

/**
 * Switches which ledger every points call reads and writes.
 *
 * Sits here rather than on the Status panel because this is the control,
 * not the reading - the Status panel reports the live ledger and stays
 * read-only introspection like everything else on it. Both read the same
 * /api/status field, so they cannot disagree.
 */
function BackendSwitch() {
  const { backend, loading, switching, error, switchTo } = usePointsBackend();

  if (loading) {
    return (
      <div className="rounded border border-[#34f5c5]/20 bg-[#151F2B] p-6">
        <p className="text-sm text-[#9AA3AC]">Checking which points ledger is live...</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-[#34f5c5]/20 bg-[#151F2B] p-6">
      <h3 className="mb-3 text-sm uppercase tracking-widest text-[#ECE8E1]">Points ledger</h3>

      {backend === null ? (
        <p className="text-xs text-[#9AA3AC]">
          This backend isn&apos;t reporting a points ledger, so it can&apos;t be switched from
          here. Set <code className="text-[#34f5c5]">points_backend</code> in the Config tab
          instead.
        </p>
      ) : (
        <>
          <div className="flex gap-1 rounded border border-[#34f5c5]/10 bg-[#0F1923] p-1">
            {(Object.keys(BACKEND_LABELS) as PointsBackend[]).map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={backend === name}
                onClick={() => switchTo(name)}
                disabled={switching || backend === name}
                className={`flex-1 rounded px-4 py-2 text-xs uppercase tracking-widest transition-colors ${
                  backend === name
                    ? "bg-[#34f5c5]/15 text-[#34f5c5]"
                    : "text-[#9AA3AC] hover:text-[#ECE8E1] disabled:opacity-40"
                }`}
              >
                {BACKEND_LABELS[name]}
              </button>
            ))}
          </div>

          <p className="mt-3 text-xs text-[#9AA3AC]">
            <span className={BACKEND_NOTES[backend].tone}>{BACKEND_NOTES[backend].lead}</span>{" "}
            {BACKEND_NOTES[backend].body}
          </p>

          <p className="mt-2 text-xs text-[#9AA3AC]">
            Takes effect on the next points call - no restart needed.
          </p>
        </>
      )}

      {switching && <p className="mt-3 text-sm text-[#9AA3AC]">Switching...</p>}
      {error && <p className="mt-3 text-sm text-[#B8323F]">{error}</p>}
    </div>
  );
}

export function PointsTool() {
  const {
    balanceResult, balanceError, balanceLoading, checkBalance,
    grantResult, grantError, grantLoading, grantPoints,
  } = usePointsTool();

  const [username, setUsername] = useState("");
  const [grantUsername, setGrantUsername] = useState("");
  const [amount, setAmount] = useState("100");

  return (
    <div className="flex flex-col gap-6">
      <BackendSwitch />
      <div className="rounded border border-[#34f5c5]/20 bg-[#151F2B] p-6">
        <h3 className="mb-3 text-sm uppercase tracking-widest text-[#ECE8E1]">Check Balance</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            className="flex-1 rounded border border-[#34f5c5]/10 bg-[#0F1923] px-3 py-2 text-sm text-[#ECE8E1] focus:border-[#34f5c5]/40 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => checkBalance(username)}
            disabled={balanceLoading || !username}
            className="rounded bg-[#34f5c5]/10 px-4 py-2 text-xs uppercase tracking-widest text-[#34f5c5] hover:bg-[#34f5c5]/20 disabled:opacity-40"
          >
            {balanceLoading ? "Checking..." : "Check"}
          </button>
        </div>
        {balanceError && <p className="mt-3 text-sm text-[#B8323F]">{balanceError}</p>}
        {balanceResult && (
          <p className="mt-3 text-sm text-[#ECE8E1]">
            <span className="text-[#34f5c5]">{balanceResult.username}</span> has{" "}
            <span className="font-semibold">{balanceResult.points}</span> points
          </p>
        )}
      </div>

      <div className="rounded border border-[#34f5c5]/20 bg-[#151F2B] p-6">
        <h3 className="mb-3 text-sm uppercase tracking-widest text-[#ECE8E1]">Grant Points (testing)</h3>
        <p className="mb-3 text-xs text-[#9AA3AC]">
          Uses the exact same backend function the real Streamlabs Tips listener
          will call - this exercises the real code path, not a simulation.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={grantUsername}
            onChange={(e) => setGrantUsername(e.target.value)}
            placeholder="username"
            className="flex-1 rounded border border-[#34f5c5]/10 bg-[#0F1923] px-3 py-2 text-sm text-[#ECE8E1] focus:border-[#34f5c5]/40 focus:outline-none"
          />
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-24 rounded border border-[#34f5c5]/10 bg-[#0F1923] px-3 py-2 text-sm text-[#ECE8E1] focus:border-[#34f5c5]/40 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => grantPoints(grantUsername, Number(amount))}
            disabled={grantLoading || !grantUsername || !amount}
            className="rounded bg-[#34f5c5]/10 px-4 py-2 text-xs uppercase tracking-widest text-[#34f5c5] hover:bg-[#34f5c5]/20 disabled:opacity-40"
          >
            {grantLoading ? "Granting..." : "Grant"}
          </button>
        </div>
        {grantError && <p className="mt-3 text-sm text-[#B8323F]">{grantError}</p>}
        {grantResult && (
          <p className="mt-3 text-sm text-[#ECE8E1]">
            Granted {grantResult.granted} to <span className="text-[#34f5c5]">{grantResult.username}</span> -
            new balance: <span className="font-semibold">{grantResult.new_balance}</span>
          </p>
        )}
      </div>
    </div>
  );
}
