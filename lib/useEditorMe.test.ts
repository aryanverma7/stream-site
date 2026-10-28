import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useEditorMe } from "./useEditorMe";
import { asFetchMock } from "./testUtils";

describe("useEditorMe", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads who is signed in", async () => {
    const me = { username: "cutter", role: "editor", brand_kit_url: null };
    global.fetch = asFetchMock(vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(me) }));
    const { result } = renderHook(() => useEditorMe());

    expect(result.current.me).toBeNull();
    await waitFor(() => expect(result.current.me).toEqual(me));
    expect(result.current.error).toBeNull();
  });

  it("reports the server's error text", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({ error: "database is locked" }) }),
    );
    const { result } = renderHook(() => useEditorMe());
    await waitFor(() => expect(result.current.error).toBe("database is locked"));
    expect(result.current.me).toBeNull();
  });
});
