import { describe, expect, it, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useTape } from "./useTape";
import { editorBackend } from "./testUtils";

describe("useTape", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads the tape and its versions, and keeps the server's answer to a PATCH", async () => {
    const fetchMock = editorBackend({
      "/tapes/5": { tape: { id: 5, name: "Main", status: "cutting" }, iterations: [{ id: 3, version: 1 }] },
      "PATCH /tapes/5": (body: unknown) => ({ id: 5, name: "Main", status: (body as { status: string }).status }),
    });
    const { result } = renderHook(() => useTape(5));
    await waitFor(() => expect(result.current.tape?.name).toBe("Main"));
    expect(result.current.iterations).toHaveLength(1);

    await act(() => result.current.update({ status: "in_review" }));
    expect(result.current.tape?.status).toBe("in_review");
    const [, init] = fetchMock.mock.calls[1];
    expect(init).toMatchObject({ method: "PATCH", body: '{"status":"in_review"}' });
  });

  it("throws a refused PATCH so the view can show it", async () => {
    editorBackend({
      "/tapes/5": { tape: { id: 5, status: "final" }, iterations: [] },
      "PATCH /tapes/5": { status: 403, body: { error: "Only the streamer can do this." } },
    });
    const { result } = renderHook(() => useTape(5));
    await waitFor(() => expect(result.current.tape).not.toBeNull());
    await expect(result.current.update({ status: "cutting" })).rejects.toThrow("Only the streamer can do this.");
    expect(result.current.tape?.status).toBe("final");
  });
});
