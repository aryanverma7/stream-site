import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { TRANSCRIPT_POLL_MS, useTranscript } from "./useTranscript";
import { editorBackend } from "./testUtils";

describe("useTranscript", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("polls every 15 s while waiting and stops once done", async () => {
    vi.useFakeTimers();
    let status = "queued";
    const fetchMock = editorBackend({ "/iterations/3/transcript": () => ({ status, segments: status === "done" ? [] : null, error: null }) });
    const { result } = renderHook(() => useTranscript(3));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.status).toBe("queued");
    status = "done";
    await act(() => vi.advanceTimersByTimeAsync(TRANSCRIPT_POLL_MS));
    expect(result.current.status).toBe("done");
    const calls = fetchMock.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(TRANSCRIPT_POLL_MS * 3));
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("a refused request shows the server's error", async () => {
    editorBackend({
      "/iterations/3/transcript": { status: "none", segments: null, error: null },
      "POST /iterations/3/transcript": { status: 409, body: { error: "This version is not ready" } },
    });
    const { result } = renderHook(() => useTranscript(3));
    await act(() => result.current.request());
    expect(result.current.error).toBe("This version is not ready");
  });
});
