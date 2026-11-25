import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useHome } from "./useHome";
import { editorBackend } from "./testUtils";

describe("useHome", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads the three lists, and reports the server's error", async () => {
    const home = { vods_ready: [{ id: 1 }], deletes_to_confirm: [], open_edits: [] };
    editorBackend({ "/home": home });
    const { result } = renderHook(() => useHome());
    await waitFor(() => expect(result.current.home).toEqual(home));

    editorBackend({ "/home": { status: 500, body: { error: "database is locked" } } });
    const failed = renderHook(() => useHome());
    await waitFor(() => expect(failed.result.current.error).toBe("database is locked"));
  });

  it("shows an empty open list from an older backend that sends open_tapes", async () => {
    editorBackend({ "/home": { vods_ready: [], deletes_to_confirm: [], open_tapes: [] } });
    const { result } = renderHook(() => useHome());
    await waitFor(() => expect(result.current.home?.open_edits).toEqual([]));
  });
});
