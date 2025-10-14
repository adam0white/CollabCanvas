import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    poolOptions: {
      workers: {
        wrangler: {
          configPath: resolve("wrangler.toml"),
        },
      },
    },
  },
});
