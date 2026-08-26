import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * Registers jest-dom's matchers (toBeDisabled, toBeInTheDocument, etc.)
 * into Vitest's expect - @testing-library/jest-dom was already listed as
 * a dependency, but nothing was actually importing its vitest integration
 * entry point, so any test using these very common matchers would fail
 * with "Invalid Chai property" rather than a real assertion failure.
 *
 * Also runs global auto-cleanup for every test file - registered via
 * vitest.config.ts's setupFiles. Without this, DOM cleanup between tests
 * isn't reliably happening in this project (confirmed the hard way twice:
 * once in Dragon.test.tsx, once in MergedChat.test.tsx, both needing their
 * own explicit afterEach(cleanup) before this file existed). Any test file
 * that queries for the same text across multiple `it()` blocks was at
 * real risk of silently accumulating un-cleaned-up renders and hitting a
 * "multiple elements found" failure that has nothing to do with the
 * actual behavior being tested.
 */
afterEach(() => {
  cleanup();
});
