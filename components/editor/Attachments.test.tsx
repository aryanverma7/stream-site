import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { editorBackend } from "@/lib/testUtils";
import { REFUSED, useAttachmentUploads } from "@/lib/useAttachmentUploads";
import { AttachmentThumbs } from "./Attachments";
import { CommentComposer } from "./CommentComposer";

const upload = vi.fn(async () => ({ id: "IMGFILE" }));
vi.mock("@/lib/resumableUpload", () => ({ resumableUpload: (...a: unknown[]) => upload(...(a as [])) }));

const png = (name = "shot.png", size = 100) => new File([new Uint8Array(size)], name, { type: "image/png" });
let starts: unknown[] = [];
const backend = (over: Record<string, unknown> = {}) => {
  let n = 0;
  starts = [];
  return editorBackend({
    "POST /iterations/7/attachments": (b: unknown) => (starts.push(b), { id: ++n, upload_url: "https://upload/s" }),
    "POST /attachments/1/complete": { id: 1 },
    "POST /attachments/2/complete": { id: 2 },
    ...over,
  });
};

beforeEach(() => {
  upload.mockClear();
  URL.createObjectURL = vi.fn(() => "blob:local");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe("useAttachmentUploads", () => {
  it("uploads each image at once and reports its id when Drive has it", async () => {
    const api = backend();
    const { result } = renderHook(() => useAttachmentUploads(7));
    act(() => result.current.add([png()]));
    expect(result.current.blocking).toBe(true);
    await waitFor(() => expect(result.current.ids).toEqual([1]));
    expect(starts).toEqual([{ name: "shot.png", size: 100, mime: "image/png" }]);
    expect(upload).toHaveBeenCalledWith(expect.any(File), "https://upload/s", expect.anything());
    expect(api).toHaveBeenCalledWith("/api/editor/attachments/1/complete", expect.objectContaining({ method: "POST" }));
    expect(result.current.blocking).toBe(false);
  });

  it("refuses anything but small images, and more than four", () => {
    backend();
    const { result } = renderHook(() => useAttachmentUploads(7));
    act(() => result.current.add([new File(["x"], "a.svg", { type: "image/svg+xml" }), png("big.png", 20 * 1024 * 1024 + 1)]));
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe(REFUSED);
    act(() => result.current.add([png("1.png"), png("2.png"), png("3.png"), png("4.png"), png("5.png")]));
    expect(result.current.items).toHaveLength(4);
    expect(result.current.error).toBe("At most 4 images");
  });

  it("a failed upload blocks the post until it is removed", async () => {
    backend({ "POST /iterations/7/attachments": { status: 400, body: { error: "This tape's files were deleted" } } });
    const { result } = renderHook(() => useAttachmentUploads(7));
    act(() => result.current.add([png()]));
    await waitFor(() => expect(result.current.items[0].state).toBe("failed"));
    expect(result.current.blocking).toBe(true);
    act(() => result.current.remove(result.current.items[0].key));
    expect(result.current.blocking).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local");
  });
});

describe("CommentComposer with images", () => {
  it("a pasted image uploads; Add waits for it, then the draft carries its id", async () => {
    backend();
    const onSubmit = vi.fn();
    render(<CommentComposer iterationId={7} start={null} getNow={() => 0} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Comment text"), { target: { value: "look" } });
    fireEvent.paste(screen.getByLabelText("Comment text"), { clipboardData: { files: [png()] } });
    expect(screen.getByRole("button", { name: "Add comment" })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Add comment" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    expect(onSubmit).toHaveBeenCalledWith({ kind: "fix", body: "look", start_s: null, end_s: null, attachment_ids: [1] });
  });

  it("a draft without images sends no attachment_ids", () => {
    backend();
    const onSubmit = vi.fn();
    render(<CommentComposer iterationId={7} start={null} getNow={() => 0} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText("Comment text"), { target: { value: "plain" } });
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    expect(onSubmit).toHaveBeenCalledWith({ kind: "fix", body: "plain", start_s: null, end_s: null });
  });

  it("names its picker after what it attaches to, so several on a page are told apart", () => {
    backend();
    render(<CommentComposer iterationId={7} start={null} getNow={() => 0} onSubmit={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText("Images for the comment")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Attach images to the comment" })).toBeInTheDocument();
  });
});

describe("AttachmentThumbs", () => {
  it("fetches with the token in a header and shows a blob: URL, never the token", async () => {
    const calls: [string, RequestInit | undefined][] = [];
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      if (url === "/api/editor/attachments/3/link") return { ok: true, status: 200, json: async () => ({ url: "https://drive/files/IMG?alt=media", access_token: "SECRET" }) };
      return { ok: true, status: 200, blob: async () => new Blob(["x"]) };
    }) as unknown as typeof fetch;
    URL.createObjectURL = vi.fn(() => "blob:remote");
    const { unmount } = render(<AttachmentThumbs attachments={[{ id: 3, name: "ref.png", mime: "image/png", size: 1, drive_file_id: "IMG" }]} />);
    const img = await screen.findByAltText("ref.png");
    expect(img).toHaveAttribute("src", "blob:remote");
    expect(document.body.innerHTML).not.toContain("SECRET");
    const drive = calls.find(([u]) => u.startsWith("https://drive"))!;
    expect(new Headers(drive[1]?.headers).get("Authorization")).toBe("Bearer SECRET");
    fireEvent.click(screen.getByRole("button", { name: "Open ref.png" }));
    expect(screen.getByRole("dialog", { name: "Image" })).toBeInTheDocument();
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:remote");
  });
});
