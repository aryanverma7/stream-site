import { vi } from "vitest";

/**
 * Vitest doesn't strictly type-check test files when running them (it
 * transpiles and runs, it doesn't do a full tsc pass) - but `next build`
 * DOES run full TypeScript compilation across the whole project,
 * including test files. `vi.fn().mockResolvedValue(...)` infers a return
 * type that doesn't structurally satisfy the strict global `fetch` type,
 * which passes fine under `vitest run` but fails the build. This helper
 * centralizes the necessary cast in one place instead of repeating it at
 * every mock call site - wrap the existing vi.fn()... expression in this
 * rather than restructuring it.
 */
export function asFetchMock(mock: unknown): typeof fetch {
  return mock as typeof fetch;
}

/**
 * A fake /api/editor: keys are "/path" (GET) or "METHOD /path"; a value is
 * the JSON body, `{status, body}` for an error, or a function of the
 * parsed request body returning either. Unlisted paths answer 404.
 */
export function editorBackend(table: Record<string, unknown>) {
  const mock = vi.fn((url: string, init?: RequestInit) => {
    const path = url.replace("/api/editor", "");
    const method = init?.method ?? "GET";
    let entry = table[`${method} ${path}`] ?? (method === "GET" ? table[path] : undefined);
    if (typeof entry === "function") entry = (entry as (body: unknown) => unknown)(init?.body ? JSON.parse(String(init.body)) : undefined);
    const isError = entry && typeof entry === "object" && "status" in entry && "body" in entry;
    const status = entry === undefined ? 404 : isError ? (entry as { status: number }).status : 200;
    const body = entry === undefined ? { error: "Not found" } : isError ? (entry as { body: unknown }).body : entry;
    return Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve(body) });
  });
  global.fetch = asFetchMock(mock);
  return mock;
}
