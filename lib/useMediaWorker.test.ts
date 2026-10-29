import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { NO_WORKER, mediaUrl, useMediaWorker } from "./useMediaWorker";

const link = (t: string) => ({ url: "https://drive/x", access_token: t, expires_in: 3600 });

function fakeSw() {
  const listeners: ((e: MessageEvent) => void)[] = [];
  const controller = { postMessage: vi.fn() };
  const sw = {
    controller,
    register: vi.fn(async () => ({})),
    ready: Promise.resolve({}),
    addEventListener: vi.fn((type: string, f: (e: MessageEvent) => void) => type === "message" && listeners.push(f)),
    removeEventListener: vi.fn(),
    emit: (data: unknown) => listeners.forEach((f) => f({ data } as MessageEvent)),
  };
  Object.defineProperty(navigator, "serviceWorker", { value: sw, configurable: true });
  return sw;
}

afterEach(() => {
  delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
});

describe("useMediaWorker", () => {
  it("builds the media URL", () => expect(mediaUrl(5)).toBe("/editor/media/5"));

  it("registers with scope /editor and becomes ready", async () => {
    const sw = fakeSw();
    const { result } = renderHook(() => useMediaWorker());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(sw.register).toHaveBeenCalledWith("/editor/media-sw.js", { scope: "/editor" });
    expect(result.current.error).toBeNull();
  });

  it("provide posts the info with a link, and need-link gets a fresh one", async () => {
    const sw = fakeSw();
    const getLink = vi.fn(async (fresh?: boolean) => link(fresh ? "new" : "old"));
    const { result } = renderHook(() => useMediaWorker());
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(() => result.current.provide(3, { projectId: 7, fileId: "F", size: 10, mime: "video/mp4", getLink }));
    expect(sw.controller.postMessage).toHaveBeenLastCalledWith({
      type: "media", iterationId: 3, projectId: 7, fileId: "F", size: 10, mime: "video/mp4", link: link("old"),
    });
    act(() => sw.emit({ type: "need-link", iterationId: 3 }));
    await waitFor(() => expect(sw.controller.postMessage).toHaveBeenCalledTimes(2));
    expect(getLink).toHaveBeenLastCalledWith(true);
    expect(sw.controller.postMessage.mock.calls[1][0]).toMatchObject({ type: "media", iterationId: 3, link: link("new") });
    sw.emit({ type: "need-link", iterationId: 99 }); // unknown version: ignored
    expect(sw.controller.postMessage).toHaveBeenCalledTimes(2);
  });

  it("waits for the worker to take control", async () => {
    const sw = fakeSw();
    const controller = sw.controller;
    (sw as { controller: unknown }).controller = null;
    const { result } = renderHook(() => useMediaWorker());
    await waitFor(() => expect(sw.addEventListener.mock.calls.some((c) => c[0] === "controllerchange")).toBe(true));
    expect(result.current.ready).toBe(false);
    sw.controller = controller;
    const onChange = sw.addEventListener.mock.calls.find((c) => c[0] === "controllerchange")![1];
    act(() => onChange({} as MessageEvent));
    await waitFor(() => expect(result.current.ready).toBe(true));
  });

  it("reports an unsupported browser", async () => {
    const { result } = renderHook(() => useMediaWorker());
    await waitFor(() => expect(result.current.error).toBe(NO_WORKER));
    expect(NO_WORKER).toBe("This browser can't play from the download; use Chrome or Firefox");
    expect(result.current.ready).toBe(false);
  });
});
