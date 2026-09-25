"use client";

import {
  STATUS_POLL_INTERVAL_MS,
  useAdminStatus,
  type CreditPrediction,
  type GameEventsStatus,
  type OcrAgentStatus,
  type PublicUrlStatus,
  type SpotifyStatus,
  type RouletteStatus,
  type AdminStatus,
} from "@/lib/useAdminStatus";

/** Signal strength, drawn: four bars for a healthy feed, none for a
    lost one. Carries the state in form so it never rests on colour. */
function SignalBars({ level }: { level: 0 | 1 | 2 | 3 | 4 }) {
  return (
    <svg viewBox="0 0 20 14" className="h-3.5 w-5 shrink-0" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={i * 5}
          y={10 - i * 3}
          width="3.5"
          height={4 + i * 3}
          fill="currentColor"
          opacity={i < level ? 1 : 0.22}
        />
      ))}
    </svg>
  );
}

function Badge({ tone, children }: { tone: "up" | "down" | "none"; children: React.ReactNode }) {
  const style = {
    up: "text-signal",
    down: "text-rec",
    none: "text-dim",
  }[tone];
  return (
    <span className={`label inline-flex items-center gap-2 text-sm ${style}`}>
      <SignalBars level={tone === "up" ? 4 : 0} />
      {children}
    </span>
  );
}

function StatusBadge({ value }: { value: boolean | null }) {
  if (value === null) {
    return <Badge tone="none">Not yet implemented</Badge>;
  }
  return <Badge tone={value ? "up" : "down"}>{value ? "Connected" : "Disconnected"}</Badge>;
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
    return <Badge tone="none">Not reporting</Badge>;
  }
  if (value === null) {
    return <Badge tone="none">{unknown}</Badge>;
  }
  return <Badge tone={value ? "up" : "down"}>{value ? up : down}</Badge>;
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
        <p className="mt-1.5 text-[13px] leading-snug text-dim">
          Last seen {formatAge(lastSeen)} · {agent.captures_accepted}/{agent.captures_received} captures read
        </p>
      ) : (
        <p className="mt-1.5 text-[13px] leading-snug text-rec">
          {lastSeen === null
            ? "Nothing heard since the backend started - agent.py isn't running on the gaming PC, or its secret doesn't match."
            : `Last seen ${formatAge(lastSeen)}, past the ${agent.heartbeat_timeout_seconds}s cutoff.`}
        </p>
      )}
      {!agent.tesseract_available && (
        <p className="mt-1.5 text-[13px] leading-snug text-rec">
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
        className={`mt-1.5 text-[13px] leading-snug ${publicUrl.reachable === false ? "text-rec" : "text-dim"}`}
      >
        {publicUrl.detail}
      </p>
      {publicUrl.checked_age_seconds !== null && (
        <p className="mt-1.5 text-[13px] leading-snug text-dim">Checked {formatAge(publicUrl.checked_age_seconds)}</p>
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
      <p className="text-xs text-dim">
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
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="stencil text-5xl tabular-nums text-field">
          {hasReading ? `${CREDS}${predicted_credits}` : "No reading yet"}
        </span>
        <span className="label text-xs text-dim">
          {filter_enabled
            ? `${votable_count} / ${total_weapons} weapons in budget`
            : `Filter off - all ${total_weapons} votable`}
        </span>
      </div>

      {hasReading && prediction.spendable_credits !== undefined && prediction.spendable_credits !== null && (
        <p className="mt-1.5 text-[13px] leading-snug text-dim">
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

      <p className="mt-1.5 text-[13px] leading-snug text-dim">
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
              className="border border-seam bg-ink px-2 py-1 text-xs font-semibold text-phosphor"
            >
              {weapon}{" "}
              <span className="tabular-nums text-dim">
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
    return <p className="text-xs text-dim">This backend isn&apos;t reporting the roulette yet.</p>;
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
        <p className="osd text-2xl text-field">
          Voting open · {Math.round(active.seconds_elapsed)}s in
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {leaders.map(([weapon, share]) => (
            <span
              key={weapon}
              className="border border-seam bg-ink px-2 py-1 text-xs font-semibold text-phosphor"
            >
              {weapon}{" "}
              <span className="tabular-nums text-dim">
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
      <p className="text-xs text-dim">
        No roulette has run since this backend started.
        {roulette.on_cooldown ? " On cooldown." : ""}
      </p>
    );
  }

  if (!result.winner) {
    return (
      <p className="text-sm text-dim">
        Last roulette closed with no winner {formatAge(result.age_seconds)} - nothing to buy.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="stencil text-6xl text-field">{result.winner}</span>
        <span className="label bg-field px-2 py-1 text-xs text-ink">
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
      <p className="mt-1.5 text-[13px] leading-snug text-dim">
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
    return <p className="text-xs text-dim">This backend isn&apos;t reporting live game state.</p>;
  }

  if (!game.connected) {
    return (
      <>
        <LiveBadge value={false} up="Reporting" down="Not running" />
        <p className="mt-1.5 text-[13px] leading-snug text-dim">
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
        <p className="mt-1.5 text-[13px] leading-snug text-dim">Overwolf is up, Valorant isn&apos;t running.</p>
      </>
    );
  }

  const score = game.score;
  return (
    <>
      <LiveBadge value={true} up="Reporting" down="Not running" />
      <p className="mt-1.5 text-[13px] leading-snug text-phosphor">
        {game.round_phase ? (
          <>
            <span className="osd text-lg text-field">{game.round_phase}</span>
            {game.round_number ? ` · round ${game.round_number}` : ""}
            {score && score.won !== null ? ` · ${score.won}–${score.lost}` : ""}
          </>
        ) : (
          "In the menus - no round in progress."
        )}
      </p>
      <p className="mt-1.5 text-[13px] leading-snug text-dim">
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
      <p className="mt-1.5 text-[13px] leading-snug text-dim">
        Current balance, not the &quot;min next round&quot; figure below - the two only agree during a buy phase.
      </p>
    </>
  );
}

/**
 * Song requests.
 *
 * `configured` is the only one that matters and the others are settings -
 * without a refresh token none of them do anything, so a panel that
 * showed "enabled, 100 points" while nothing was connected would be
 * describing a feature that cannot run.
 */
function SpotifyBlock({ spotify }: { spotify: SpotifyStatus | null | undefined }) {
  if (!spotify) {
    return <p className="text-xs text-dim">This backend isn&apos;t reporting Spotify.</p>;
  }

  if (!spotify.configured) {
    return (
      <>
        <LiveBadge value={false} up="Connected" down="Not connected" />
        <p className="mt-1.5 text-[13px] leading-snug text-dim">
          Connect it from the Config tab - song requests do nothing until then.
        </p>
      </>
    );
  }

  // Premium is not optional for queueing, so a connected-but-free account
  // is a fault rather than a detail - and it is invisible from the chat
  // error, which is the same 403 a scope problem produces.
  const free = spotify.account_product !== undefined
    && spotify.account_product !== null
    && spotify.account_product !== "premium";

  return (
    <>
      <LiveBadge value={true} up="Connected" down="Not connected" />
      <p className="mt-1.5 text-[13px] leading-snug text-dim">
        {spotify.requests_enabled
          ? `!song costs ${spotify.request_cost} points`
          : "Requests are switched off in config"}
      </p>
      {spotify.missing_scopes !== undefined && spotify.missing_scopes.length > 0 && (
        <p className="mt-1.5 text-[13px] leading-snug text-rec">
          The Spotify login is missing {spotify.missing_scopes.join(", ")} — reconnect it from the
          Config tab. Song requests will be refused until you do.
        </p>
      )}
      {spotify.account_name && (
        <p className={`mt-1.5 text-[13px] leading-snug ${free ? "text-rec" : "text-dim"}`}>
          {free
            ? `Connected as ${spotify.account_name} — this account is “${spotify.account_product}”, not Premium. Queueing will fail.`
            : `Connected as ${spotify.account_name} (Premium)`}
        </p>
      )}
    </>
  );
}

type FeedState = "up" | "warn" | "down" | "off" | "unknown";

interface Feed {
  name: string;
  state: FeedState;
  wide?: boolean;
  body: React.ReactNode;
}

/**
 * Every system on the wall, with a state the summary can count. The rules
 * mirror what each block below already says in words: a socket that is
 * open but unsubscribed or refused is not "up", a free Spotify account is
 * a fault, and the parked Overwolf app not running is "off", not "down".
 */
function buildFeeds(status: AdminStatus): Feed[] {
  const sb: FeedState = !status.streamerbot_connected
    ? "down"
    : status.streamerbot_subscribed === false || status.streamerbot_authenticated === false
      ? "warn"
      : "up";

  const ocr = status.ocr_agent;
  const ocrState: FeedState = !ocr ? "unknown" : !ocr.connected ? "down" : !ocr.tesseract_available ? "warn" : "up";

  const obs: FeedState =
    status.obs_websocket_connected === null ? "unknown" : status.obs_websocket_connected ? "up" : "down";

  const game = status.game_events;
  const gameState: FeedState = !game ? "unknown" : !game.connected ? "off" : "up";

  const sp = status.spotify;
  const spFree =
    !!sp && sp.account_product !== undefined && sp.account_product !== null && sp.account_product !== "premium";
  const spState: FeedState = !sp
    ? "unknown"
    : !sp.configured
      ? "off"
      : spFree || (sp.missing_scopes?.length ?? 0) > 0
        ? "warn"
        : "up";

  const pu = status.public_url;
  const puState: FeedState = !pu || pu.reachable === null ? "unknown" : pu.reachable ? "up" : "down";

  return [
    {
      name: "Streamer.bot",
      state: sb,
      body: (
        <>
          <StatusBadge value={status.streamerbot_connected} />
          {status.streamerbot_connected && status.streamerbot_subscribed === false && (
            <p className="mt-2 text-xs text-rec">
              Connected, but no event subscription - no chat command can fire.
            </p>
          )}
          {status.streamerbot_connected && status.streamerbot_authenticated === false && (
            <p className="mt-2 text-xs text-rec">
              Authentication refused - check streamerbot_ws_password. Chat replies won&apos;t send.
            </p>
          )}
        </>
      ),
    },
    { name: "Public URL / Cloudflare Tunnel", state: puState, body: <PublicUrlBlock publicUrl={status.public_url} /> },
    { name: "OCR agent (gaming PC)", state: ocrState, body: <OcrAgentBlock agent={status.ocr_agent} /> },
    { name: "OBS WebSocket", state: obs, body: <StatusBadge value={status.obs_websocket_connected} /> },
    { name: "Spotify song requests", state: spState, body: <SpotifyBlock spotify={status.spotify} /> },
    { name: "Live game (Overwolf)", state: gameState, body: <GameEventsBlock game={status.game_events} /> },
  ];
}

const STRIP: Record<FeedState, string> = {
  up: "bg-bezel-2 text-phosphor",
  warn: "bg-amber text-ink",
  down: "bg-rec text-phosphor",
  off: "bg-bezel text-dim",
  unknown: "bg-bezel text-dim",
};

const STRIP_WORD: Record<FeedState, string> = {
  up: "OK",
  warn: "Check",
  down: "Lost",
  off: "Off",
  unknown: "No report",
};

function FeedTile({ feed, index }: { feed: Feed; index: number }) {
  return (
    <section
      aria-label={feed.name}
      className={`flex flex-col border bg-bezel ${
        feed.state === "down" ? "border-rec" : feed.state === "unknown" ? "border-dashed border-seam" : "border-seam"
      }`}
    >
      <div className={`osd flex items-center justify-between gap-3 px-3 py-1.5 text-lg ${STRIP[feed.state]}`}>
        <span className="truncate">
          {feed.name}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {feed.state === "down" && <span className="rec-dot inline-block h-2 w-2 rounded-full bg-phosphor" aria-hidden />}
          {STRIP_WORD[feed.state]}
        </span>
      </div>
      <div className={`crt relative flex-1 px-4 py-3 text-sm ${
          // A parked or silent feed is not an alarm: its red words go quiet.
          feed.state === "off" || feed.state === "unknown" ? "[&_.text-rec]:text-dim" : ""
        }`}>
        {feed.state === "down" && <div className="noise pointer-events-none absolute inset-0 opacity-10" aria-hidden />}
        <div className="relative">{feed.body}</div>
      </div>
    </section>
  );
}

/** The one line that answers "is anything broken" before any detail. */
const SUMMARY_STICKER = { lost: "/stickers/scared.png", warn: "/stickers/huh.png", ok: "/stickers/king.png" };

function Summary({ feeds }: { feeds: Feed[] }) {
  const lost = feeds.filter((f) => f.state === "down");
  const warn = feeds.filter((f) => f.state === "warn");
  const ok = feeds.filter((f) => f.state === "up").length;
  const quiet = feeds.length - ok - lost.length - warn.length;
  const trouble = [...lost, ...warn];

  return (
    <div
      className={`relative flex flex-wrap items-center gap-x-6 gap-y-2 py-3 pl-24 pr-4 sm:pl-28 ${
        lost.length > 0 ? "bg-rec text-phosphor" : warn.length > 0 ? "bg-amber text-ink" : "wallpaper"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, local sticker */}
      <img
        src={SUMMARY_STICKER[lost.length > 0 ? "lost" : warn.length > 0 ? "warn" : "ok"]}
        alt=""
        className="sticker absolute -top-3 left-3 w-16 rotate-[-8deg] sm:w-20"
      />
      <p className="stencil text-4xl">
        {lost.length > 0
          ? `${lost.length} feed${lost.length === 1 ? "" : "s"} lost`
          : warn.length > 0
            ? `${warn.length} to check`
            : "All feeds OK"}
      </p>
      <p className="osd flex flex-wrap gap-x-3 text-xl">
        <span className="whitespace-nowrap">{ok} ok</span>
        <span className="whitespace-nowrap">{warn.length} check</span>
        <span className="whitespace-nowrap">{lost.length} lost</span>
        <span className="whitespace-nowrap">{quiet} idle</span>
      </p>
      {trouble.length > 0 && (
        <p className="text-sm font-semibold">{trouble.map((f) => f.name).join(", ")}</p>
      )}
    </div>
  );
}

export function StatusPanel() {
  const { status, loading, error, refresh } = useAdminStatus();
  const feeds = status ? buildFeeds(status) : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="stencil text-5xl text-phosphor">System Status</h3>
        <div className="flex items-center gap-3">
          <span className="label text-xs text-dim">
            Auto every {Math.round(STATUS_POLL_INTERVAL_MS / 1000)}s
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="label border border-seam px-3 py-1.5 text-xs text-field transition-colors hover:border-field disabled:opacity-40"
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
        <p className="border border-rec bg-rec/10 px-4 py-3 text-sm text-rec">
          {status
            ? "Couldn't reach the backend on the last check - the values below are from before that."
            : "Couldn't reach the backend - try refreshing."}
        </p>
      )}

      {status && <Summary feeds={feeds} />}

      {status && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section aria-label="Forced buy" className="border border-seam bg-bezel">
            <p className="osd wallpaper px-3 py-1.5 text-lg">Forced buy</p>
            <div className="px-4 py-4">
              <RouletteBlock roulette={status.roulette} />
            </div>
          </section>
          <section aria-label="Next-round credits" className="border border-seam bg-bezel">
            <p className="osd wallpaper px-3 py-1.5 text-lg">Next-round credits</p>
            <div className="px-4 py-4">
              <CreditPredictionBlock prediction={status.credit_prediction} />
            </div>
          </section>
        </div>
      )}

      {status && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {feeds.map((feed, i) => (
            <FeedTile key={feed.name} feed={feed} index={i} />
          ))}
          <section aria-label="Widget connections" className="flex flex-col border border-seam bg-bezel">
            <p className="osd bg-bezel-2 px-3 py-1.5 text-lg text-phosphor">
              Widget connections
            </p>
            <div className="px-4 py-3 text-sm">
              <p className="stencil text-4xl text-phosphor">{status.widget_connections.total} total</p>
              <p className="mt-1.5 text-[13px] leading-snug text-dim">
                Roulette: {status.widget_connections.roulette} · Badge: {status.widget_connections.badge} · Spotify:{" "}
                {status.widget_connections.spotify}
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
