"use client";

import { useState } from "react";
import { useTodos, type Todo } from "@/lib/useTodos";

const btn = "label border border-seam px-3 py-1.5 text-xs text-phosphor hover:border-field disabled:opacity-40";
const field = "min-w-0 flex-1 border border-seam bg-ink px-3 py-2 text-sm text-phosphor";

function TodoRow({ todo, todos }: { todo: Todo; todos: ReturnType<typeof useTodos> }) {
  const [editing, setEditing] = useState<string | null>(null);
  if (editing !== null) {
    return (
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          // A refused edit stays open with what was typed; the error shows above the list.
          if (!editing.trim() || editing === todo.text || (await todos.update(todo.id, { text: editing }))) setEditing(null);
        }}
      >
        <input autoFocus aria-label="To-do text" value={editing} onChange={(e) => setEditing(e.target.value)} className={field} />
        <button type="submit" className={btn}>
          Save
        </button>
        <button type="button" onClick={() => setEditing(null)} className={btn}>
          Cancel
        </button>
      </form>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <label className="flex min-w-0 flex-1 items-center gap-3">
        <input type="checkbox" checked={todo.done} onChange={(e) => todos.update(todo.id, { done: e.target.checked })} />
        <span className={todo.done ? "text-dim line-through" : ""}>{todo.text}</span>
      </label>
      <button type="button" aria-label={`Edit ${todo.text}`} onClick={() => setEditing(todo.text)} className={btn}>
        Edit
      </button>
      <button type="button" aria-label={`Delete ${todo.text}`} onClick={() => todos.remove(todo.id)} className={btn}>
        Delete
      </button>
    </div>
  );
}

/** The signed-in person's private to-dos. */
export function TodoView() {
  const todos = useTodos();
  const [text, setText] = useState("");
  return (
    <section className="space-y-6">
      <h2 tabIndex={-1} className="stencil text-4xl">
        To-do
      </h2>
      <p className="text-sm text-dim">Only you can see these.</p>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          if (await todos.add(text)) setText("");
        }}
      >
        <input aria-label="New to-do" value={text} onChange={(e) => setText(e.target.value)} className={field} />
        <button type="submit" className={btn}>
          Add
        </button>
      </form>
      {todos.error && (
        <p role="alert" className="text-rec">
          {todos.error}
        </p>
      )}
      <ul className="grid gap-2">
        {todos.todos.map((t) => (
          <li key={t.id} className="border border-seam bg-bezel px-4 py-3">
            <TodoRow todo={t} todos={todos} />
          </li>
        ))}
      </ul>
    </section>
  );
}
