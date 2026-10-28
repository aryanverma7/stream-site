import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { EditorShell } from "./EditorShell";
import { asFetchMock } from "@/lib/testUtils";

const ADMIN = { username: "aryan", role: "admin", brand_kit_url: "https://drive.google.com/drive/folders/kit" };
const EDITOR = { username: "cutter", role: "editor", brand_kit_url: null };
const PROJECT = { project: { id: 12, name: "Ranked grind" }, tapes: [] };
const TAPE = { tape: { id: 5, name: "Main", project_id: 12 }, iterations: [{ id: 3, version: 2 }] };

function backend(table: Record<string, unknown>) {
  global.fetch = asFetchMock(
    vi.fn((url: string) => {
      const body = table[url.replace("/api/editor", "")];
      return Promise.resolve(
        body === undefined
          ? { ok: false, status: 404, json: () => Promise.resolve({ error: "Not found" }) }
          : { ok: true, status: 200, json: () => Promise.resolve(body) },
      );
    }),
  );
}

describe("EditorShell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.location.hash = "";
  });

  it("gives the streamer every section, Storage and the brand kit included", async () => {
    window.location.hash = "#/";
    backend({ "/me": ADMIN });
    const { findByRole, getByRole } = render(<EditorShell />);

    expect((await findByRole("link", { name: "Storage" })).getAttribute("href")).toBe("#/storage");
    for (const name of ["Projects", "Home", "Fix list", "To-do"]) expect(getByRole("link", { name })).toBeTruthy();
    const kit = getByRole("link", { name: /Brand kit/ });
    expect(kit.getAttribute("href")).toBe(ADMIN.brand_kit_url);
    expect(kit.getAttribute("target")).toBe("_blank");
  });

  it("hides Storage from the editor, and the brand kit when there is none", async () => {
    window.location.hash = "#/";
    backend({ "/me": EDITOR });
    const { findByRole, queryByRole } = render(<EditorShell />);

    await findByRole("link", { name: "Home" });
    expect(queryByRole("link", { name: "Storage" })).toBeNull();
    expect(queryByRole("link", { name: /Brand kit/ })).toBeNull();
  });

  it("does not show the editor the Storage page even by direct link", async () => {
    window.location.hash = "#/storage";
    backend({ "/me": EDITOR });
    const { findByText } = render(<EditorShell />);
    expect(await findByText("Only the streamer can do this.")).toBeTruthy();
  });

  it("lands the editor on Home and the streamer on Projects", async () => {
    backend({ "/me": EDITOR });
    const { findByRole, unmount } = render(<EditorShell />);
    expect(await findByRole("heading", { name: "Home" })).toBeTruthy();
    expect(window.location.hash).toBe("#/home");
    unmount();

    window.location.hash = "";
    backend({ "/me": ADMIN });
    const admin = render(<EditorShell />);
    expect(await admin.findByRole("heading", { name: "Projects" })).toBeTruthy();
  });

  it("renders the breadcrumb with names, and Esc zooms out one level", async () => {
    window.location.hash = "#/p/12/t/5/v/3";
    backend({ "/me": ADMIN, "/projects/12": PROJECT, "/tapes/5": TAPE });
    const { findByRole } = render(<EditorShell />);

    expect(await findByRole("link", { name: "v2" })).toBeTruthy();
    expect(await findByRole("link", { name: "Ranked grind" })).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(window.location.hash).toBe("#/p/12/t/5"));
  });

  it("ignores Esc that a dialog has already handled", async () => {
    window.location.hash = "#/p/12";
    backend({ "/me": ADMIN, "/projects/12": PROJECT });
    const { findByRole, getByRole } = render(
      <EditorShell
        transfers={
          <div role="dialog" aria-label="Test dialog" onKeyDown={(e) => e.stopPropagation()}>
            <button type="button">inside</button>
          </div>
        }
      />,
    );
    await findByRole("link", { name: "Ranked grind" });

    fireEvent.keyDown(getByRole("button", { name: "inside" }), { key: "Escape" });
    await new Promise((r) => setTimeout(r, 10));
    expect(window.location.hash).toBe("#/p/12");
  });

  it("moves a link to something deleted to the nearest parent that loads, and says so", async () => {
    window.location.hash = "#/p/12/t/5";
    backend({ "/me": ADMIN, "/projects/12": PROJECT });
    const { findByText } = render(<EditorShell />);

    expect(await findByText("That was deleted or never existed")).toBeTruthy();
    expect(window.location.hash).toBe("#/p/12");
  });

  it("renders the bell and Transfers slots", async () => {
    window.location.hash = "#/";
    backend({ "/me": ADMIN });
    const { findByText, getByText } = render(<EditorShell bell={<span>BELL</span>} transfers={<span>XFER</span>} />);
    expect(await findByText("BELL")).toBeTruthy();
    expect(getByText("XFER")).toBeTruthy();
  });
});
