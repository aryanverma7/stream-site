import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, within } from "@testing-library/react";
import type { Transfer } from "@/lib/useTransfers";

const store = vi.hoisted(() => ({ list: [] as Transfer[], notices: [] as { id: number; text: string; warn: boolean }[] }));
vi.mock("@/lib/useTransfers", () => ({
  useTransfers: () => store.list,
  useSpaceNotices: () => store.notices,
  dismissNotice: vi.fn(),
  refreshStored: vi.fn(async () => {}),
  cancelTransfer: vi.fn(),
  dismissTransfer: vi.fn(),
}));

import { TransfersPanel } from "./TransfersPanel";
import { cancelTransfer, dismissNotice, dismissTransfer, refreshStored } from "@/lib/useTransfers";

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
  beforeEach(() => {
    vi.clearAllMocks();
    store.notices = [];
  });

  it("shows a space notice as a polite status toast that closes by button and by itself after 8s", () => {
    vi.useFakeTimers();
    store.list = [];
    store.notices = [{ id: 4, text: "Drive had 50.0 GB free · after this upload ≈ 20.0 GB left (20%)", warn: false }];
    const { getByRole } = render(<TransfersPanel />);
    const toast = getByRole("status");
    expect(toast.getAttribute("aria-live")).toBe("polite");
    expect(toast.textContent).toContain("≈ 20.0 GB left (20%)");
    fireEvent.click(within(toast).getByLabelText("Close notice"));
    expect(dismissNotice).toHaveBeenCalledWith(4);
    vi.advanceTimersByTime(8000);
    expect(dismissNotice).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("styles a low-space notice amber and shows the row's after-upload note", () => {
    store.list = [t({ spaceNote: "after this upload ≈ 2.0 GB left (2%)" })];
    store.notices = [{ id: 1, text: "low", warn: true }];
    const { getByRole, getByText } = render(<TransfersPanel />);
    expect(getByRole("status").className).toContain("text-amber");
    expect(getByText("after this upload ≈ 2.0 GB left (2%)")).toBeTruthy();
  });

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
    ["offline", "62% - paused, offline", true],
    ["retrying", "62% - connection trouble, retrying", true],
    ["waiting", "Sent - waiting for the Mac Mini", false],
    ["done", "Done", false],
  ] as const)("labels %s; prompts on close: %s", (state, text, prompts) => {
    store.list = [t({ state })];
    const { getByText } = render(<TransfersPanel />);
    expect(getByText(text)).toBeTruthy();
    expect(beforeUnloadBlocked()).toBe(prompts);
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
