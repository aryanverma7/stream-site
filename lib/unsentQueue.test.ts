import { beforeEach, describe, expect, it, vi } from "vitest";
import { claim, enqueue, flush, list, newClientId, remove, type Entry } from "./unsentQueue";

const e = (id: string, username = "me"): Entry => ({ client_id: id, kind: "comment", iterationId: 1, payload: { body: id }, created_at: 1, username });

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("unsentQueue", () => {
  it("survives a reload and keeps insertion order", async () => {
    enqueue(e("a"));
    enqueue(e("b"));
    vi.resetModules();
    const fresh = await import("./unsentQueue");
    expect(fresh.list().map((x) => x.client_id)).toEqual(["a", "b"]);
    expect(localStorage.getItem("editor.unsent")).toContain('"a"');
  });

  it("stops at the first retry, in order; sent and dropped entries leave", async () => {
    ["a", "b", "c"].forEach((id) => enqueue(e(id)));
    const seen: string[] = [];
    await flush(async (x) => {
      seen.push(x.client_id);
      return x.client_id === "a" ? "drop" : "retry";
    }, "me");
    expect(seen).toEqual(["a", "b"]);
    expect(list().map((x) => x.client_id)).toEqual(["b", "c"]);
    await flush(async () => "sent", "me");
    expect(list()).toEqual([]);
  });

  it("sends only the signed-in person's entries and leaves the others", async () => {
    enqueue(e("a", "streamer"));
    enqueue(e("b", "cutter"));
    enqueue({ ...e("c"), username: undefined });
    const seen: string[] = [];
    await flush(async (x) => (seen.push(x.client_id), "sent"), "cutter");
    expect(seen).toEqual(["b"]);
    expect(list().map((x) => x.client_id)).toEqual(["a", "c"]);
  });

  it("still sends when storage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    enqueue(e("m"));
    const send = vi.fn(async () => "sent" as const);
    await flush(send, "me");
    expect(send).toHaveBeenCalledTimes(1);
    remove("m");
    expect(list()).toEqual([]);
  });

  it("keeps and sends entries when only setItem throws", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    enqueue(e("q"));
    expect(list().map((x) => x.client_id)).toEqual(["q"]);
    const send = vi.fn(async () => "sent" as const);
    await flush(send, "me");
    expect(send).toHaveBeenCalledTimes(1);
    expect(list()).toEqual([]);
  });

  it("makes 32-hex client ids", () => {
    expect(newClientId()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("claim names an unnamed entry, never re-owns a named one", () => {
    enqueue({ client_id: "a", kind: "comment", iterationId: 1, payload: {}, created_at: 1 });
    enqueue({ client_id: "b", kind: "comment", iterationId: 1, payload: {}, created_at: 2, username: "streamer" });
    claim("a", "cutter");
    claim("b", "cutter");
    expect(list().map((e) => e.username)).toEqual(["cutter", "streamer"]);
  });
});
