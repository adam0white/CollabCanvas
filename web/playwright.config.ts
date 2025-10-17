import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright Configuration for CollabCanvas E2E Tests
 *
 * Features:
 * - Multi-browser testing (Chromium, Firefox)
 * - Parallel execution for speed
 * - Trace on failure for debugging
 * - Video recording on failure
 * - Test isolation with unique room IDs
 */

export default defineConfig({
  testDir: "./tests/e2e",

  // Test execution configuration
  fullyParallel: true, // Run tests in parallel for speed
  forbidOnly: !!process.env.CI, // Fail CI if test.only is left in
  retries: process.env.CI ? 2 : 0, // Retry failed tests in CI
  workers: process.env.CI ? 1 : undefined, // Limit parallelism in CI

  // Reporter configuration
  reporter: [
    ["html", { open: "never" }],
    ["list"],
    ["json", { outputFile: "test-results/results.json" }],
  ],

  // Global test configuration
  use: {
    // Base URL for all tests
    baseURL: "http://localhost:8787",

    // Browser configuration
    trace: "on-first-retry", // Capture trace on first retry
    video: "retain-on-failure", // Keep video only on failure
    screenshot: "only-on-failure", // Screenshot on failure

    // Timeouts
    actionTimeout: 10000, // 10s for actions
    navigationTimeout: 30000, // 30s for page loads
  },

  // Test timeout
  timeout: 60000, // 60s per test (some AI commands may take time)
  expect: {
    timeout: 10000, // 10s for assertions
  },

  // Web server configuration
  webServer: {
    command: "npm run dev",
    url: "http://localhost:8787",
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes to start
    stdout: "pipe",
    stderr: "pipe",
  },

  // Browser projects
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
