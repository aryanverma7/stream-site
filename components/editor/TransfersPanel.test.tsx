import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, within } from "@testing-library/react";
import type { Transfer } from "@/lib/useTransfers";

const store = vi.hoisted(() => ({ list: [] as Transfer[] }));
vi.mock("@/lib/useTransfers", () => ({
  useTransfers: () => store.list,
  refreshStored: vi.fn(async () => {}),
  cancelTransfer: vi.fn(),
  dismissTransfer: vi.fn(),
}));

import { TransfersPanel } from "./TransfersPanel";
import { cancelTransfer, dismissTransfer, refreshStored } from "@/lib/useTransfers";

const MB = 1e6;
const t = (over: Partial<Transfer>): Transfer => ({
  key: "k", tapeId: 5, projectId: 12, name: "jett.mp4", size: 100 * MB, version: 3, sent: 62 * MB, speed: null, state: "uploading", message: null, ...over,
});
const beforeUnloadBlocked = () => {
  const e = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
};

describe("TransfersPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing with no transfers, and checks stored ones with the server on mount", () => {
    store.list = [];
    const { container } = render(<TransfersPanel />);
    expect(container.innerHTML).toBe("");
    expect(refreshStored).toHaveBeenCalledOnce();
  });

  it("shows an unfinished upload from an earlier visit, with a link to its tape", () => {
    store.list = [t({ state: "paused" })];
    const { getByText, getByRole } = render(<TransfersPanel />);
    expect(getByText("jett.mp4 v3")).toBeTruthy();
    expect(getByText("62% sent - paused, drop jett.mp4 again on its tape to continue")).toBeTruthy();
    expect(getByRole("link", { name: "Open tape" }).getAttribute("href")).toBe("#/p/12/t/5");
    fireEvent.click(getByRole("button", { name: "Cancel jett.mp4" }));
    expect(cancelTransfer).toHaveBeenCalledWith("k");
    expect(beforeUnloadBlocked()).toBe(false);
  });

  it("shows percent and speed while sending, and asks before the page is closed", () => {
    store.list = [t({ speed: 12.34 * MB })];
    const { getByText, unmount } = render(<TransfersPanel />);
    expect(getByText("62% · 12.3 MB/s")).toBeTruthy();
    expect(beforeUnloadBlocked()).toBe(true);
    unmount();
    expect(beforeUnloadBlocked()).toBe(false);
  });

  it.each([
    ["offline", "62% - paused, offline"],
    ["retrying", "62% - connection trouble, retrying"],
    ["waiting", "Sent - waiting for the Mac Mini"],
    ["done", "Done"],
  ] as const)("labels %s and does not prompt on close", (state, text) => {
    store.list = [t({ state })];
    const { getByText } = render(<TransfersPanel />);
    expect(getByText(text)).toBeTruthy();
    expect(beforeUnloadBlocked()).toBe(false);
  });

  it("asks before the page is closed while the file is being checked (checks and thumbnail not sent yet)", () => {
    store.list = [t({ state: "checking" })];
    const { getByText } = render(<TransfersPanel />);
    expect(getByText("Checking the file")).toBeTruthy();
    expect(beforeUnloadBlocked()).toBe(true);
  });

  it("shows a failure's message and lets it be dismissed", () => {
    store.list = [t({ state: "failed", version: null, message: "Drive is too full: needs 21.0 GB, 4.0 GB free" })];
    const { getByRole } = render(<TransfersPanel />);
    const panel = getByRole("complementary", { name: "Transfers" });
    expect(within(panel).getByText("Drive is too full: needs 21.0 GB, 4.0 GB free")).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: "Dismiss jett.mp4" }));
    expect(dismissTransfer).toHaveBeenCalledWith("k");
  });

  it("shows 0%, not NaN, for an empty file", () => {
    store.list = [t({ size: 0, sent: 0 })];
    const { getByText } = render(<TransfersPanel />);
    expect(getByText("0%")).toBeTruthy();
  });
});
