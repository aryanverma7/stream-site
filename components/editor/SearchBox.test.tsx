import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SearchBox } from "./SearchBox";

const hits = [
  { kind: "comment", comment_id: 1, iteration_id: 9, tape_id: 4, project_id: 2, version: 3, snippet: "fix <b>jet</b> dash", start_s: 222 },
  { kind: "reply", comment_id: 2, iteration_id: 8, tape_id: 4, project_id: 2, version: 2, snippet: "general note", start_s: null },
];
vi.mock("@/lib/useSearch", () => ({ useSearch: () => ({ hits, loading: false, error: null }) }));

beforeEach(() => {
  window.location.hash = "";
});

describe("SearchBox", () => {
  it("lists hits as plain text and a click goes to the comment's time", () => {
    render(<SearchBox />);
    fireEvent.change(screen.getByLabelText("Search comments"), { target: { value: "jet" } });
    expect(screen.getByText(/fix <b>jet<\/b> dash/)).toBeInTheDocument();
    expect(document.querySelector("li b")).toBeNull();
    fireEvent.click(screen.getByText(/fix <b>/));
    expect(window.location.hash).toBe("#/p/2/t/4/v/9@222");
  });

  it("a null start_s builds no @; Enter picks the first hit; Esc closes", () => {
    render(<SearchBox />);
    const box = screen.getByLabelText("Search comments");
    fireEvent.change(box, { target: { value: "gen" } });
    fireEvent.keyDown(box, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.change(box, { target: { value: "gene" } });
    fireEvent.click(screen.getByText(/general note/));
    expect(window.location.hash).toBe("#/p/2/t/4/v/8");
    fireEvent.change(box, { target: { value: "jet" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(window.location.hash).toBe("#/p/2/t/4/v/9@222");
  });

  it("/ focuses the box, but not while typing in another field", () => {
    render(
      <>
        <SearchBox />
        <textarea aria-label="reply" />
      </>,
    );
    const reply = screen.getByLabelText("reply");
    reply.focus();
    fireEvent.keyDown(reply, { key: "/" });
    expect(document.activeElement).toBe(reply);
    fireEvent.keyDown(document.body, { key: "/" });
    expect(document.activeElement).toBe(screen.getByLabelText("Search comments"));
  });

  it("a pick leaves the box, so the player's keys work again", () => {
    render(<SearchBox />);
    const box = screen.getByLabelText("Search comments");
    box.focus();
    fireEvent.change(box, { target: { value: "jet" } });
    fireEvent.mouseDown(screen.getByText(/fix <b>/));
    fireEvent.click(screen.getByText(/fix <b>/));
    expect(document.activeElement).not.toBe(box);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes when focus goes elsewhere, not when it moves to a hit", () => {
    render(
      <>
        <SearchBox />
        <button>elsewhere</button>
      </>,
    );
    const box = screen.getByLabelText("Search comments");
    box.focus();
    fireEvent.change(box, { target: { value: "jet" } });
    const hit = screen.getByText(/fix <b>/).closest("button")!;
    fireEvent.blur(box, { relatedTarget: hit });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.blur(hit, { relatedTarget: screen.getByText("elsewhere") });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
