import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useProjects } from "./useProjects";
import { editorBackend } from "./testUtils";

const vod = (id: number, created_at: number) => ({ id, name: `VOD ${id}`, kind: "vod", created_at, reel_tape_id: null });
const clip = (id: number, created_at: number, reel: number) => ({ id, name: `Clip ${id}`, kind: "clip", created_at, reel_tape_id: reel });

describe("useProjects", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps VODs newest first, puts clips oldest first, and finds each clip's reel", async () => {
    const reel = { id: 50, name: "Combined", status: "cutting", project_id: 3, source_project_ids: [3, 4] };
    editorBackend({
      // As the backend sends them: newest first.
      "/projects": { projects: [clip(4, 40, 50), vod(2, 30), clip(3, 20, 50), vod(1, 10)] },
      "/projects/3": { tapes: [reel] },
      "/projects/4": { tapes: [] },
    });
    const { result } = renderHook(() => useProjects());

    await waitFor(() => expect(result.current.clips.map((c) => c.id)).toEqual([3, 4]));
    expect(result.current.vods.map((v) => v.id)).toEqual([2, 1]);
    expect(result.current.reels[50]).toEqual(reel);
    expect(result.current.error).toBeNull();
  });

  it("reports the server's error text", async () => {
    editorBackend({ "/projects": { status: 500, body: { error: "database is locked" } } });
    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.error).toBe("database is locked"));
  });
});
