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
});
