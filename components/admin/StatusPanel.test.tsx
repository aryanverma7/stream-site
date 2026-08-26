import { describe, expect, it, vi, afterEach } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { StatusPanel } from "./StatusPanel";
import { asFetchMock } from "@/lib/testUtils";

const mockStatus = {
  streamerbot_connected: true,
  widget_connections: { total: 2, roulette: 1, badge: 0, spotify: 1 },
  obs_websocket_connected: null,
  ocr_loop_running: null,
  cloudflare_tunnel_up: false,
};

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
});
