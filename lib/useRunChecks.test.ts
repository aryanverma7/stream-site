import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { editorBackend } from "./testUtils";
import * as checks from "./mediaChecks";
import { useRunChecks } from "./useRunChecks";

vi.mock("./mediaChecks", async (orig) => ({
  ...(await orig<typeof import("./mediaChecks")>()),
  measureMedia: vi.fn(async () => ({ width: 1920, height: 1080, duration_s: 10, fps: 60, bitrate_mbps: 55 })),
  thumbnail: vi.fn(async () => "QUJD"),
}));

const IT = { id: 4, version: 2, filename: "cut.mp4", size: 5 };
const file = (name = "cut.mp4", bytes = "12345") => new File([bytes], name);
const puts = (m: ReturnType<typeof editorBackend>) => m.mock.calls.filter(([u, i]) => u === "/api/editor/iterations/4/media" && i?.method === "PUT");

beforeEach(() => vi.mocked(checks.measureMedia).mockClear());

describe("useRunChecks", () => {
  it("measures the same file and PUTs graded checks and the thumbnail, then reports done", async () => {
    const m = editorBackend({ "PUT /iterations/4/media": { id: 4 } });
    const onDone = vi.fn();
    const { result } = renderHook(() => useRunChecks(IT, "reel", onDone));
    await act(() => result.current.run(file()));
    expect(puts(m)).toHaveLength(1);
    const body = JSON.parse(String(puts(m)[0][1]!.body));
    expect(body.thumbnail_b64).toBe("QUJD");
    expect(body.checks.fps).toEqual({ state: "pass", value: 60 });
    expect(body.checks.resolution.state).toBe("warn"); // graded as a reel (1080x1920)
    expect(onDone).toHaveBeenCalled();
    expect([result.current.running, result.current.error]).toEqual([false, null]);
  });

  it("refuses a file with another name or size, sending nothing", async () => {
    const m = editorBackend({});
    const { result } = renderHook(() => useRunChecks(IT, "tape"));
    await act(() => result.current.run(file("other.mp4")));
    expect(result.current.error).toBe("That is not v2's file: pick cut.mp4 (0.0 MB)");
    await act(() => result.current.run(file("cut.mp4", "123")));
    expect(result.current.error).toMatch("That is not v2's file");
    expect(checks.measureMedia).not.toHaveBeenCalled();
    expect(puts(m)).toHaveLength(0);
  });

  it("an unreadable file still gets unknown checks; a refused PUT shows its message", async () => {
    vi.mocked(checks.measureMedia).mockRejectedValueOnce(new Error("no video"));
    const m = editorBackend({ "PUT /iterations/4/media": { status: 413, body: { error: "The thumbnail is too large" } } });
    const onDone = vi.fn();
    const { result } = renderHook(() => useRunChecks(IT, "tape", onDone));
    await act(() => result.current.run(file()));
    expect(JSON.parse(String(puts(m)[0][1]!.body)).checks.fps.state).toBe("unknown");
    expect(result.current.error).toBe("The thumbnail is too large");
    expect(onDone).not.toHaveBeenCalled();
  });
});
