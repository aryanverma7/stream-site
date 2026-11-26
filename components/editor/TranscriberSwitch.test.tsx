import { describe, expect, it, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TranscriberSwitch, ago } from "./TranscriberSwitch";
import { editorBackend } from "@/lib/testUtils";

const S = { enabled: false, auto: false, last_seen: null, queued: 0, running: 0 };

describe("TranscriberSwitch", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows Paused by default and turns On with a PUT", async () => {
    const fetchMock = editorBackend({
      "/transcriber": S,
      "PUT /transcriber": (b: object) => ({ ...S, ...b }),
    });
    render(<TranscriberSwitch />);
    const sw = await screen.findByRole("switch", { name: "Transcriber: Paused" });
    fireEvent.click(sw);
    await screen.findByRole("switch", { name: "Transcriber: On" });
    const put = fetchMock.mock.calls.find(([, i]) => i?.method === "PUT")!;
    expect(JSON.parse(String(put[1]!.body))).toEqual({ enabled: true });
  });

  it("puts the switch back and shows the error when the PUT fails", async () => {
    editorBackend({ "/transcriber": S, "PUT /transcriber": { status: 500, body: { error: "Database is busy" } } });
    render(<TranscriberSwitch />);
    fireEvent.click(await screen.findByRole("switch", { name: "Transcriber: Paused" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Database is busy");
    expect(screen.getByRole("switch", { name: "Transcriber: Paused" })).toBeInTheDocument();
  });

  it("options: auto checkbox and when the PC was last seen", async () => {
    let state = { ...S, last_seen: 1000, queued: 2 };
    const fetchMock = editorBackend({
      "/transcriber": () => state,
      "PUT /transcriber": (b: object) => (state = { ...state, ...b }),
    });
    render(<TranscriberSwitch now={() => 1000 + 200} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Transcriber options" }));
    expect(await screen.findByText("PC last seen 3 min ago")).toBeInTheDocument();
    expect(screen.getByText("2 waiting")).toBeInTheDocument();
    const box = screen.getByRole("checkbox", { name: "Auto for new versions" });
    expect(box).not.toBeChecked();
    await act(async () => {
      fireEvent.click(box);
    });
    expect(box).toBeChecked();
    const put = fetchMock.mock.calls.find(([, i]) => i?.method === "PUT")!;
    expect(JSON.parse(String(put[1]!.body))).toEqual({ auto: true });
  });

  it("says when the PC was never seen", async () => {
    editorBackend({ "/transcriber": S });
    render(<TranscriberSwitch />);
    fireEvent.click(screen.getByRole("button", { name: "Transcriber options" }));
    expect(await screen.findByText("PC not seen yet")).toBeInTheDocument();
  });

  it("ago rounds down to minutes, hours, days", () => {
    expect(ago(0, 30)).toBe("just now");
    expect(ago(0, 7200)).toBe("2 h ago");
    expect(ago(0, 86400 * 3)).toBe("3 d ago");
  });
});
