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

  it("isNew counts someone else's edit since the last visit, never one's own or an older one", async () => {
    editorBackend({ "/iterations/7": { comments: [c({})] }, "POST /iterations/7/seen": { previous_seen_at: 150 } });
    const { result } = renderHook(() => useComments(7, { role: "editor", username: "me" }, { schedule: noTimer }));
    await waitFor(() => expect(result.current.isNew({ author: "x", created_at: 100, updated_at: 200 })).toBe(true));
    expect(result.current.isNew({ author: "x", created_at: 100, updated_at: 120 })).toBe(false);
    expect(result.current.isNew({ author: "x", created_at: 100, updated_at: 100 })).toBe(false);
    expect(result.current.isNew({ author: "me", created_at: 100, updated_at: 200 })).toBe(false);
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

  it("keeps the sent placeholder until the reloaded list has the comment", async () => {
    let finish!: () => void;
    let gets = 0;
    const back = editorBackend({ "POST /iterations/7/seen": { previous_seen_at: null }, "POST /iterations/7/comments": { id: 9 } });
    global.fetch = ((u: string, i?: RequestInit) => {
      if (i?.method === "GET" && u.endsWith("/iterations/7") && ++gets > 1)
        return new Promise((res) => (finish = () => res({ ok: true, status: 200, json: async () => ({ comments: [c({ id: 9 })] }) })));
      return back(u, i);
    }) as unknown as typeof fetch;
    const { result } = renderHook(() => useComments(7, { role: "admin", username: "me" }, { schedule: noTimer }));
    await waitFor(() => expect(gets).toBe(1));
    let sending!: Promise<void>;
    act(() => void (sending = result.current.add({ kind: "fix", body: "hi", start_s: 3, end_s: null })));
    await waitFor(() => expect(gets).toBe(2));
    expect(result.current.unsent).toHaveLength(1);
    expect(result.current.comments).toHaveLength(0);
    await act(async () => {
      finish();
      await sending;
    });
    expect(result.current.unsent).toHaveLength(0);
    expect(result.current.comments).toHaveLength(1);
  });

  it("never sends or shows another person's queued entries, and drops a reused client_id with the message", async () => {
    localStorage.setItem("editor.unsent", JSON.stringify([
      { client_id: "a".repeat(32), kind: "comment", iterationId: 7, payload: { body: "theirs" }, created_at: 1, username: "streamer" },
    ]));
    const back = editorBackend({
      "/iterations/7": { comments: [] },
      "POST /iterations/7/seen": { previous_seen_at: null },
      "POST /iterations/7/comments": { status: 409, body: { error: "client_id already used" } },
    });
    const { result } = renderHook(() => useComments(7, { role: "editor", username: "cutter" }, { schedule: noTimer }));
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current.unsent).toHaveLength(0);
    expect(back.mock.calls.some((x) => x[1]?.method === "POST" && String(x[0]).endsWith("/comments"))).toBe(false);
    await act(() => result.current.add({ kind: "fix", body: "mine", start_s: null, end_s: null }));
    expect(result.current.failed[0].message).toBe("client_id already used");
    expect(JSON.parse(localStorage.getItem("editor.unsent")!).map((e: { username: string }) => e.username)).toEqual(["streamer"]);
  });
});
