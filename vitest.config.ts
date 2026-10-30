import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // e2e/ is Playwright's (npm run test:e2e), not Vitest's
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
  resolve: {
    alias: {
      // Matches the "@/*" import alias from tsconfig.json - Vitest resolves
      // modules through its own Vite-based system, separate from Next.js's
      // build, so this needs its own explicit alias configuration or every
      // "@/..." import fails to resolve during tests despite working fine
      // in the actual Next.js dev/build process.
      "@": path.resolve(__dirname, "."),
    },
  },
});
