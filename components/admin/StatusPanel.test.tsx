import { describe, expect, it, vi, afterEach } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { StatusPanel } from "./StatusPanel";
import { asFetchMock } from "@/lib/testUtils";

// Deliberately has NO credit_prediction key - this is what a backend that
// hasn't been updated yet sends, and the panel has to stay renderable on
// it rather than printing undefineds.
const mockStatus = {
  streamerbot_connected: true,
  widget_connections: { total: 2, roulette: 1, badge: 0, spotify: 1 },
  obs_websocket_connected: null,
};

const liveAgent = {
  connected: true,
  last_heartbeat_age_seconds: 4,
  last_capture_age_seconds: 90,
  last_accepted_age_seconds: 95,
  captures_received: 40,
  captures_accepted: 12,
  heartbeat_timeout_seconds: 45,
  tesseract_available: true,
};

const reachablePublicUrl = {
  reachable: true,
  url: "https://hub.dualbladex.org/health",
  detail: "The public URL reaches this backend.",
  checked_age_seconds: 12,
};

const pistolRoundPrediction = {
  predicted_credits: 900,
  readings: [1400, 900, 900],
  filter_enabled: true,
  votable_count: 5,
  total_weapons: 18,
  votable_weapons: ["classic", "shorty", "frenzy", "ghost", "sheriff"],
  weapon_creds_costs: { classic: 0, shorty: 300, frenzy: 450, ghost: 500, sheriff: 800 },
};

function statusWithPrediction(overrides: Record<string, unknown> = {}) {
  return { ...mockStatus, credit_prediction: { ...pistolRoundPrediction, ...overrides } };
}

function mockFetchOf(body: unknown) {
  global.fetch = asFetchMock(vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }));
}

function rouletteResult(overrides: Record<string, unknown> = {}) {
  return {
    active: null,
    last_result: {
      winner: "vandal",
      randomly_picked: false,
      final_weights: { vandal: 3, phantom: 0 },
      wheel_shares: { vandal: 4, phantom: 1 },
      predicted_credits: 4500,
      platform: "twitch",
      age_seconds: 12,
      winner_share_percent: 80,
      total_votes: 3,
      ...overrides,
    },
    forced_buy: { weapon: "vandal", phase: "queued" },
    on_cooldown: true,
  };
}

const liveGame = {
  connected: true,
  last_snapshot_age_seconds: 3,
  snapshot_timeout_seconds: 45,
  app_version: "1.0.0",
  game_running: true,
  round_phase: "shopping",
  round_number: 7,
  score: { won: 4, lost: 2 },
  match_outcome: null,
  map: "ascent",
  game_mode: "competitive",
  agent: "cypher",
  money: 4200,
};

describe("StatusPanel live game", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the round phase, score and current credits", async () => {
    mockFetchOf({ ...mockStatus, game_events: liveGame });
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText("shopping")).toBeTruthy());
    expect(getByText(/round 7/)).toBeTruthy();
    expect(getByText(/4200 in hand right now/)).toBeTruthy();
  });

  it("says the two credit numbers are different questions", async () => {
    // Two figures a thousand apart on one panel read as a bug unless
    // something explains that one is a projection and one is a balance.
    mockFetchOf({
      ...mockStatus,
      game_events: liveGame,
      credit_prediction: { ...pistolRoundPrediction, predicted_credits: 5800 },
    });
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/only agree during a buy phase/)).toBeTruthy());
  });

  it("separates Overwolf being down from Valorant not running", async () => {
    mockFetchOf({
      ...mockStatus,
      game_events: { ...liveGame, game_running: false, round_phase: null },
    });
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/Valorant isn't running/)).toBeTruthy());
  });

  it("says nothing has been heard rather than showing a stale round", async () => {
    mockFetchOf({
      ...mockStatus,
      game_events: { ...liveGame, connected: false, last_snapshot_age_seconds: null },
    });
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/Overwolf app isn't running/)).toBeTruthy());
  });

  it("degrades on a backend that doesn't report it", async () => {
    mockFetchOf(mockStatus);
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/isn't reporting live game state/)).toBeTruthy());
  });
});

describe("StatusPanel forced buy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("names the weapon the wheel landed on", async () => {
    mockFetchOf({ ...mockStatus, roulette: rouletteResult() });
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText("vandal")).toBeTruthy());
    expect(getByText(/80% of the wheel from 3 votes/)).toBeTruthy();
  });

  it("says whether the weapon is still to be bought or already in play", async () => {
    mockFetchOf({ ...mockStatus, roulette: rouletteResult() });
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText("Buy this next round")).toBeTruthy());
  });

  it("keeps showing the winner after the badge has been cleared", async () => {
    // The whole reason the result is separate state. The badge's life is
    // two buy phases; the answer to "what am I buying" is still wanted
    // after that, and used to require opening the stream to find.
    mockFetchOf({
      ...mockStatus,
      roulette: { ...rouletteResult(), forced_buy: { weapon: null, phase: null } },
    });
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText("vandal")).toBeTruthy());
    expect(getByText("Done")).toBeTruthy();
  });

  it("says a voteless result was the wheel's own pick, not chat's", async () => {
    mockFetchOf({
      ...mockStatus,
      roulette: rouletteResult({ randomly_picked: true, total_votes: 0, final_weights: {} }),
    });
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/Nobody voted/)).toBeTruthy());
  });

  it("shows the running wheel while voting is open", async () => {
    mockFetchOf({
      ...mockStatus,
      roulette: {
        active: {
          weights: { vandal: 2, phantom: 0 },
          wheel_shares: { vandal: 3, phantom: 1 },
          predicted_credits: 4500,
          platform: "twitch",
          seconds_elapsed: 6,
        },
        last_result: null,
        forced_buy: { weapon: null, phase: null },
        on_cooldown: false,
      },
    });
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/Voting open/)).toBeTruthy());
    expect(getByText(/75%/)).toBeTruthy();
  });

  it("degrades to a plain line on a backend that doesn't report the roulette", async () => {
    mockFetchOf(mockStatus);
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/isn't reporting the roulette yet/)).toBeTruthy());
  });
});

describe("StatusPanel budget breakdown", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows what is left for a gun after shields and abilities", async () => {
    // The raw reading is what the streamer sees in game, so a roster built
    // from a smaller number looks wrong without this line.
    mockFetchOf(
      statusWithPrediction({
        predicted_credits: 4500,
        spendable_credits: 2900,
        reserved_credits: 1600,
        pistol_round: false,
        agent: "cypher",
        agent_kit_cost: 600,
      }),
    );
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/2900 for a gun after/)).toBeTruthy());
    expect(getByText(/cypher, kit/)).toBeTruthy();
  });

  it("says an agent has no prices on file rather than printing a zero", async () => {
    mockFetchOf(
      statusWithPrediction({
        predicted_credits: 4500,
        spendable_credits: 3100,
        reserved_credits: 1400,
        pistol_round: false,
        agent: "clove",
        agent_kit_cost: null,
      }),
    );
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/no kit prices on file/)).toBeTruthy());
  });

  it("says a pistol round is a pistol round", async () => {
    mockFetchOf(
      statusWithPrediction({
        spendable_credits: 500,
        reserved_credits: 400,
        pistol_round: true,
      }),
    );
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/sidearms stay on the wheel/)).toBeTruthy());
  });
});

describe("StatusPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows Connected for a true status value", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockStatus) }),
    );
    const { getAllByText } = render(<StatusPanel />);

    await waitFor(() => expect(getAllByText("Connected").length).toBeGreaterThan(0));
  });

  it("shows Disconnected for a false status value", async () => {
    mockFetchOf({ ...mockStatus, streamerbot_connected: false });
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText("Disconnected")).toBeTruthy());
  });

  it("shows 'Not yet implemented' for a null status value, not a confusing blank", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockStatus) }),
    );
    const { getAllByText } = render(<StatusPanel />);

    // Only OBS is still a placeholder - the OCR agent and the public URL
    // both report for real now.
    await waitFor(() => expect(getAllByText(/not yet implemented/i).length).toBe(1));
  });

  it("shows an error message when the backend can't be reached", async () => {
    global.fetch = asFetchMock(vi.fn().mockRejectedValue(new Error("network error")));
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/couldn't reach the backend/i)).toBeTruthy());
  });

  it("clicking Refresh triggers a new fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockStatus) });
    global.fetch = asFetchMock(fetchMock);

    const { getByText } = render(<StatusPanel />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(getByText("Refresh"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
  it("shows the predicted credits and how much of the roster they cover", async () => {
    mockFetchOf(statusWithPrediction());
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText("\u00A4900")).toBeTruthy());
    expect(getByText("5 / 18 weapons in budget")).toBeTruthy();
  });

  it("shows the reading window, so a bad prediction can be traced to its readings", async () => {
    mockFetchOf(statusWithPrediction());
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/window: 1400, 900, 900/i)).toBeTruthy());
  });

  it("lists the in-budget weapons with their creds cost", async () => {
    mockFetchOf(statusWithPrediction());
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText("sheriff")).toBeTruthy());
    expect(getByText("\u00A4800")).toBeTruthy();
    // A weapon nobody can afford this round must not be listed.
    expect(() => getByText("vandal")).toThrow();
  });

  it("says so plainly when OCR has no reading yet, rather than showing a bogus number", async () => {
    mockFetchOf(
      statusWithPrediction({
        predicted_credits: null,
        readings: [],
        votable_count: 18,
        votable_weapons: [],
        weapon_creds_costs: {},
      }),
    );
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText("No reading yet")).toBeTruthy());
    expect(getByText(/full roster/i)).toBeTruthy();
  });

  it("says the filter is off rather than implying a budget is being enforced", async () => {
    mockFetchOf(statusWithPrediction({ filter_enabled: false, votable_count: 18 }));
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText("Filter off - all 18 votable")).toBeTruthy());
  });

  it("stays renderable against a backend that doesn't send a prediction at all", async () => {
    mockFetchOf(mockStatus);
    const { getByText, container } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/isn't reporting a credit prediction/i)).toBeTruthy());
    expect(container.innerHTML).not.toContain("undefined");
  });
  it("warns when Streamer.bot is connected but has no event subscription", async () => {
    mockFetchOf({ ...mockStatus, streamerbot_connected: true, streamerbot_subscribed: false });
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/no event subscription/i)).toBeTruthy());
  });

  it("does not warn about the subscription once Streamer.bot has accepted it", async () => {
    mockFetchOf({ ...mockStatus, streamerbot_connected: true, streamerbot_subscribed: true });
    const { getAllByText, queryByText } = render(<StatusPanel />);

    await waitFor(() => expect(getAllByText("Connected").length).toBeGreaterThan(0));
    expect(queryByText(/no event subscription/i)).toBeNull();
  });

  it("does not warn about the subscription against a backend that doesn't report it", async () => {
    mockFetchOf(mockStatus);
    const { getAllByText, queryByText } = render(<StatusPanel />);

    await waitFor(() => expect(getAllByText("Connected").length).toBeGreaterThan(0));
    expect(queryByText(/no event subscription/i)).toBeNull();
  });

  it("warns when Streamer.bot refused the authentication", async () => {
    mockFetchOf({ ...mockStatus, streamerbot_connected: true, streamerbot_authenticated: false });
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/Authentication refused/i)).toBeTruthy());
  });

  it("does not warn about authentication when the server never asked for any", async () => {
    // null, not false: Streamer.bot's Authentication toggle is simply off,
    // which is not a failure and must not be flagged as one.
    mockFetchOf({ ...mockStatus, streamerbot_connected: true, streamerbot_authenticated: null });
    const { getAllByText, queryByText } = render(<StatusPanel />);

    await waitFor(() => expect(getAllByText("Connected").length).toBeGreaterThan(0));
    expect(queryByText(/Authentication refused/i)).toBeNull();
  });

  it("does not warn about authentication against a backend that doesn't report it", async () => {
    mockFetchOf(mockStatus);
    const { getAllByText, queryByText } = render(<StatusPanel />);

    await waitFor(() => expect(getAllByText("Connected").length).toBeGreaterThan(0));
    expect(queryByText(/Authentication refused/i)).toBeNull();
  });

  it("shows the OCR agent as connected, with how much of what it sent was readable", async () => {
    mockFetchOf({ ...mockStatus, ocr_agent: liveAgent });
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/12\/40 captures read/)).toBeTruthy());
    expect(getByText(/Last seen 4s ago/)).toBeTruthy();
  });

  it("reports the agent as seen recently on captures alone, with no heartbeat", async () => {
    // An agent build older than the heartbeat sends captures and nothing
    // else. Calling that "never seen" while it is actively working would
    // send someone hunting a problem that isn't there.
    mockFetchOf({
      ...mockStatus,
      ocr_agent: { ...liveAgent, last_heartbeat_age_seconds: null, last_capture_age_seconds: 3 },
    });
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/Last seen 3s ago/)).toBeTruthy());
  });

  it("says plainly when the agent has never reported at all", async () => {
    mockFetchOf({
      ...mockStatus,
      ocr_agent: {
        ...liveAgent,
        connected: false,
        last_heartbeat_age_seconds: null,
        last_capture_age_seconds: null,
        last_accepted_age_seconds: null,
        captures_received: 0,
        captures_accepted: 0,
      },
    });
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/Nothing heard since the backend started/i)).toBeTruthy());
  });

  it("names the cutoff when the agent went quiet after being seen", async () => {
    mockFetchOf({
      ...mockStatus,
      ocr_agent: { ...liveAgent, connected: false, last_heartbeat_age_seconds: 300, last_capture_age_seconds: null },
    });
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/past the 45s cutoff/i)).toBeTruthy());
  });

  it("flags a missing Tesseract even while the agent is happily connected", async () => {
    // The nastiest of the three: the agent runs, the network works, and
    // every single capture comes back 503.
    mockFetchOf({ ...mockStatus, ocr_agent: { ...liveAgent, tesseract_available: false } });
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/Tesseract isn't where the Mac Mini expects it/i)).toBeTruthy());
  });

  it("shows the public URL as reachable, with when it was last checked", async () => {
    mockFetchOf({ ...mockStatus, public_url: reachablePublicUrl });
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText("Reachable")).toBeTruthy());
    expect(getByText("The public URL reaches this backend.")).toBeTruthy();
    expect(getByText(/Checked 12s ago/)).toBeTruthy();
  });

  it("shows the backend's own explanation when the public URL can't be reached", async () => {
    mockFetchOf({
      ...mockStatus,
      public_url: {
        reachable: false,
        url: "https://hub.dualbladex.org/health",
        detail: "No answer from https://hub.dualbladex.org/health within 8s - the tunnel is most likely down.",
        checked_age_seconds: 3,
      },
    });
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText("Unreachable")).toBeTruthy());
    expect(getByText(/the tunnel is most likely down/i)).toBeTruthy();
  });

  it("does not call an unconfigured public URL a failure", async () => {
    // null, not false - the same rule the Streamer.bot authentication row
    // follows. Nothing is broken; there is simply no address to try.
    mockFetchOf({
      ...mockStatus,
      public_url: {
        reachable: null,
        url: null,
        detail: "public_base_url isn't set in config.json, so there's nothing to check.",
        checked_age_seconds: null,
      },
    });
    const { getByText, queryByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText("Not checked")).toBeTruthy());
    expect(queryByText("Unreachable")).toBeNull();
  });

  it("says 'Not reporting' for the new rows against an older backend", async () => {
    // mockStatus carries neither key, which is exactly what a Mac Mini
    // running yesterday's backend sends.
    mockFetchOf(mockStatus);
    const { getAllByText } = render(<StatusPanel />);

    await waitFor(() => expect(getAllByText("Not reporting").length).toBe(2));
  });
});

describe("StatusPanel auto-refresh", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tells you it is refreshing on its own, so nobody sits there clicking", async () => {
    mockFetchOf(mockStatus);
    const { getByText } = render(<StatusPanel />);
    await waitFor(() => expect(getByText(/Auto every 5s/i)).toBeTruthy());
  });

  it("keeps the values on screen when a later check fails, and says they are stale", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockStatus) })
      .mockRejectedValue(new Error("backend restarting"));
    global.fetch = asFetchMock(fetchMock);

    const { getByText, getAllByText } = render(<StatusPanel />);
    await waitFor(() => expect(getAllByText("Connected").length).toBeGreaterThan(0));

    fireEvent.click(getByText("Refresh"));

    await waitFor(() => expect(getByText(/values below are from before that/i)).toBeTruthy());
    expect(getAllByText("Connected").length).toBeGreaterThan(0);
  });
});

describe("StatusPanel credit history between buy phases", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("an empty window with an earlier reading says the pipeline works", async () => {
    // The reported symptom, from the other side. Between rounds the window
    // is legitimately empty, and rendering that as bare "No reading yet"
    // is indistinguishable from OCR having never worked at all.
    mockFetchOf(
      statusWithPrediction({
        predicted_credits: null,
        readings: [],
        last_reading: { credits: 3900, age_seconds: 240 },
      }),
    );
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText(/last read/i)).toBeTruthy());
    expect(getByText(/3900/)).toBeTruthy();
    expect(getByText(/4m ago/)).toBeTruthy();
    expect(getByText(/pipeline itself is working/i)).toBeTruthy();
  });

  it("an empty window with no earlier reading at all says exactly that instead", async () => {
    mockFetchOf(
      statusWithPrediction({
        predicted_credits: null,
        readings: [],
        last_reading: { credits: null, age_seconds: null },
      }),
    );
    const { getByText, queryByText } = render(<StatusPanel />);

    await waitFor(() =>
      expect(getByText(/Nothing has been read since this backend started/i)).toBeTruthy(),
    );
    expect(queryByText(/last read/i)).toBeNull();
  });

  it("a backend too old to send last_reading still renders the never-read line", async () => {
    mockFetchOf(statusWithPrediction({ predicted_credits: null, readings: [] }));
    const { getByText } = render(<StatusPanel />);
    await waitFor(() =>
      expect(getByText(/Nothing has been read since this backend started/i)).toBeTruthy(),
    );
  });

  it("a live window still wins over the remembered reading", async () => {
    mockFetchOf(statusWithPrediction({ last_reading: { credits: 3900, age_seconds: 240 } }));
    const { getByText, queryByText } = render(<StatusPanel />);
    await waitFor(() => expect(getByText(/Window: 1400, 900, 900/)).toBeTruthy());
    expect(queryByText(/last read/i)).toBeNull();
  });

  it("explains the window by the rule the backend actually applies", async () => {
    // The line is read while deciding whether a reading looks wrong, so a
    // stale description of the rule would send someone hunting a bug that
    // isn't there. credit_ocr takes the newest reading outright on the way
    // down and only makes a RISE wait for a second sighting (finding #8),
    // so neither "the lowest wins" nor a flat "the window has to agree"
    // describes what the number on screen came from.
    mockFetchOf(statusWithPrediction());
    const { getByText, queryByText } = render(<StatusPanel />);
    await waitFor(() =>
      expect(getByText(/the newest reading wins unless it rose without a second sighting/i)).toBeTruthy(),
    );
    expect(queryByText(/the lowest wins/i)).toBeNull();
    expect(queryByText(/the newest value the window agrees on wins/i)).toBeNull();
  });
});
