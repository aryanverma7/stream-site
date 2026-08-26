import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { MergedChat } from "./MergedChat";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onmessage: ((event: { data: string }) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
  }
}

describe("MergedChat", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    // @ts-expect-error - deliberately replacing the global for this test file
    global.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("connects to the widget hub with the correct relative URL and chat tag", () => {
    render(<MergedChat />);

    expect(MockWebSocket.instances.length).toBe(1);
    expect(MockWebSocket.instances[0].url).toContain("/ws/widgets?widget=chat");
  });

  it("shows a waiting message before any chat arrives", () => {
    const { getByText } = render(<MergedChat />);
    expect(getByText(/waiting for chat/i)).toBeTruthy();
  });

  it("renders an incoming valid chat message", async () => {
    const { getByText } = render(<MergedChat />);
    const ws = MockWebSocket.instances[0];

    ws.onmessage?.({
      data: JSON.stringify({ type: "chat_message", platform: "twitch", username: "someviewer", message: "hey chat" }),
    });

    await waitFor(() => expect(getByText("someviewer")).toBeTruthy());
    expect(getByText("hey chat")).toBeTruthy();
  });

  it("silently ignores an invalid/malformed message rather than crashing", () => {
    render(<MergedChat />);
    const ws = MockWebSocket.instances[0];

    expect(() => ws.onmessage?.({ data: "not valid json" })).not.toThrow();
  });

  it("closes the WebSocket on unmount", () => {
    const { unmount } = render(<MergedChat />);
    const ws = MockWebSocket.instances[0];

    unmount();
    expect(ws.closed).toBe(true);
  });
});
