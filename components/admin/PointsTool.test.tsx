import { describe, expect, it, vi, afterEach } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { PointsTool } from "./PointsTool";
import { asFetchMock } from "@/lib/testUtils";

/**
 * PointsTool reads /api/status on mount to show which points ledger is
 * live, so every mock here has to answer that call as well as the points
 * one - a single canned response for all URLs would hand the ledger
 * lookup a balance payload.
 */
function mockFetch(
  pointsResponse: unknown,
  opts: { ok?: boolean; status?: number; backend?: string | null } = {},
) {
  const { ok = true, status = 200, backend = "api" } = opts;
  return vi.fn().mockImplementation((url: string) => {
    if (url === "/api/status") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(backend === null ? {} : { points_backend: backend }),
      });
    }
    return Promise.resolve({ ok, status, json: () => Promise.resolve(pointsResponse) });
  });
}

describe("PointsTool", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("looks up a balance and displays the result", async () => {
    global.fetch = asFetchMock(mockFetch({ username: "someviewer", points: 500 }));

    const { container, getByText } = render(<PointsTool />);
    const balanceInput = container.querySelectorAll('input[placeholder="username"]')[0];
    fireEvent.change(balanceInput, { target: { value: "someviewer" } });
    fireEvent.click(getByText("Check"));

    await waitFor(() => expect(container.textContent).toContain("500"));
    expect(container.textContent).toContain("someviewer");
  });

  it("disables the Check button until a username is entered", () => {
    global.fetch = asFetchMock(mockFetch(null));
    const { getByText } = render(<PointsTool />);

    expect(getByText("Check")).toBeDisabled();
  });

  it("grants points and shows the new balance", async () => {
    const fetchMock = mockFetch({ username: "someviewer", granted: 100, new_balance: 600 });
    global.fetch = asFetchMock(fetchMock);

    const { getByText, container } = render(<PointsTool />);
    const grantUsernameInput = container.querySelectorAll('input[placeholder="username"]')[1];
    fireEvent.change(grantUsernameInput, { target: { value: "someviewer" } });
    fireEvent.click(getByText("Grant"));

    await waitFor(() => expect(container.textContent).toContain("600"));
    expect(fetchMock).toHaveBeenCalledWith("/api/points/grant", expect.objectContaining({ method: "POST" }));
  });

  it("shows a realistic error (e.g. no Streamlabs token yet) without crashing", async () => {
    global.fetch = asFetchMock(
      mockFetch({ error: "streamlabs_access_token is empty" }, { ok: false, status: 502 }),
    );

    const { container, getByText } = render(<PointsTool />);
    const balanceInput = container.querySelectorAll('input[placeholder="username"]')[0];
    fireEvent.change(balanceInput, { target: { value: "someviewer" } });
    fireEvent.click(getByText("Check"));

    await waitFor(() => expect(getByText(/streamlabs_access_token is empty/i)).toBeTruthy());
  });

  describe("ledger switch", () => {
    it("offers the Cloudbot ledger alongside the other two", async () => {
      global.fetch = asFetchMock(mockFetch(null, { backend: "cloudbot" }));

      const { getByText } = render(<PointsTool />);

      await waitFor(() => expect(getByText("Cloudbot")).toHaveAttribute("aria-pressed", "true"));
      // Cloudbot and the REST API are the same wallet reached two ways;
      // only the local file is a different set of numbers.
      expect(getByText("Streamlabs API")).toHaveAttribute("aria-pressed", "false");
      expect(getByText("Local file")).toHaveAttribute("aria-pressed", "false");
    });

    it("marks the live ledger as the selected one", async () => {
      global.fetch = asFetchMock(mockFetch(null, { backend: "local" }));

      const { getByText } = render(<PointsTool />);

      await waitFor(() => expect(getByText("Local file")).toHaveAttribute("aria-pressed", "true"));
      expect(getByText("Streamlabs API")).toHaveAttribute("aria-pressed", "false");
    });

    it("switching sends only points_backend, so it can't clobber a secret", async () => {
      const fetchMock = mockFetch(null, { backend: "api" });
      global.fetch = asFetchMock(fetchMock);

      const { getByText } = render(<PointsTool />);
      await waitFor(() => expect(getByText("Streamlabs API")).toHaveAttribute("aria-pressed", "true"));

      fireEvent.click(getByText("Local file"));

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/config",
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ points_backend: "local" }),
          }),
        ),
      );
      await waitFor(() => expect(getByText("Local file")).toHaveAttribute("aria-pressed", "true"));
    });

    it("warns that the local ledger is not viewers' real points", async () => {
      global.fetch = asFetchMock(mockFetch(null, { backend: "local" }));

      const { container } = render(<PointsTool />);

      await waitFor(() => expect(container.textContent).toContain("Not what !points reports"));
    });

    it("says so plainly when the backend is too old to report a ledger", async () => {
      global.fetch = asFetchMock(mockFetch(null, { backend: null }));

      const { container } = render(<PointsTool />);

      await waitFor(() =>
        expect(container.textContent).toContain("isn't reporting a points ledger"),
      );
    });
  });
});
