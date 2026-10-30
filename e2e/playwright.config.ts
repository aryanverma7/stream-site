import { defineConfig, devices } from "@playwright/test";

/**
 * Browser checks for the review player: the built site (out/) in real
 * Chromium and Firefox against the mock backend and mock Drive in mocks.ts.
 * Run `npm run test:e2e` (it builds first). See the README for the WSL libs.
 */
export default defineConfig({
  testDir: ".",
  globalSetup: "./global-setup.ts",
  outputDir: "../test-results",
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: { trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // no audio track, but autoplay must not depend on a pref the streamer's Firefox may have
    { name: "firefox", use: { ...devices["Desktop Firefox"], launchOptions: { firefoxUserPrefs: { "media.autoplay.default": 0 } } } },
  ],
});
