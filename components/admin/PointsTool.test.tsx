import { describe, expect, it, vi, afterEach } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { PointsTool } from "./PointsTool";
import { asFetchMock } from "@/lib/testUtils";

/**
 * There is one points ledger now, so this panel no longer reads
 * /api/status to find out which - every call it makes is a points call.
 */
function mockFetch(pointsResponse: unknown, opts: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = opts;
  return vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(pointsResponse) });
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

  it("says so rather than showing a zero when the backend can't report a total", async () => {
    // The cloudbot backend's normal case: Cloudbot confirms the amount
    // added and there is no way to read a balance back. Rendering null as
    // "new balance: 0" would read as the grant having failed.
    global.fetch = asFetchMock(
      mockFetch({ username: "someviewer", granted: 100, new_balance: null }),
    );

    const { getByText, container } = render(<PointsTool />);
    const grantUsernameInput = container.querySelectorAll('input[placeholder="username"]')[1];
    fireEvent.change(grantUsernameInput, { target: { value: "someviewer" } });
    fireEvent.click(getByText("Grant"));

    await waitFor(() => expect(container.textContent).toContain("Granted 100"));
    expect(container.textContent).toContain("not reported by this backend");
    expect(container.textContent).not.toContain("new balance: 0");
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

});
