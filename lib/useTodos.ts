"use client";

import { useCallback, useEffect, useState } from "react";
import { editorApi } from "./editorApi";

export interface Todo {
  id: number;
  text: string;
  done: boolean;
}

/**
 * The signed-in person's own to-dos. Private by the server (every query is
 * keyed by the session's username). After each change the list is re-read,
 * so its order stays the server's: open first, then done.
 */
export function useTodos(): {
  todos: Todo[];
  error: string | null;
  /** Each resolves true on success, so a form keeps what was typed when the server refuses it. */
  add: (text: string) => Promise<boolean>;
  update: (id: number, change: { text?: string; done?: boolean }) => Promise<boolean>;
  remove: (id: number) => Promise<boolean>;
} {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action?: () => Promise<unknown>) => {
    try {
      if (action) await action();
      setTodos((await editorApi<{ todos: Todo[] }>("/todos")).todos);
      setError(null);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; state is set after the await
    run();
  }, [run]);

  return {
    todos,
    error,
    add: (text) => run(() => editorApi("/todos", { method: "POST", body: { text } })),
    update: (id, change) => run(() => editorApi(`/todos/${id}`, { method: "PATCH", body: change })),
    remove: (id) => run(() => editorApi(`/todos/${id}`, { method: "DELETE" })),
  };
}
