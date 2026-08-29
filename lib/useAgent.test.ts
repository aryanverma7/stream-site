import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAgent } from "./useAgent";
import { asFetchMock } from "./testUtils";

const AGENTS = {
  current: "jett",
  agents: [
    { name: "cypher", kit_cost: 600 },
    { name: "jett", kit_cost: 900 },
  ],
};

function respondingWith(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 502, json: () => Promise.resolve(body) });
}

describe("useAgent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the selected agent and the priced roster", async () => {
    global.fetch = asFetchMock(respondingWith(AGENTS));

    const { result } = renderHook(() => useAgent());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.current).toBe("jett");
    expect(result.current.agents).toHaveLength(2);
  });

  it("reports the selected agent's kit cost, which is what gets reserved", async () => {
    global.fetch = asFetchMock(respondingWith(AGENTS));

    const { result } = renderHook(() => useAgent());

    await waitFor(() => expect(result.current.kitCost).toBe(900));
  });

  it("reports no kit cost when the agent has no prices on file", async () => {
    // Null, never zero - zero would read as "this agent's abilities are
    // free", which would hand the whole credit budget to the gun.
    global.fetch = asFetchMock(
      respondingWith({ current: "someagent", agents: [{ name: "someagent", kit_cost: null }] }),
    );

    const { result } = renderHook(() => useAgent());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.kitCost).toBeNull();
  });

  it("sets the agent and keeps the new answer", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(AGENTS) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agent: "cypher", kit_cost: 600 }),
      });
    global.fetch = asFetchMock(fetchMock);

    const { result } = renderHook(() => useAgent());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.setAgent("cypher");
    });

    expect(result.current.current).toBe("cypher");
    expect(result.current.kitCost).toBe(600);
    expect(fetchMock).toHaveBeenCalledWith("/api/agents", expect.objectContaining({ method: "POST" }));
  });

  it("adds an agent the price table never had rather than dropping it", async () => {
    // A new agent ships with no entry. Refusing to name them until
    // somebody edits a table would be worse than reserving a rough number
    // under the right name.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(AGENTS) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ agent: "someagent", kit_cost: null }),
      });
    global.fetch = asFetchMock(fetchMock);

    const { result } = renderHook(() => useAgent());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.setAgent("someagent");
    });

    expect(result.current.current).toBe("someagent");
    expect(result.current.agents.map((a) => a.name)).toContain("someagent");
    expect(result.current.kitCost).toBeNull();
  });

  it("reports an error rather than rendering an empty roster silently", async () => {
    // A backend older than this build has no /api/agents at all.
    global.fetch = asFetchMock(respondingWith({}, false));

    const { result } = renderHook(() => useAgent());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.agents).toEqual([]);
  });

  it("leaves the selection alone when a save fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(AGENTS) })
      .mockResolvedValueOnce({ ok: false, status: 502, json: () => Promise.resolve({}) });
    global.fetch = asFetchMock(fetchMock);

    const { result } = renderHook(() => useAgent());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.setAgent("cypher");
    });

    expect(result.current.current).toBe("jett");
    expect(result.current.error).toBeTruthy();
  });
});
