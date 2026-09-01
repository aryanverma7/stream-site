"use client";

import {
  STATUS_POLL_INTERVAL_MS,
  useAdminStatus,
  type CreditPrediction,
  type GameEventsStatus,
  type OcrAgentStatus,
  type PublicUrlStatus,
  type RouletteStatus,
} from "@/lib/useAdminStatus";

function StatusBadge({ value }: { value: boolean | null }) {
  if (value === null) {
    return <span className="text-xs uppercase tracking-widest text-[#9AA3AC]">Not yet implemented</span>;
  }
  return (
    <span
      className={`text-xs font-bold uppercase tracking-widest ${value ? "text-[#34f5c5]" : "text-[#B8323F]"}`}
    >
      {value ? "Connected" : "Disconnected"}
    </span>
  );
}

/**
 * A badge for a check that genuinely reports, as opposed to one that is
 * still a placeholder. `undefined` is its own case on purpose: it means
 * the backend didn't send the field at all, which is a Mac Mini running
 * older code rather than anything being down.
 */
function LiveBadge({
  value,
  up,
  down,
  unknown = "Not checked",
}: {
  value: boolean | null | undefined;
  up: string;
  down: string;
  unknown?: string;
}) {
  if (value === undefined) {
    return <span className="text-xs uppercase tracking-widest text-[#9AA3AC]">Not reporting</span>;
  }
  if (value === null) {
    return <span className="text-xs uppercase tracking-widest text-[#9AA3AC]">{unknown}</span>;
  }
  return (
    <span
      className={`text-xs font-bold uppercase tracking-widest ${value ? "text-[#34f5c5]" : "text-[#B8323F]"}`}
    >
      {value ? up : down}
    </span>
  );
}

function formatAge(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "never";
  if (seconds < 60) return `${Math.round(seconds)}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

function OcrAgentBlock({ agent }: { agent: OcrAgentStatus | null | undefined }) {
  if (!agent) {
    return <LiveBadge value={undefined} up="Connected" down="Not running" />;
  }

  // Whichever kind of contact was most recent. A build of the agent older
  // than the heartbeat sends captures and nothing else, and reporting it
  // as never seen while it is actively working would be plainly wrong.
  const ages = [agent.last_heartbeat_age_seconds, agent.last_capture_age_seconds].filter(
    (a): a is number => a !== null,
  );
  const lastSeen = ages.length > 0 ? Math.min(...ages) : null;

  return (
    <>
      <LiveBadge value={agent.connected} up="Connected" down="Not running" />
      {agent.connected ? (
        <p className="mt-1 text-xs text-[#9AA3AC]">
          Last seen {formatAge(lastSeen)} · {agent.captures_accepted}/{agent.captures_received} captures read
        </p>
      ) : (
        <p className="mt-1 text-xs text-[#B8323F]">
          {lastSeen === null
            ? "Nothing heard since the backend started - agent.py isn't running on the gaming PC, or its secret doesn't match."
            : `Last seen ${formatAge(lastSeen)}, past the ${agent.heartbeat_timeout_seconds}s cutoff.`}
        </p>
      )}
      {!agent.tesseract_available && (
        <p className="mt-1 text-xs text-[#B8323F]">
          Tesseract isn&apos;t where the Mac Mini expects it - every capture will come back 503.
        </p>
      )}
    </>
  );
}

function PublicUrlBlock({ publicUrl }: { publicUrl: PublicUrlStatus | null | undefined }) {
  if (!publicUrl) {
    return <LiveBadge value={undefined} up="Reachable" down="Unreachable" />;
  }

  return (
    <>
      <LiveBadge value={publicUrl.reachable} up="Reachable" down="Unreachable" />
      <p
        className={`mt-1 text-xs ${publicUrl.reachable === false ? "text-[#B8323F]" : "text-[#9AA3AC]"}`}
      >
        {publicUrl.detail}
      </p>
      {publicUrl.checked_age_seconds !== null && (
        <p className="mt-1 text-xs text-[#9AA3AC]">Checked {formatAge(publicUrl.checked_age_seconds)}</p>
      )}
    </>
  );
}

/**
 * Valorant's own credit glyph. Written as an escape rather than pasted in
 * literally so it survives any editor that isn't confident about the
 * character - it's the same symbol the roulette overlay prints.
 */
const CREDS = "\u00A4";

function CreditPredictionBlock({ prediction }: { prediction: CreditPrediction | null | undefined }) {
  if (!prediction) {
    return (
      <p className="text-xs text-[#9AA3AC]">
        This backend isn&apos;t reporting a credit prediction yet.
      </p>
    );
  }

  const { predicted_credits, readings, filter_enabled, votable_count, total_weapons } = prediction;
  const hasReading = predicted_credits !== null && predicted_credits !== undefined;

  // The history that outlives a buy-phase reset. An empty window on its own
  // says nothing about whether OCR works, and reading it as "broken" is
  // exactly the wrong conclusion between rounds - which is most of a match.
  const last = prediction.last_reading;
  const lastCredits = last?.credits ?? null;

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold tabular-nums text-[#34f5c5]">
          {hasReading ? `${CREDS}${predicted_credits}` : "No reading yet"}
        </span>
        <span className="text-xs uppercase tracking-widest text-[#9AA3AC]">
          {filter_enabled
            ? `${votable_count} / ${total_weapons} weapons in budget`
            : `Filter off - all ${total_weapons} votable`}
        </span>
      </div>

      {hasReading && prediction.spendable_credits !== undefined && prediction.spendable_credits !== null && (
        <p className="mt-1 text-xs text-[#9AA3AC]">
          {CREDS}
          {prediction.spendable_credits} for a gun after {CREDS}
          {prediction.reserved_credits} held back for{" "}
          {prediction.pistol_round ? "a light shield" : "shields and abilities"}
          {prediction.agent ? ` (${prediction.agent}` : ""}
          {prediction.agent && prediction.agent_kit_cost !== null && prediction.agent_kit_cost !== undefined
            ? `, kit ${CREDS}${prediction.agent_kit_cost})`
            : prediction.agent
              ? ", no kit prices on file)"
              : ""}
          {prediction.pistol_round ? " · pistol round, so the sidearms stay on the wheel" : ""}
        </p>
      )}

      <p className="mt-1 text-xs text-[#9AA3AC]">
        {readings.length > 0
          ? `Window: ${readings.join(", ")} - the newest reading wins unless it rose without a second sighting, so the prediction is ${CREDS}${predicted_credits}.`
          : lastCredits !== null
            ? `Nothing this buy phase yet - last read ${CREDS}${lastCredits} ${formatAge(last?.age_seconds)}, so the pipeline itself is working. The roulette will open the full roster until the next buy menu.`
            : "Nothing has been read since this backend started - the roulette will open the full roster."}
      </p>

      {filter_enabled && hasReading && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {prediction.votable_weapons.map((weapon) => (
            <span
              key={weapon}
              className="rounded border border-[#34f5c5]/20 px-2 py-0.5 text-xs text-[#ECE8E1]"
            >
              {weapon}{" "}
              <span className="tabular-nums text-[#9AA3AC]">
                {CREDS}
                {prediction.weapon_creds_costs[weapon]}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * What the wheel is doing, and what it last landed on.
 *
 * The last result is the reason this block exists at all. It outlives its
 * session on purpose: "which gun am I being forced into" is asked during
 * the buy phase, after the overlay has spun and gone, and answering it
 * meant opening the stream on a second screen to watch a widget.
 */
function RouletteBlock({ roulette }: { roulette: RouletteStatus | null | undefined }) {
  if (!roulette) {
    return <p className="text-xs text-[#9AA3AC]">This backend isn&apos;t reporting the roulette yet.</p>;
  }

  const { active, last_result: result, forced_buy: forcedBuy } = roulette;

  if (active) {
    // Sorted by share rather than by vote count so this reads the same way
    // the wheel does - an unvoted weapon still occupies room on it.
    const leaders = Object.entries(active.wheel_shares)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const total = Object.values(active.wheel_shares).reduce((sum, share) => sum + share, 0);
    return (
      <div>
        <p className="text-sm font-semibold text-[#34f5c5]">
          Voting open · {Math.round(active.seconds_elapsed)}s in
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {leaders.map(([weapon, share]) => (
            <span
              key={weapon}
              className="rounded border border-[#34f5c5]/20 px-2 py-0.5 text-xs text-[#ECE8E1]"
            >
              {weapon}{" "}
              <span className="tabular-nums text-[#9AA3AC]">
                {total > 0 ? Math.round((100 * share) / total) : 0}%
              </span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <p className="text-xs text-[#9AA3AC]">
        No roulette has run since this backend started.
        {roulette.on_cooldown ? " On cooldown." : ""}
      </p>
    );
  }

  if (!result.winner) {
    return (
      <p className="text-sm text-[#9AA3AC]">
        Last roulette closed with no winner {formatAge(result.age_seconds)} - nothing to buy.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold uppercase tracking-wide text-[#34f5c5]">{result.winner}</span>
        <span className="text-xs uppercase tracking-widest text-[#9AA3AC]">
          {/*
            The badge's own state machine, which runs on a different clock
            from the result: queued for the next buy phase, active for the
            round, then cleared - while the result stays put.
          */}
          {forcedBuy.weapon === result.winner && forcedBuy.phase === "queued"
            ? "Buy this next round"
            : forcedBuy.weapon === result.winner && forcedBuy.phase === "active"
              ? "In play this round"
              : "Done"}
        </span>
      </div>
      <p className="mt-1 text-xs text-[#9AA3AC]">
        {result.randomly_picked
          ? `Nobody voted, so the wheel picked it - ${formatAge(result.age_seconds)}.`
          : `${result.winner_share_percent}% of the wheel from ${result.total_votes} vote${
              result.total_votes === 1 ? "" : "s"
            } - ${formatAge(result.age_seconds)}.`}
      </p>
    </div>
  );
}

/**
 * Live game state from the Overwolf app, and the reason it is rendered
 * beside the OCR reading rather than instead of it: this is the pipeline
 * that could delete `credit_ocr.py`, and the only way to earn that is to
 * be right next to the number it would replace for a few real sessions.
 *
 * The two credit figures are NOT the same quantity and the panel says so
 * rather than inviting a silent comparison - Valorant's "min next round"
 * is a projection, Overwolf's `money` is the current balance, and they
 * agree only during a buy phase.
 */
function GameEventsBlock({ game }: { game: GameEventsStatus | null | undefined }) {
  if (!game) {
    return <p className="text-xs text-[#9AA3AC]">This backend isn&apos;t reporting live game state.</p>;
  }

  if (!game.connected) {
    return (
      <>
        <LiveBadge value={false} up="Reporting" down="Not running" />
        <p className="mt-1 text-xs text-[#9AA3AC]">
          {game.last_snapshot_age_seconds === null
            ? "Nothing heard since the backend started - the Overwolf app isn't running on the gaming PC, or its secret doesn't match."
            : `Last snapshot ${formatAge(game.last_snapshot_age_seconds)}, past the ${game.snapshot_timeout_seconds}s cutoff.`}
        </p>
      </>
    );
  }

  if (!game.game_running) {
    return (
      <>
        <LiveBadge value={true} up="Reporting" down="Not running" />
        <p className="mt-1 text-xs text-[#9AA3AC]">Overwolf is up, Valorant isn&apos;t running.</p>
      </>
    );
  }

  const score = game.score;
  return (
    <>
      <LiveBadge value={true} up="Reporting" down="Not running" />
      <p className="mt-1 text-xs text-[#ECE8E1]">
        {game.round_phase ? (
          <>
            <span className="uppercase tracking-widest text-[#34f5c5]">{game.round_phase}</span>
            {game.round_number ? ` · round ${game.round_number}` : ""}
            {score && score.won !== null ? ` · ${score.won}–${score.lost}` : ""}
          </>
        ) : (
          "In the menus - no round in progress."
        )}
      </p>
      <p className="mt-1 text-xs text-[#9AA3AC]">
        {game.money !== null
          ? `${CREDS}${game.money} in hand right now`
          : "No credits reported"}
        {game.agent ? ` · ${game.agent}` : ""}
        {game.map ? ` · ${game.map}` : ""}
      </p>
      {/*
        Said out loud, because two credit numbers on one panel that differ
        by a thousand look like a bug unless somebody explains that they
        are answers to different questions.
      */}
      <p className="mt-1 text-xs text-[#9AA3AC]">
        Current balance, not the &quot;min next round&quot; figure below - the two only agree during a buy phase.
      </p>
    </>
  );
}

export function StatusPanel() {
  const { status, loading, error, refresh } = useAdminStatus();

  return (
    <div className="rounded border border-[#34f5c5]/20 bg-[#151F2B] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm uppercase tracking-widest text-[#ECE8E1]">System Status</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-widest text-[#9AA3AC]">
            Auto every {Math.round(STATUS_POLL_INTERVAL_MS / 1000)}s
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="text-xs uppercase tracking-widest text-[#34f5c5]/70 hover:text-[#34f5c5] disabled:opacity-40"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/*
        Kept above the values rather than replacing them: a failed poll
        during a backend restart shouldn't blank a panel whose last known
        answers are still the most useful thing on screen.
      */}
      {error && (
        <p className="mb-4 text-sm text-[#B8323F]">
          {status
            ? "Couldn't reach the backend on the last check - the values below are from before that."
            : "Couldn't reach the backend - try refreshing."}
        </p>
      )}

      {status && (
        <div className="grid grid-cols-2 gap-4 text-sm text-[#ECE8E1]">
          <div>
            <p className="text-[#9AA3AC]">Streamer.bot</p>
            <StatusBadge value={status.streamerbot_connected} />
            {status.streamerbot_connected && status.streamerbot_subscribed === false && (
              <p className="mt-1 text-xs text-[#B8323F]">
                Connected, but no event subscription - no chat command can fire.
              </p>
            )}
            {status.streamerbot_connected && status.streamerbot_authenticated === false && (
              <p className="mt-1 text-xs text-[#B8323F]">
                Authentication refused - check streamerbot_ws_password. Chat replies won&apos;t send.
              </p>
            )}
          </div>
          <div>
            <p className="text-[#9AA3AC]">Widget connections</p>
            <p className="font-semibold">{status.widget_connections.total} total</p>
            <p className="text-xs text-[#9AA3AC]">
              Roulette: {status.widget_connections.roulette} · Badge: {status.widget_connections.badge} · Spotify:{" "}
              {status.widget_connections.spotify}
            </p>
          </div>
          <div>
            <p className="text-[#9AA3AC]">OCR agent (gaming PC)</p>
            <OcrAgentBlock agent={status.ocr_agent} />
          </div>
          <div>
            <p className="text-[#9AA3AC]">OBS WebSocket</p>
            <StatusBadge value={status.obs_websocket_connected} />
          </div>
          <div>
            <p className="text-[#9AA3AC]">Live game (Overwolf)</p>
            <GameEventsBlock game={status.game_events} />
          </div>
          <div className="col-span-2">
            <p className="text-[#9AA3AC]">Public URL / Cloudflare Tunnel</p>
            <PublicUrlBlock publicUrl={status.public_url} />
          </div>
        </div>
      )}

      {status && (
        <div className="mt-6 border-t border-[#34f5c5]/20 pt-4">
          <p className="mb-2 text-sm text-[#9AA3AC]">Forced buy</p>
          <RouletteBlock roulette={status.roulette} />
        </div>
      )}

      {status && (
        <div className="mt-6 border-t border-[#34f5c5]/20 pt-4">
          <p className="mb-2 text-sm text-[#9AA3AC]">Next-round credits</p>
          <CreditPredictionBlock prediction={status.credit_prediction} />
        </div>
      )}
    </div>
  );
}
