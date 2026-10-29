import { beforeEach, describe, expect, it, vi } from "vitest";
import { enqueue, flush, list, newClientId, remove, type Entry } from "./unsentQueue";

const e = (id: string): Entry => ({ client_id: id, kind: "comment", iterationId: 1, payload: { body: id }, created_at: 1 });

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
    });
    expect(seen).toEqual(["a", "b"]);
    expect(list().map((x) => x.client_id)).toEqual(["b", "c"]);
    await flush(async () => "sent");
    expect(list()).toEqual([]);
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
    await flush(send);
    expect(send).toHaveBeenCalledTimes(1);
    remove("m");
    expect(list()).toEqual([]);
  });

  it("makes 32-hex client ids", () => {
    expect(newClientId()).toMatch(/^[0-9a-f]{32}$/);
  });
});
