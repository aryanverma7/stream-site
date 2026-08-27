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
    // The line is read while deciding whether a reading looks wrong, so it
    // saying "the lowest wins" while credit_ocr picks the newest
    // corroborated value would send someone hunting a bug that isn't there.
    mockFetchOf(statusWithPrediction());
    const { getByText, queryByText } = render(<StatusPanel />);
    await waitFor(() => expect(getByText(/the newest value the window agrees on wins/i)).toBeTruthy());
    expect(queryByText(/the lowest wins/i)).toBeNull();
  });
});
