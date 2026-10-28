import { describe, expect, it, vi, afterEach } from "vitest";
import { editorApi, EditorApiError } from "./editorApi";
import { asFetchMock } from "./testUtils";

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
}

describe("editorApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.location.hash = "";
  });

  it("GETs under /api/editor with the session cookie and returns the JSON", async () => {
    const fetchMock = respond(200, { username: "aryan", role: "admin" });
    global.fetch = asFetchMock(fetchMock);

    await expect(editorApi("/me")).resolves.toEqual({ username: "aryan", role: "admin" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/editor/me");
    expect(init.credentials).toBe("same-origin");
    expect(init.method).toBe("GET");
  });

  it("sends a body as JSON", async () => {
    const fetchMock = respond(201, { id: 3 });
    global.fetch = asFetchMock(fetchMock);

    await editorApi("/projects/1/tapes", { method: "POST", body: { name: "Main" } });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"name":"Main"}');
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("throws the server's own error text with the status", async () => {
    global.fetch = asFetchMock(respond(403, { error: "Only the streamer can do this." }));

    const err = await editorApi<never>("/storage").catch((e: EditorApiError) => e);
    expect(err).toBeInstanceOf(EditorApiError);
    expect(err.status).toBe(403);
    expect(err.message).toBe("Only the streamer can do this.");
  });

  it("still throws something readable when the error body is not JSON", async () => {
    global.fetch = asFetchMock(
      vi.fn().mockResolvedValue({ ok: false, status: 502, json: () => Promise.reject(new SyntaxError("x")) }),
    );

    const err = await editorApi<never>("/me").catch((e: EditorApiError) => e);
    expect(err.status).toBe(502);
    expect(err.message).toBe("Request failed (502)");
  });

  it("sends a 401 to login, keeping the hash, and still throws", async () => {
    global.fetch = asFetchMock(respond(401, { error: "Not authenticated" }));
    const assign = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, hash: "#/p/12/t/5", assign });

    await expect(editorApi("/me")).rejects.toMatchObject({ status: 401 });
    expect(assign).toHaveBeenCalledWith("/auth/login?next=" + encodeURIComponent("/editor#/p/12/t/5"));
  });
});
