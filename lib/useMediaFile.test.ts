import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMediaFile } from "./useMediaFile";
import { CHUNK_BYTES, dirName } from "./opfsMedia";
import { asFetchMock, editorBackend, fakeDir, fakeStorage } from "./testUtils";

afterEach(() => vi.restoreAllMocks());

function setup() {
  const root = fakeDir();
  fakeStorage(root, { quota: 1e12, usage: () => 0 });
  const fetchMock = vi.fn();
  global.fetch = asFetchMock(fetchMock);
  return { root, fetchMock };
}
const seed = async (root: ReturnType<typeof fakeDir>, name: string, chunks: number[]) => {
  const d = (await root.getDirectoryHandle(name, { create: true })) as ReturnType<typeof fakeDir>;
  chunks.forEach((n, i) => d.files.set(`c0000${i}`, n));
};

describe("useMediaFile", () => {
  it("reports complete when every chunk is present", async () => {
    const { root, fetchMock } = setup();
    await seed(root, dirName(7, 1, "F"), [CHUNK_BYTES, 100]);
    const { result } = renderHook(() => useMediaFile({ id: 1, drive_file_id: "F", size: CHUNK_BYTES + 100 }, 7, null));
    await waitFor(() => expect(result.current.state).toBe("complete"));
    expect(result.current.doneBytes).toBe(CHUNK_BYTES + 100);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("unmount deletes nothing", async () => {
    const { root } = setup();
    await seed(root, dirName(7, 1, "F"), [10]);
    await seed(root, "it-7-9-X", [10]);
    const { result, unmount } = renderHook(() => useMediaFile({ id: 1, drive_file_id: "F", size: 10 }, 7, null));
    await waitFor(() => expect(result.current.state).toBe("complete"));
    unmount();
    expect([...root.dirs.keys()].sort()).toEqual(["it-7-1-F", "it-7-9-X"]);
  });

  it("a new drive file id for the same iteration replaces the old directory", async () => {
    const { root } = setup();
    await seed(root, dirName(7, 1, "OLD"), [10]);
    await seed(root, dirName(7, 1, "NEW"), [10]);
    const { result } = renderHook(() => useMediaFile({ id: 1, drive_file_id: "NEW", size: 10 }, 7, null));
    await waitFor(() => expect(result.current.state).toBe("complete"));
    expect([...root.dirs.keys()]).toEqual(["it-7-1-NEW"]);
  });

  it("getLink stamps the absolute expiry when fetched and keeps it while cached", async () => {
    setup();
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    editorBackend({ "/iterations/1/media-link": { url: "u", access_token: "t", expires_in: 3600 } });
    const { result } = renderHook(() => useMediaFile({ id: 1, drive_file_id: "F", size: 0 }, 7, null));
    await waitFor(() => expect(result.current.state).toBe("complete"));
    expect((await result.current.getLink()).expires_at).toBe(1_000_000 + 3_600_000);
    now.mockReturnValue(2_000_000);
    expect((await result.current.getLink()).expires_at).toBe(1_000_000 + 3_600_000);
  });
});
