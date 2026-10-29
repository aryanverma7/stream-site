import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { asFetchMock, editorBackend } from "./testUtils";
import { useComments, type Comment } from "./useComments";

const c = (over: Partial<Comment>): Comment => ({
  id: 1, kind: "fix", author: "cutter", body: "x", start_s: 10, end_s: null, created_at: 100, updated_at: 100,
  resolved: false, carried: false, origin_iteration_id: 7, origin_version: 3, replies: [], ...over,
});
const noTimer = () => () => {};

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("useComments", () => {
  it("queues while the backend is down, then sends once on online with the same client_id", async () => {
    const table = { "/iterations/7": { comments: [] }, "POST /iterations/7/seen": { previous_seen_at: null }, "POST /iterations/7/comments": { id: 9 } };
    const up = editorBackend(table);
    const { result } = renderHook(() => useComments(7, { role: "admin", username: "me" }, { schedule: noTimer }));
    await waitFor(() => expect(up).toHaveBeenCalled());
    global.fetch = asFetchMock(vi.fn(() => Promise.reject(new TypeError("down"))));
    await act(() => result.current.add({ kind: "fix", body: "hi", start_s: 3, end_s: null }));
    expect(result.current.unsent).toHaveLength(1);
    const id = result.current.unsent[0].client_id;

    const back = editorBackend(table);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(result.current.unsent).toHaveLength(0));
    const sent = back.mock.calls.filter((x) => x[1]?.method === "POST" && String(x[0]).endsWith("/comments"));
    expect(sent).toHaveLength(1);
    expect(JSON.parse(String(sent[0][1]?.body)).client_id).toBe(id);
  });

  it("isNew follows previous_seen_at and the author, replies included", async () => {
    editorBackend({ "/iterations/7": { comments: [c({})] }, "POST /iterations/7/seen": { previous_seen_at: 150 } });
    const { result } = renderHook(() => useComments(7, { role: "editor", username: "me" }, { schedule: noTimer }));
    await waitFor(() => expect(result.current.comments).toHaveLength(1));
    await waitFor(() => expect(result.current.isNew({ author: "x", created_at: 200 })).toBe(true));
    expect(result.current.isNew({ author: "x", created_at: 100 })).toBe(false);
    expect(result.current.isNew({ author: "me", created_at: 200 })).toBe(false);
  });

  it("surfaces a 403 on resolve, and drops a 4xx send with the message", async () => {
    editorBackend({
      "/iterations/7": { comments: [] },
      "POST /iterations/7/seen": { previous_seen_at: null },
      "PUT /iterations/7/comments/1/resolved": { status: 403, body: { error: "Only the streamer can do this." } },
      "POST /iterations/7/comments": { status: 400, body: { error: "body is empty" } },
    });
    const { result } = renderHook(() => useComments(7, { role: "editor", username: "me" }, { schedule: noTimer }));
    await act(() => result.current.setResolved(1, true));
    expect(result.current.error).toBe("Only the streamer can do this.");
    await act(() => result.current.add({ kind: "fix", body: "q", start_s: null, end_s: null }));
    expect(result.current.failed[0].message).toBe("body is empty");
    expect(result.current.unsent).toHaveLength(0);
  });

  it("keeps a 401 entry in the queue and does not report it as failed", async () => {
    editorBackend({
      "/iterations/7": { comments: [] },
      "POST /iterations/7/seen": { previous_seen_at: null },
      "POST /iterations/7/comments": { status: 401, body: { error: "Sign in" } },
    });
    const { result } = renderHook(() => useComments(7, { role: "editor", username: "me" }, { schedule: noTimer }));
    await act(() => result.current.add({ kind: "fix", body: "q", start_s: null, end_s: null }));
    expect(result.current.unsent).toHaveLength(1);
    expect(result.current.failed).toHaveLength(0);
  });
});
