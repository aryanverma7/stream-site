import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePointsTool } from "./usePointsTool";
import { asFetchMock } from "./testUtils";

describe("usePointsTool", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("checkBalance() returns the balance on success", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ username: "someviewer", points: 500 }) }),
    );

    const { result } = renderHook(() => usePointsTool());

    await act(async () => {
      await result.current.checkBalance("someviewer");
    });

    expect(result.current.balanceResult).toEqual({ username: "someviewer", points: 500 });
    expect(result.current.balanceError).toBeNull();
  });

  it("checkBalance() surfaces the real backend error on a realistic 502 (no Streamlabs token configured yet)", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ error: "streamlabs_access_token is empty" }),
      }),
    );

    const { result } = renderHook(() => usePointsTool());

    await act(async () => {
      await result.current.checkBalance("someviewer");
    });

    expect(result.current.balanceError).toBe("streamlabs_access_token is empty");
    expect(result.current.balanceResult).toBeNull();
  });

  it("grantPoints() sends the correct username and amount, and returns the new balance", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ username: "someviewer", granted: 100, new_balance: 600 }),
    });
    global.fetch = asFetchMock(fetchMock);

    const { result } = renderHook(() => usePointsTool());

    await act(async () => {
      await result.current.grantPoints("someviewer", 100);
    });

    expect(result.current.grantResult).toEqual({ username: "someviewer", granted: 100, new_balance: 600 });
    expect(fetchMock).toHaveBeenCalledWith("/api/points/grant", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "someviewer", amount: 100 }),
    });
  });

  it("grantPoints() surfaces an error without crashing when the grant fails", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ ok: false, status: 502, json: () => Promise.resolve({ error: "Streamlabs API error" }) }),
    );

    const { result } = renderHook(() => usePointsTool());

    await act(async () => {
      await result.current.grantPoints("someviewer", 100);
    });

    expect(result.current.grantError).toBe("Streamlabs API error");
    expect(result.current.grantResult).toBeNull();
  });

  it("balance and grant state are independent of each other", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ username: "a", points: 10 }) })
      .mockResolvedValueOnce({ ok: false, status: 502, json: () => Promise.resolve({ error: "grant failed" }) });
    global.fetch = asFetchMock(fetchMock);

    const { result } = renderHook(() => usePointsTool());

    await act(async () => {
      await result.current.checkBalance("a");
    });
    await act(async () => {
      await result.current.grantPoints("a", 50);
    });

    // The successful balance lookup shouldn't be wiped out just because a
    // later, unrelated grant call failed.
    expect(result.current.balanceResult).toEqual({ username: "a", points: 10 });
    expect(result.current.grantError).toBe("grant failed");
  });
});
