import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { AdminDashboard } from "./AdminDashboard";
import { asFetchMock } from "@/lib/testUtils";

describe("AdminDashboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the Status tab by default", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            streamerbot_connected: true,
            widget_connections: { total: 0, roulette: 0, badge: 0, spotify: 0 },
            obs_websocket_connected: null,
            ocr_loop_running: null,
            cloudflare_tunnel_up: null,
          }),
      }),
    );

    const { getByText } = render(<AdminDashboard />);
    await waitFor(() => expect(getByText("System Status")).toBeTruthy());
  });

  it("switches to the Logs tab when clicked", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ lines: [] }) }),
    );

    const { getByText, getAllByText } = render(<AdminDashboard />);
    fireEvent.click(getAllByText("Logs")[0]);

    await waitFor(() => expect(getByText("Backend Logs")).toBeTruthy());
  });

  it("switches to the Config tab and loads the real config editor", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ http_port: 8765 }) }),
    );

    const { getByText } = render(<AdminDashboard />);
    fireEvent.click(getByText("Config"));

    await waitFor(() => expect(getByText("Config Editor")).toBeTruthy());
  });

  it("switches to the Points tab and shows the real points tool", () => {
    // AdminDashboard mounts StatusPanel by default (the initial active tab),
    // so its own fetch fires immediately regardless of which tab this test
    // is actually targeting - the mock needs a valid resolved response for
    // ANY call, not just the one this test cares about.
    global.fetch = asFetchMock(vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));

    const { getByText } = render(<AdminDashboard />);
    fireEvent.click(getByText("Points"));

    expect(getByText("Check Balance")).toBeTruthy();
    expect(getByText("Grant Points (testing)")).toBeTruthy();
  });
});
