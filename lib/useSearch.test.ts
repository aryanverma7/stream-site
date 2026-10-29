import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { editorBackend } from "./testUtils";
import { useSearch } from "./useSearch";

function fakeTimers() {
  const pending = new Map<number, () => void>();
  let n = 0;
  return {
    set: (fn: () => void) => (pending.set(++n, fn), n),
    clear: (id: unknown) => void pending.delete(id as number),
    fire: () => [...pending.values()].forEach((f) => f()),
    pending,
  };
}

describe("useSearch", () => {
  it("sends one request for a query typed quickly, after the debounce", async () => {
    const b = editorBackend({ "/search?q=jet": { hits: [{ comment_id: 1 }] } });
    const t = fakeTimers();
    const { result, rerender } = renderHook(({ q }) => useSearch(q, t), { initialProps: { q: "je" } });
    rerender({ q: "jet" });
    expect(b).not.toHaveBeenCalled();
    expect(t.pending.size).toBe(1);
    t.fire();
    await waitFor(() => expect(result.current.hits).toHaveLength(1));
    expect(b).toHaveBeenCalledTimes(1);
    expect(b.mock.calls[0][0]).toBe("/api/editor/search?q=jet");
  });

  it("sends nothing under two characters", () => {
    const b = editorBackend({});
    const t = fakeTimers();
    const { result } = renderHook(() => useSearch(" j ", t));
    expect(t.pending.size).toBe(0);
    expect(b).not.toHaveBeenCalled();
    expect(result.current).toEqual({ hits: [], loading: false, error: null });
  });

  it("reports an error", async () => {
    editorBackend({ "/search?q=zz": { status: 500, body: { error: "boom" } } });
    const t = fakeTimers();
    const { result } = renderHook(() => useSearch("zz", t));
    expect(result.current.loading).toBe(true);
    t.fire();
    await waitFor(() => expect(result.current.error).toBe("boom"));
    vi.restoreAllMocks();
  });
});
