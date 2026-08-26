import { describe, expect, it, vi, afterEach } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { LogViewer } from "./LogViewer";
import { asFetchMock } from "@/lib/testUtils";

describe("LogViewer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the fetched log lines, joined with real line breaks", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ lines: ["2026-08-24 [Main] INFO started", "2026-08-24 [HTTP] INFO listening"] }),
      }),
    );

    const { container } = render(<LogViewer />);

    await waitFor(() => expect(container.querySelector("pre")?.textContent).toContain("started"));
    expect(container.querySelector("pre")?.textContent).toContain("listening");
  });

  it("shows an empty-state message when there are no logs yet, not a blank box", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ lines: [] }) }),
    );

    const { getByText } = render(<LogViewer />);

    await waitFor(() => expect(getByText(/no log lines yet/i)).toBeTruthy());
  });

  it("shows an error message when the backend can't be reached", async () => {
    global.fetch = asFetchMock(vi.fn().mockRejectedValue(new Error("network error")));

    const { getByText } = render(<LogViewer />);

    await waitFor(() => expect(getByText(/couldn't reach the backend/i)).toBeTruthy());
  });

  it("clicking Refresh triggers a new fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ lines: ["a line"] }) });
    global.fetch = asFetchMock(fetchMock);

    const { getByText } = render(<LogViewer />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(getByText("Refresh"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
