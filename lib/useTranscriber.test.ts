import { describe, expect, it, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { TRANSCRIBER_POLL_MS, useTranscriber } from "./useTranscriber";
import { editorBackend } from "./testUtils";

const S = { enabled: true, auto: false, last_seen: 5, queued: 1, running: 1 };

describe("useTranscriber", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reads the switches and queue", async () => {
    editorBackend({ "/transcriber": S });
    const { result } = renderHook(() => useTranscriber());
    await waitFor(() => expect(result.current.enabled).toBe(true));
    expect(result.current).toMatchObject({ auto: false, lastSeen: 5, queued: 1, running: 1, error: null });
  });

  it("polls every 30 s only while visible", async () => {
    vi.useFakeTimers();
    const fetchMock = editorBackend({ "/transcriber": S });
    renderHook(() => useTranscriber());
    await act(() => vi.advanceTimersByTimeAsync(TRANSCRIBER_POLL_MS));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(() => vi.advanceTimersByTimeAsync(TRANSCRIBER_POLL_MS * 3));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("drops a poll that started before a flip, so the flip is not undone by stale data", async () => {
    let answerPoll: (v: unknown) => void = () => {};
    let gets = 0;
    global.fetch = vi.fn((_url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "PUT")
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ...S, enabled: true }) });
      gets++;
      if (gets === 1) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ...S, enabled: false }) });
      return new Promise((res) => (answerPoll = res)); // the second poll hangs until we answer it
    }) as unknown as typeof fetch;
    vi.useFakeTimers();
    const { result } = renderHook(() => useTranscriber());
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.enabled).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(TRANSCRIBER_POLL_MS)); // poll 2 starts and hangs
    await act(async () => {
      await result.current.setEnabled(true);
    });
    expect(result.current.enabled).toBe(true);
    await act(async () => {
      answerPoll({ ok: true, status: 200, json: () => Promise.resolve({ ...S, enabled: false }) });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.enabled).toBe(true); // the stale "Paused" answer was dropped
  });
});
