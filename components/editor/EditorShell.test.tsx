import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor, act } from "@testing-library/react";
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

  it("shows the deleted notice once, not on every later visit to that parent", async () => {
    window.location.hash = "#/p/12/t/5";
    backend({ "/me": ADMIN, "/projects/12": PROJECT, "/tapes/6": { ...TAPE, tape: { ...TAPE.tape, id: 6 } } });
    const { findByText, queryByText, findByRole } = render(<EditorShell />);
    expect(await findByText("That was deleted or never existed")).toBeTruthy();
    expect(window.location.hash).toBe("#/p/12");

    act(() => {
      window.location.hash = "#/p/12/t/6";
    });
    await findByRole("heading", { name: "Tape" });
    await waitFor(() => expect(queryByText("That was deleted or never existed")).toBeNull());

    act(() => {
      window.location.hash = "#/p/12";
    });
    await findByRole("heading", { name: "Project" });
    await new Promise((r) => setTimeout(r, 10));
    expect(queryByText("That was deleted or never existed")).toBeNull();
  });

  it("announces the notice through a status region that is always there", async () => {
    window.location.hash = "#/";
    backend({ "/me": ADMIN });
    const { getByRole } = render(<EditorShell />);
    expect(getByRole("status").textContent).toBe("");
  });

  it("leaves Esc to a text field, a select, an editable area and an IME", async () => {
    window.location.hash = "#/p/12";
    backend({ "/me": ADMIN, "/projects/12": PROJECT });
    const { findByRole, getByLabelText } = render(
      <EditorShell
        transfers={
          <>
            <input aria-label="in" />
            <textarea aria-label="ta" />
            <select aria-label="sel" />
            <div aria-label="ce" contentEditable suppressContentEditableWarning />
          </>
        }
      />,
    );
    await findByRole("link", { name: "Ranked grind" });

    for (const label of ["in", "ta", "sel", "ce"]) {
      const el = getByLabelText(label);
      // jsdom does not implement isContentEditable.
      if (label === "ce") Object.defineProperty(el, "isContentEditable", { value: true });
      fireEvent.keyDown(el, { key: "Escape" });
    }
    fireEvent.keyDown(window, { key: "Escape", isComposing: true });
    await new Promise((r) => setTimeout(r, 10));
    expect(window.location.hash).toBe("#/p/12");
  });

  it("moves focus to the new view's heading on navigation", async () => {
    window.location.hash = "#/";
    backend({ "/me": ADMIN, "/projects/12": PROJECT });
    const { findByRole } = render(<EditorShell />);
    await waitFor(async () => expect(document.activeElement).toBe(await findByRole("heading", { name: "Projects" })));

    act(() => {
      window.location.hash = "#/p/12";
    });
    const heading = await findByRole("heading", { name: "Project" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it("marks only the last crumb as the current page; the section link is just current", async () => {
    window.location.hash = "#/p/12";
    backend({ "/me": ADMIN, "/projects/12": PROJECT });
    const { findByRole, getByRole, container } = render(<EditorShell />);
    await findByRole("link", { name: "Ranked grind" });

    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(getByRole("link", { name: "Ranked grind" }).getAttribute("aria-current")).toBe("page");
    expect(getByRole("link", { name: "Projects" }).getAttribute("aria-current")).toBe("true");
  });
});
