import { describe, expect, it, vi, afterEach } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { ConfigEditor } from "./ConfigEditor";
import { asFetchMock } from "@/lib/testUtils";

describe("ConfigEditor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the config and displays it as formatted JSON", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ http_port: 8765 }) }),
    );

    const { container } = render(<ConfigEditor />);

    await waitFor(() => {
      const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
      expect(textarea?.value).toContain("8765");
    });
  });

  it("refuses to save and shows a clear error when the text isn't valid JSON, without calling the backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ http_port: 8765 }) });
    global.fetch = asFetchMock(fetchMock);

    const { container, getByText } = render(<ConfigEditor />);
    await waitFor(() => expect(container.querySelector("textarea")).toBeTruthy());

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "{ this is not valid json," } });
    fireEvent.click(getByText("Save"));

    expect(getByText(/that's not valid json/i)).toBeTruthy();
    // Only the initial GET should have happened - the invalid JSON must
    // never reach a PUT call.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("saves successfully when the edited text is valid JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ http_port: 8765 }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ status: "ok" }) });
    global.fetch = asFetchMock(fetchMock);

    const { container, getByText } = render(<ConfigEditor />);
    await waitFor(() => expect(container.querySelector("textarea")).toBeTruthy());

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{"http_port": 9000}' } });
    fireEvent.click(getByText("Save"));

    await waitFor(() => expect(getByText("Saved.")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows a load error if the initial config fetch fails", async () => {
    global.fetch = asFetchMock(vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const { getByText } = render(<ConfigEditor />);

    await waitFor(() => expect(getByText(/couldn't load the config/i)).toBeTruthy());
  });

  it("shows a setup hint (not a broken link) when Streamlabs credentials aren't configured yet", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ http_port: 8765 }) }),
    );

    const { getByText, getAllByText, queryByText } = render(<ConfigEditor />);

    await waitFor(() => expect(getAllByText("Not connected").length).toBe(2));
    expect(queryByText("Connect Streamlabs")).toBeNull();
    expect(getByText(/fill in streamlabs_client_id/i)).toBeTruthy();
  });

  it("shows a working Connect link once client_id is set but not yet connected", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ streamlabs_client_id: "abc123" }),
      }),
    );

    const { getByText, container } = render(<ConfigEditor />);

    await waitFor(() => expect(getByText("Connect Streamlabs")).toBeTruthy());
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/auth/streamlabs/login");
  });

  it("shows Connected, with no connect link, once an access token exists", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ streamlabs_client_id: "abc123", streamlabs_access_token: "real-token" }),
      }),
    );

    const { getByText, queryByText } = render(<ConfigEditor />);

    await waitFor(() => expect(getByText("Connected")).toBeTruthy());
    expect(queryByText("Connect Streamlabs")).toBeNull();
  });

  it("offers Spotify its own connect link, on the same three states", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ spotify_client_id: "abc123" }),
      }),
    );

    const { getByText, container } = render(<ConfigEditor />);

    await waitFor(() => expect(getByText("Connect Spotify")).toBeTruthy());
    const links = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(links).toContain("/auth/spotify/login");
  });

  it("counts Spotify as connected on the refresh token, not an access token", async () => {
    // Spotify's access tokens last an hour and are never persisted - the
    // refresh token is the durable credential, so it is the one that says
    // whether this account is connected.
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ spotify_client_id: "abc123", spotify_refresh_token: "refresh-abc" }),
      }),
    );

    const { queryByText } = render(<ConfigEditor />);

    await waitFor(() => expect(queryByText("Connect Spotify")).toBeNull());
  });
});
