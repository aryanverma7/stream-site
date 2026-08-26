import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { ClipsSection } from "./ClipsSection";
import { asFetchMock } from "@/lib/testUtils";

describe("ClipsSection", () => {
  beforeEach(() => {
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows a loading state initially", () => {
    global.fetch = asFetchMock(vi.fn(() => new Promise(() => {})));
    const { getByText } = render(<ClipsSection />);
    expect(getByText(/loading clips/i)).toBeTruthy();
  });

  it("shows an empty state when no clips are uploaded, not an error", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ json: () => Promise.resolve({ clips: [] }) }),
    );
    const { getByText } = render(<ClipsSection />);

    await waitFor(() => expect(getByText(/no clips uploaded yet/i)).toBeTruthy());
  });

  it("renders a card per clip", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            clips: [
              { filename: "ace_on_bind.mp4", url: "/clips/ace_on_bind.mp4", title: "ace on bind" },
              { filename: "1v5_clutch.mp4", url: "/clips/1v5_clutch.mp4", title: "1v5 clutch" },
            ],
          }),
      }),
    );

    const { getByText } = render(<ClipsSection />);

    await waitFor(() => expect(getByText("ace on bind")).toBeTruthy());
    expect(getByText("1v5 clutch")).toBeTruthy();
  });

  it("opens the modal on card click, and closes it again via the Close button", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            clips: [{ filename: "ace_on_bind.mp4", url: "/clips/ace_on_bind.mp4", title: "ace on bind" }],
          }),
      }),
    );

    const { getByText, container } = render(<ClipsSection />);
    await waitFor(() => expect(getByText("ace on bind")).toBeTruthy());

    const card = container.querySelector("button")!;
    fireEvent.click(card);

    // The modal renders a second video element (the fuller-view one) -
    // confirms the modal genuinely opened, not just internal state changing.
    await waitFor(() => expect(container.querySelectorAll("video").length).toBe(2));

    fireEvent.click(getByText("Close"));
    await waitFor(() => expect(container.querySelectorAll("video").length).toBe(1));
  });
});
