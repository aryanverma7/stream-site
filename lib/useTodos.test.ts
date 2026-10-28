import { describe, expect, it, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useTodos } from "./useTodos";
import { editorBackend } from "./testUtils";

describe("useTodos", () => {
  afterEach(() => vi.restoreAllMocks());

  it("adds, ticks, edits and deletes, re-reading the list each time", async () => {
    let todos = [{ id: 1, text: "Export", done: false }];
    const fetchMock = editorBackend({
      "/todos": () => ({ todos }),
      "POST /todos": (b: unknown) => {
        todos = [...todos, { id: 2, text: (b as { text: string }).text, done: false }];
        return todos[1];
      },
      "PATCH /todos/1": (b: unknown) => {
        todos = todos.map((t) => (t.id === 1 ? { ...t, ...(b as object) } : t));
        return todos[0];
      },
      "DELETE /todos/2": () => {
        todos = todos.filter((t) => t.id !== 2);
        return { deleted: true };
      },
    });
    const { result } = renderHook(() => useTodos());
    await waitFor(() => expect(result.current.todos).toHaveLength(1));

    await act(() => result.current.add("Colour pass"));
    expect(result.current.todos.map((t) => t.text)).toEqual(["Export", "Colour pass"]);
    await act(() => result.current.update(1, { done: true }));
    expect(result.current.todos[0].done).toBe(true);
    await act(() => result.current.update(1, { text: "Export v2" }));
    expect(result.current.todos[0].text).toBe("Export v2");
    await act(() => result.current.remove(2));
    expect(result.current.todos).toHaveLength(1);
    const sent = fetchMock.mock.calls.filter(([, i]) => i?.method && i.method !== "GET").map(([u, i]) => `${i!.method} ${u} ${i!.body ?? ""}`);
    expect(sent).toEqual([
      'POST /api/editor/todos {"text":"Colour pass"}',
      'PATCH /api/editor/todos/1 {"done":true}',
      'PATCH /api/editor/todos/1 {"text":"Export v2"}',
      "DELETE /api/editor/todos/2 ",
    ]);
  });

  it("shows the server's refusal", async () => {
    editorBackend({ "/todos": { todos: [] }, "POST /todos": { status: 400, body: { error: "A to-do needs some text" } } });
    const { result } = renderHook(() => useTodos());
    await act(() => result.current.add(" "));
    expect(result.current.error).toBe("A to-do needs some text");
  });
});
