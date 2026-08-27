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
  ocr_loop_running: null,
  cloudflare_tunnel_up: false,
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
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockStatus) }),
    );
    const { getByText } = render(<StatusPanel />);

    await waitFor(() => expect(getByText("Disconnected")).toBeTruthy());
  });

  it("shows 'Not yet implemented' for a null status value, not a confusing blank", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockStatus) }),
    );
    const { getAllByText } = render(<StatusPanel />);

    await waitFor(() => expect(getAllByText(/not yet implemented/i).length).toBe(2)); // obs + ocr
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
});
