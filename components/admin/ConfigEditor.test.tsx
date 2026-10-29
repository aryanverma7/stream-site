import { describe, expect, it, vi, afterEach } from "vitest";
import { render, waitFor, fireEvent, within } from "@testing-library/react";
import { ConfigEditor } from "./ConfigEditor";
import { asFetchMock } from "@/lib/testUtils";
import { SECRET_MASK, type Schema } from "@/lib/settingsModel";

const SCHEMA: Schema = {
  sections: ["Streamer.bot", "Points (Cloudbot)", "Login & site", "Other"],
  fields: {
    streamerbot_ws_url: {
      label: "WebSocket URL",
      description: "Address of Streamer.bot on the gaming PC",
      section: "Streamer.bot",
      type: "text",
    },
    streamerbot_subscribe_events: {
      label: "Subscribed events",
      description: "Event types requested on every connect",
      section: "Streamer.bot",
      type: "json",
    },
    streamlabs_access_token: {
      label: "Streamlabs access token",
      description: "Written by the Streamlabs connect flow",
      section: "Points (Cloudbot)",
      type: "secret",
    },
    http_port: {
      label: "HTTP port",
      description: "Port the backend listens on",
      section: "Login & site",
      type: "number",
      min: 1,
      max: 65535,
    },
    admin_github_users: {
      label: "Admin GitHub users",
      description: "Who may open the dashboard",
      section: "Login & site",
      type: "list",
    },
  },
};

const CONFIG = {
  streamerbot_ws_url: "ws://192.168.1.20:8080/",
  streamerbot_subscribe_events: { Twitch: ["ChatMessage"] },
  streamlabs_access_token: SECRET_MASK,
  http_port: 8765,
  admin_github_users: ["aryanverma7"],
};

type Opts = { config?: Record<string, unknown>; schema?: Schema | null };

/** Routes GET config / GET schema / PUT config; records each PUT body. */
function mockBackend({ config = CONFIG, schema = SCHEMA }: Opts = {}) {
  const puts: Record<string, unknown>[] = [];
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      puts.push(JSON.parse(String(init.body)));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    if (url === "/api/config/schema") {
      if (schema === null) return Promise.resolve({ ok: false, status: 404 });
      return Promise.resolve({ ok: true, json: () => Promise.resolve(schema) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(config) });
  });
  global.fetch = asFetchMock(fetchMock);
  return { fetchMock, puts };
}

async function renderLoaded() {
  const utils = render(<ConfigEditor />);
  await waitFor(() => expect(utils.getByRole("navigation", { name: "Settings sections" })).toBeTruthy());
  return utils;
}

function openSection(utils: Awaited<ReturnType<typeof renderLoaded>>, name: RegExp) {
  const nav = utils.getByRole("navigation", { name: "Settings sections" });
  fireEvent.click(within(nav).getByRole("button", { name }));
}

describe("ConfigEditor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders sections with counts and the fields of the selected section", async () => {
    mockBackend();
    const utils = await renderLoaded();
    const nav = utils.getByRole("navigation", { name: "Settings sections" });
    expect(within(nav).getByRole("button", { name: /Streamer\.bot\s*2/ })).toBeTruthy();
    expect(within(nav).getByRole("button", { name: /Login & site\s*2/ })).toBeTruthy();
    expect(within(nav).getByRole("button", { name: /Advanced \(raw JSON\)/ })).toBeTruthy();
    // "Other" has no fields, so it is not offered.
    expect(within(nav).queryByRole("button", { name: /^Other/ })).toBeNull();

    // First section is open by default.
    expect(utils.getByLabelText("WebSocket URL")).toBeTruthy();
    expect(utils.queryByLabelText("HTTP port")).toBeNull();

    openSection(utils, /Login & site/);
    expect((utils.getByLabelText("HTTP port") as HTMLInputElement).value).toBe("8765");
    expect(utils.getByText("http_port").tagName).toBe("CODE");
    expect(utils.getByText("aryanverma7")).toBeTruthy();
  });

  it("names empty needed settings in a red banner and jumps to one on click", async () => {
    const schema: Schema = {
      ...SCHEMA,
      fields: {
        ...SCHEMA.fields,
        streamlabs_access_token: { ...SCHEMA.fields.streamlabs_access_token, needed: true },
        admin_github_users: { ...SCHEMA.fields.admin_github_users, needed: true },
      },
    };
    mockBackend({ schema, config: { ...CONFIG, admin_github_users: [] } });
    const utils = await renderLoaded();

    const banner = utils.getByRole("alert");
    expect(banner.textContent).toContain("1 important setting is empty");
    // The masked secret counts as filled.
    expect(within(banner).queryByText("Streamlabs access token")).toBeNull();

    fireEvent.click(within(banner).getByRole("button", { name: /Admin GitHub users/ }));
    expect(utils.getByText("Needed")).toBeTruthy();
    expect(utils.getByText("admin_github_users")).toBeTruthy();
  });

  it("shows no banner when every needed setting is filled", async () => {
    mockBackend({
      schema: { ...SCHEMA, fields: { ...SCHEMA.fields, http_port: { ...SCHEMA.fields.http_port, needed: true } } },
    });
    const utils = await renderLoaded();
    expect(utils.queryByRole("alert")).toBeNull();
  });

  it("search finds a field in another section by its description", async () => {
    mockBackend();
    const utils = await renderLoaded();
    expect(utils.queryByLabelText("HTTP port")).toBeNull();
    fireEvent.change(utils.getByLabelText("Search all settings"), { target: { value: "listens on" } });
    expect(utils.getByLabelText("HTTP port")).toBeTruthy();
    expect(utils.queryByLabelText("WebSocket URL")).toBeNull();
  });

  it("shows the mask for a set secret and never renders its value", async () => {
    mockBackend();
    const utils = await renderLoaded();
    openSection(utils, /Points \(Cloudbot\)/);
    const row = utils.getByText("streamlabs_access_token").closest("[data-field]") as HTMLElement;
    expect(within(row).getByText(SECRET_MASK)).toBeTruthy();
    expect(within(row).getByText("Set")).toBeTruthy();
    // No input carries a value until Replace... is pressed.
    expect(row.querySelectorAll("input").length).toBe(0);

    fireEvent.click(within(row).getByRole("button", { name: /Replace/ }));
    const pw = within(row).getByLabelText("Streamlabs access token") as HTMLInputElement;
    expect(pw.type).toBe("password");
    expect(pw.value).toBe("");
    fireEvent.click(within(row).getByRole("button", { name: "Cancel" }));
    expect(within(row).getByText(SECRET_MASK)).toBeTruthy();
    expect(utils.queryByText(/unsaved change/)).toBeNull();
  });

  it("blocks save while a field is invalid", async () => {
    mockBackend();
    const utils = await renderLoaded();
    openSection(utils, /Login & site/);
    fireEvent.change(utils.getByLabelText("HTTP port"), { target: { value: "0" } });
    expect(utils.getByText("Must be 1 or more")).toBeTruthy();
    expect(utils.getByText(/1 unsaved change · 1 error to fix before saving/)).toBeTruthy();
    expect((utils.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("saves only the changed keys", async () => {
    const { puts } = mockBackend();
    const utils = await renderLoaded();
    openSection(utils, /Login & site/);
    fireEvent.change(utils.getByLabelText("HTTP port"), { target: { value: "9000" } });
    expect(utils.getByText("1 unsaved change")).toBeTruthy();
    fireEvent.click(utils.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(puts.length).toBe(1));
    expect(puts[0]).toEqual({ http_port: 9000 });
  });

  it("discard resets to the loaded config", async () => {
    mockBackend();
    const utils = await renderLoaded();
    openSection(utils, /Login & site/);
    fireEvent.change(utils.getByLabelText("HTTP port"), { target: { value: "9000" } });
    fireEvent.click(utils.getByRole("button", { name: "Discard" }));
    expect((utils.getByLabelText("HTTP port") as HTMLInputElement).value).toBe("8765");
    expect(utils.queryByText(/unsaved change/)).toBeNull();
  });

  it("replacing a secret sends the new value", async () => {
    const { puts } = mockBackend();
    const utils = await renderLoaded();
    openSection(utils, /Points \(Cloudbot\)/);
    fireEvent.click(utils.getByRole("button", { name: /Replace/ }));
    fireEvent.change(utils.getByLabelText("Streamlabs access token"), { target: { value: "new-token" } });
    fireEvent.click(utils.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(puts.length).toBe(1));
    expect(puts[0]).toEqual({ streamlabs_access_token: "new-token" });
  });

  it("adds a new setting with its metadata", async () => {
    const { puts } = mockBackend();
    const utils = await renderLoaded();
    fireEvent.click(utils.getByRole("button", { name: "+ Add setting" }));
    const form = utils.getByRole("group", { name: "Add setting" });
    fireEvent.change(within(form).getByLabelText("Key"), { target: { value: "my_flag" } });
    fireEvent.change(within(form).getByLabelText("Type"), { target: { value: "bool" } });
    fireEvent.click(within(form).getByLabelText("Value"));
    expect((within(form).getByLabelText("Section") as HTMLSelectElement).value).toBe("Other");
    fireEvent.click(within(form).getByRole("button", { name: "Add" }));
    expect(utils.getByText("1 unsaved change")).toBeTruthy();
    fireEvent.click(utils.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(puts.length).toBe(1));
    expect(puts[0]).toEqual({ my_flag: true, _custom_fields: { my_flag: { type: "bool", section: "Other" } } });
  });

  it("rejects a new setting whose key already exists", async () => {
    mockBackend();
    const utils = await renderLoaded();
    fireEvent.click(utils.getByRole("button", { name: "+ Add setting" }));
    const form = utils.getByRole("group", { name: "Add setting" });
    fireEvent.change(within(form).getByLabelText("Key"), { target: { value: "http_port" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add" }));
    expect(within(form).getByText("That key already exists")).toBeTruthy();
    expect(utils.queryByText(/unsaved change/)).toBeNull();
  });

  it("a nested value renders as JSON and invalid JSON blocks save", async () => {
    const { puts } = mockBackend();
    const utils = await renderLoaded();
    const ta = utils.getByLabelText("Subscribed events") as HTMLTextAreaElement;
    expect(ta.value).toBe(JSON.stringify(CONFIG.streamerbot_subscribe_events, null, 2));
    expect(utils.queryByText(/unsaved change/)).toBeNull();

    fireEvent.change(ta, { target: { value: '{"Twitch": [' } });
    expect(utils.getByText("Not valid JSON")).toBeTruthy();
    expect((utils.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(ta, { target: { value: '{"YouTube": ["Message"]}' } });
    fireEvent.click(utils.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(puts.length).toBe(1));
    expect(puts[0]).toEqual({ streamerbot_subscribe_events: { YouTube: ["Message"] } });
  });

  it("falls back to raw JSON when the schema endpoint is missing", async () => {
    mockBackend({ schema: null });
    const utils = render(<ConfigEditor />);
    await waitFor(() =>
      expect(utils.getByText("This backend is older than the site - showing raw JSON until it is updated.")).toBeTruthy(),
    );
    const ta = utils.container.querySelector("textarea") as HTMLTextAreaElement;
    expect(ta.value).toContain("8765");
  });

  it("refuses to save and shows a clear error when the raw text isn't valid JSON, without calling the backend", async () => {
    const { fetchMock } = mockBackend();
    const utils = await renderLoaded();
    openSection(utils, /Advanced \(raw JSON\)/);
    fireEvent.change(utils.getByLabelText("Raw config JSON"), { target: { value: "{ this is not valid json," } });
    fireEvent.click(utils.getByRole("button", { name: "Save raw JSON" }));
    expect(utils.getByText(/that's not valid json/i)).toBeTruthy();
    // Only the initial config + schema GETs - invalid JSON never reaches a PUT.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("raw JSON save sends only changed keys and never a masked secret", async () => {
    const { puts } = mockBackend();
    const utils = await renderLoaded();
    openSection(utils, /Advanced \(raw JSON\)/);
    const ta = utils.getByLabelText("Raw config JSON") as HTMLTextAreaElement;
    const edited = { ...JSON.parse(ta.value), http_port: 9000 };
    fireEvent.change(ta, { target: { value: JSON.stringify(edited) } });
    fireEvent.click(utils.getByRole("button", { name: "Save raw JSON" }));
    await waitFor(() => expect(puts.length).toBe(1));
    expect(puts[0]).toEqual({ http_port: 9000 });
  });

  it("shows a load error if the initial config fetch fails", async () => {
    global.fetch = asFetchMock(vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const { getByText } = render(<ConfigEditor />);
    await waitFor(() => expect(getByText(/couldn't load the config/i)).toBeTruthy());
  });

  it("shows a setup hint (not a broken link) when Streamlabs credentials aren't configured yet", async () => {
    mockBackend({ config: { http_port: 8765 } });
    const { getByText, getAllByText, queryByText } = render(<ConfigEditor />);
    await waitFor(() => expect(getAllByText("Not connected").length).toBe(3));
    expect(queryByText("Connect Streamlabs")).toBeNull();
    expect(getByText(/fill in streamlabs_client_id/i)).toBeTruthy();
  });

  it("shows a working Connect link once client_id is set but not yet connected", async () => {
    mockBackend({ config: { streamlabs_client_id: "abc123" } });
    const { getByText, container } = render(<ConfigEditor />);
    await waitFor(() => expect(getByText("Connect Streamlabs")).toBeTruthy());
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/auth/streamlabs/login");
  });

  it("shows Connected, with no connect link, once an access token exists", async () => {
    mockBackend({ config: { streamlabs_client_id: "abc123", streamlabs_access_token: SECRET_MASK } });
    const { getByText, queryByText } = render(<ConfigEditor />);
    await waitFor(() => expect(getByText("Connected")).toBeTruthy());
    expect(queryByText("Connect Streamlabs")).toBeNull();
  });

  it("offers Spotify its own connect link, on the same three states", async () => {
    mockBackend({ config: { spotify_client_id: "abc123" } });
    const { getByText, container } = render(<ConfigEditor />);
    await waitFor(() => expect(getByText("Connect Spotify")).toBeTruthy());
    const links = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(links).toContain("/auth/spotify/login");
  });

  it("counts Spotify as connected on the refresh token, not an access token", async () => {
    // Spotify's access tokens last an hour and are never persisted - the
    // refresh token is the durable credential.
    mockBackend({ config: { spotify_client_id: "abc123", spotify_refresh_token: SECRET_MASK } });
    const { getAllByText, queryByText } = render(<ConfigEditor />);
    // Streamlabs and Google Drive (no credentials) are the "Not connected" rows.
    await waitFor(() => expect(getAllByText("Not connected")).toHaveLength(2));
    expect(queryByText("Connect Spotify")).toBeNull();
  });

  it("offers Google Drive its connect link once the client id is saved", async () => {
    mockBackend({ config: { gdrive_client_id: "g123" } });
    const { getByText, container } = render(<ConfigEditor />);
    await waitFor(() => expect(getByText("Connect Google Drive")).toBeTruthy());
    const links = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(links).toContain("/auth/gdrive/login");
  });

  it("counts Google Drive as connected on its refresh token", async () => {
    mockBackend({ config: { gdrive_client_id: "g123", gdrive_refresh_token: SECRET_MASK } });
    const { queryByText, getAllByText } = render(<ConfigEditor />);
    await waitFor(() => expect(getAllByText("Connected").length).toBeGreaterThan(0));
    expect(queryByText("Connect Google Drive")).toBeNull();
  });
});
