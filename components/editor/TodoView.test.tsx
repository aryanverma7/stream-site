import { describe, expect, it, vi, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { TodoView } from "./TodoView";
import { editorBackend } from "@/lib/testUtils";

describe("TodoView", () => {
  afterEach(() => vi.restoreAllMocks());

  it("adds, ticks, edits and deletes", async () => {
    let todos = [{ id: 1, text: "Export", done: false }];
    const fetchMock = editorBackend({
      "/todos": () => ({ todos }),
      "POST /todos": (b: unknown) => (todos = [...todos, { id: 2, text: (b as { text: string }).text, done: false }]),
      "PATCH /todos/1": (b: unknown) => (todos = todos.map((t) => (t.id === 1 ? { ...t, ...(b as object) } : t))),
      "DELETE /todos/2": () => (todos = todos.filter((t) => t.id !== 2)),
    });
    const { findByText, getByLabelText, getByRole, queryByText } = render(<TodoView />);
    await findByText("Export");

    fireEvent.change(getByLabelText("New to-do"), { target: { value: "Colour pass" } });
    fireEvent.click(getByRole("button", { name: "Add" }));
    await findByText("Colour pass");
    expect((getByLabelText("New to-do") as HTMLInputElement).value).toBe("");

    fireEvent.click(getByRole("checkbox", { name: "Export" }));
    await waitFor(() => expect((getByRole("checkbox", { name: "Export" }) as HTMLInputElement).checked).toBe(true));

    fireEvent.click(getByRole("button", { name: "Edit Export" }));
    fireEvent.change(getByLabelText("To-do text"), { target: { value: "Export v2" } });
    fireEvent.click(getByRole("button", { name: "Save" }));
    await findByText("Export v2");

    fireEvent.click(getByRole("button", { name: "Delete Colour pass" }));
    await waitFor(() => expect(queryByText("Colour pass")).toBeNull());
    expect(fetchMock.mock.calls.filter(([, i]) => i?.method === "PATCH").map(([, i]) => i!.body)).toEqual(['{"done":true}', '{"text":"Export v2"}']);
  });

  it("keeps an edit open with its text when the server refuses it", async () => {
    editorBackend({ "/todos": { todos: [{ id: 1, text: "Export", done: false }] }, "PATCH /todos/1": { status: 500, body: { error: "database is locked" } } });
    const { findByRole, getByLabelText, getByRole } = render(<TodoView />);
    fireEvent.click(await findByRole("button", { name: "Edit Export" }));
    fireEvent.change(getByLabelText("To-do text"), { target: { value: "Export v2" } });
    fireEvent.click(getByRole("button", { name: "Save" }));
    expect((await findByRole("alert")).textContent).toBe("database is locked");
    expect((getByLabelText("To-do text") as HTMLInputElement).value).toBe("Export v2");
  });

  it("keeps the typed text when the server refuses it", async () => {
    editorBackend({ "/todos": { todos: [] }, "POST /todos": { status: 400, body: { error: "A to-do needs some text" } } });
    const { getByLabelText, getByRole, findByRole } = render(<TodoView />);
    fireEvent.change(getByLabelText("New to-do"), { target: { value: "x" } });
    fireEvent.click(getByRole("button", { name: "Add" }));
    expect((await findByRole("alert")).textContent).toBe("A to-do needs some text");
    expect((getByLabelText("New to-do") as HTMLInputElement).value).toBe("x");
  });
});
