"use client";

import { useState } from "react";
import { usePointsTool } from "@/lib/usePointsTool";

/**
 * Points testing tool.
 *
 * There used to be a ledger switcher above this, offering "Streamlabs
 * API", "Cloudbot" and "Local file". Two of those are gone: the REST
 * ledger turned out to be a different store from the wallet viewers have
 * (a write through it creates a row Cloudbot cannot see), and the local
 * file was a testing stand-in that read zero for viewers holding
 * thousands. Cloudbot is the only ledger, so there is nothing to choose.
 *
 * Both calls here go through the same backend functions the roulette and
 * the tips listener use, so testing from this panel exercises the real
 * path rather than a simulation of it.
 */
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
      <div className="border border-seam bg-bezel p-6">
        <h3 className="stencil mb-3 text-4xl text-phosphor">Check Balance</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            className="flex-1 border border-seam bg-ink px-3 py-2 text-sm text-phosphor focus:border-field focus:outline-none"
          />
          <button
            type="button"
            onClick={() => checkBalance(username)}
            disabled={balanceLoading || !username}
            className="wallpaper px-4 py-2 text-xs font-extrabold uppercase tracking-[0.08em] hover:bg-field-hot disabled:opacity-40"
          >
            {balanceLoading ? "Checking..." : "Check"}
          </button>
        </div>
        {balanceError && <p className="mt-3 text-sm text-rec">{balanceError}</p>}
        {balanceResult && (
          <p className="mt-3 text-sm text-phosphor">
            <span className="text-field">{balanceResult.username}</span> has{" "}
            <span className="font-semibold">{balanceResult.points}</span> points
          </p>
        )}
      </div>

      <div className="border border-seam bg-bezel p-6">
        <h3 className="stencil mb-3 text-4xl text-phosphor">Grant Points (testing)</h3>
        <p className="mb-3 max-w-prose text-[13px] leading-snug text-dim">
          Uses the exact same backend function the real Streamlabs Tips listener
          will call - this exercises the real code path, not a simulation.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={grantUsername}
            onChange={(e) => setGrantUsername(e.target.value)}
            placeholder="username"
            className="flex-1 border border-seam bg-ink px-3 py-2 text-sm text-phosphor focus:border-field focus:outline-none"
          />
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-24 border border-seam bg-ink px-3 py-2 text-sm text-phosphor focus:border-field focus:outline-none"
          />
          <button
            type="button"
            onClick={() => grantPoints(grantUsername, Number(amount))}
            disabled={grantLoading || !grantUsername || !amount}
            className="wallpaper px-4 py-2 text-xs font-extrabold uppercase tracking-[0.08em] hover:bg-field-hot disabled:opacity-40"
          >
            {grantLoading ? "Granting..." : "Grant"}
          </button>
        </div>
        {grantError && <p className="mt-3 text-sm text-rec">{grantError}</p>}
        {grantResult && (
          <p className="mt-3 text-sm text-phosphor">
            Granted {grantResult.granted} to <span className="text-field">{grantResult.username}</span>
            {grantResult.new_balance === null ? (
              <> - new balance not reported by this backend</>
            ) : (
              <> - new balance: <span className="font-semibold">{grantResult.new_balance}</span></>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
