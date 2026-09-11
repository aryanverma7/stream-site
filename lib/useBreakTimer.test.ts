import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useBreakTimer } from "./useBreakTimer";
import { asFetchMock } from "@/lib/testUtils";

const IDLE = {
  active: false,
  duration_seconds: 0,
  remaining_seconds: 0,
  overdue: false,
  message: "",
  default_minutes: 10,
};

const RUNNING = { ...IDLE, active: true, duration_seconds: 600, remaining_seconds: 540, message: "brb" };

describe("useBreakTimer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the current break on mount", async () => {
    global.fetch = asFetchMock(vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(RUNNING) }));
    const { result } = renderHook(() => useBreakTimer());

    await waitFor(() => expect(result.current.state?.active).toBe(true));
    expect(result.current.state?.remaining_seconds).toBe(540);
  });

  it("starts a break with an action verb, not a state write", async () => {
    // "start" has to mean restart-from-now, which a PUT carrying the same
    // duration twice could not express.
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(RUNNING) });
    global.fetch = asFetchMock(fetchMock);
    const { result } = renderHook(() => useBreakTimer());

    await act(async () => {
      await result.current.start(10, "brb");
    });

    const post = fetchMock.mock.calls.find((call) => call[1]?.method === "POST");
    expect(JSON.parse(post![1].body)).toEqual({ action: "start", minutes: 10, message: "brb" });
  });

  it("surfaces the backend's own refusal rather than a generic failure", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockImplementation((_url: string, init?: { method?: string }) =>
        init?.method === "POST"
          ? Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: "minutes must be greater than zero" }) })
          : Promise.resolve({ ok: true, json: () => Promise.resolve(IDLE) }),
      ),
    );
    const { result } = renderHook(() => useBreakTimer());

    await act(async () => {
      await result.current.start(0, "");
    });

    await waitFor(() => expect(result.current.error).toMatch(/greater than zero/));
  });

  it("keeps the last known state when a poll fails", async () => {
    // A dropped poll mid-break must not erase the number the streamer is
    // reading to decide whether to add five minutes.
    let calls = 0;
    global.fetch = asFetchMock(
      vi.fn().mockImplementation(() => {
        calls++;
        return calls === 1
          ? Promise.resolve({ ok: true, json: () => Promise.resolve(RUNNING) })
          : Promise.reject(new Error("network"));
      }),
    );
    const { result } = renderHook(() => useBreakTimer());

    await waitFor(() => expect(result.current.state?.active).toBe(true));
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.state?.active).toBe(true);
    expect(result.current.error).toBeTruthy();
  });
});
