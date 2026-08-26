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
