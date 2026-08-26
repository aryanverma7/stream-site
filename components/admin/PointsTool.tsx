"use client";

import { useState } from "react";
import { usePointsTool } from "@/lib/usePointsTool";

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
