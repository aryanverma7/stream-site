import { describe, expect, it, vi, afterEach } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { PointsTool } from "./PointsTool";
import { asFetchMock } from "@/lib/testUtils";

describe("PointsTool", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("looks up a balance and displays the result", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ username: "someviewer", points: 500 }) }),
    );

    const { container, getByText } = render(<PointsTool />);
    const balanceInput = container.querySelectorAll('input[placeholder="username"]')[0];
    fireEvent.change(balanceInput, { target: { value: "someviewer" } });
    fireEvent.click(getByText("Check"));

    await waitFor(() => expect(container.textContent).toContain("500"));
    expect(container.textContent).toContain("someviewer");
  });

  it("disables the Check button until a username is entered", () => {
    global.fetch = asFetchMock(vi.fn());
    const { getByText } = render(<PointsTool />);

    expect(getByText("Check")).toBeDisabled();
  });

  it("grants points and shows the new balance", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ username: "someviewer", granted: 100, new_balance: 600 }),
    });
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
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ error: "streamlabs_access_token is empty" }),
      }),
    );

    const { container, getByText } = render(<PointsTool />);
    const balanceInput = container.querySelectorAll('input[placeholder="username"]')[0];
    fireEvent.change(balanceInput, { target: { value: "someviewer" } });
    fireEvent.click(getByText("Check"));

    await waitFor(() => expect(getByText(/streamlabs_access_token is empty/i)).toBeTruthy());
  });
});
