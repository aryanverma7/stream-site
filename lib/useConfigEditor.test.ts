import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useConfigEditor } from "./useConfigEditor";
import { asFetchMock } from "./testUtils";

const SCHEMA = { sections: ["General"], fields: { http_port: { section: "General", label: "Port", kind: "number" } } };
const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: () => Promise.resolve(body) });

function route(opts: { schemaStatus?: number; configStatus?: number; putStatus?: number; putBody?: unknown } = {}) {
  return vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === "PUT") return Promise.resolve(json(opts.putStatus ?? 200, opts.putBody ?? { status: "ok" }));
    if (url === "/api/config/schema") return Promise.resolve(json(opts.schemaStatus ?? 200, SCHEMA));
    return Promise.resolve(json(opts.configStatus ?? 200, { http_port: 8765 }));
  });
}
const count = (m: ReturnType<typeof route>, method: string) =>
  m.mock.calls.filter((c) => (c[1]?.method ?? "GET") === method).length;

describe("useConfigEditor", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads config and schema together", async () => {
    global.fetch = asFetchMock(route());
    const { result } = renderHook(() => useConfigEditor());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config).toEqual({ http_port: 8765 });
    expect(result.current.schema).toEqual(SCHEMA);
    expect(result.current.schemaMissing).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it("a 404 schema sets schemaMissing without an error", async () => {
    global.fetch = asFetchMock(route({ schemaStatus: 404 }));
    const { result } = renderHook(() => useConfigEditor());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.schemaMissing).toBe(true);
    expect(result.current.schema).toBeNull();
    expect(result.current.error).toBe(false);
    expect(result.current.config).toEqual({ http_port: 8765 });
  });

  it("sets error when the config fetch fails", async () => {
    global.fetch = asFetchMock(route({ configStatus: 401 }));
    const { result } = renderHook(() => useConfigEditor());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
  });

  it("save reports the backend's field-level error", async () => {
    global.fetch = asFetchMock(
      route({ putStatus: 400, putBody: { error: "Must be 15 seconds or more", field: "discord_live_poll_seconds" } }),
    );
    const { result } = renderHook(() => useConfigEditor());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.save({ discord_live_poll_seconds: 5 });
    });
    expect(result.current.saveSuccess).toBe(false);
    expect(result.current.saveError).toBe("Must be 15 seconds or more");
    expect(result.current.saveErrorField).toBe("discord_live_poll_seconds");
  });

  it("save re-fetches after success", async () => {
    const m = route();
    global.fetch = asFetchMock(m);
    const { result } = renderHook(() => useConfigEditor());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.save({ http_port: 9000 });
    });
    expect(result.current.saveSuccess).toBe(true);
    expect(count(m, "GET")).toBe(4);
    expect(count(m, "PUT")).toBe(1);
    expect(m).toHaveBeenCalledWith("/api/config", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ http_port: 9000 }),
    });
  });
});
