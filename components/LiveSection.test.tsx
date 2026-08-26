import { describe, expect, it, vi, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { LiveSection } from "./LiveSection";
import { asFetchMock } from "@/lib/testUtils";

class MockWebSocket {
  onmessage: ((event: { data: string }) => void) | null = null;
  close() {}
}

describe("LiveSection", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows a checking-status state before the live check resolves", () => {
    global.fetch = asFetchMock(vi.fn(() => new Promise(() => {})));
    // @ts-expect-error - mocked for this test file
    global.WebSocket = MockWebSocket;

    const { getByText } = render(<LiveSection />);
    expect(getByText(/checking status/i)).toBeTruthy();
  });

  it("shows the Twitch embed and chat when live", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ live: true }),
      }),
    );
    // @ts-expect-error - mocked for this test file
    global.WebSocket = MockWebSocket;

    const { getByText, container } = render(<LiveSection />);

    await waitFor(() => expect(getByText(/live now/i)).toBeTruthy());
    await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());
  });

  it("shows offline recommendations when not live", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("live-status")) {
          return Promise.resolve({ json: () => Promise.resolve({ live: false }) });
        }
        return Promise.resolve({ json: () => Promise.resolve({ videos: [] }) });
      }),
    );
    // @ts-expect-error - mocked for this test file
    global.WebSocket = MockWebSocket;

    const { getByText } = render(<LiveSection />);

    await waitFor(() => expect(getByText(/offline/i)).toBeTruthy());
    expect(getByText(/not live right now/i)).toBeTruthy();
  });
});
