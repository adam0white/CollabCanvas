import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Exclude Playwright tests from Vitest
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/web/tests/e2e/**",
      "**/*.spec.ts",
      "**/playwright.config.ts",
    ],
    poolOptions: {
      workers: {
        wrangler: {
          configPath: resolve("wrangler.toml"),
        },
      },
    },
  },
});
