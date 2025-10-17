/**
 * Playwright Test Fixtures for CollabCanvas
 *
 * Provides reusable fixtures for:
 * - Authenticated users (using stored auth state from setup)
 * - Multi-browser contexts for collaboration testing
 * - Test isolation with unique room IDs
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, type Page } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authFile = path.join(__dirname, "../../playwright/.auth/user.json");

type TestFixtures = {
  authenticatedPage: Page;
  guestPage: Page;
  roomId: string;
  multiUserContext: {
    user1: Page;
    user2: Page;
  };
};

/**
 * Generate unique room ID for test isolation
 */
function generateRoomId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Extended test with custom fixtures
 */
export const test = base.extend<TestFixtures>({
  /**
   * Unique room ID for each test
   */
  roomId: async ({ page }, use) => {
    const roomId = generateRoomId();
    await use(roomId);
  },

  /**
   * Authenticated user page (uses stored auth state from setup)
   */
  authenticatedPage: async ({ page }, use) => {
    // Navigate to app (auth state already loaded from storageState config)
    await page.goto("/c/main", { waitUntil: "domcontentloaded" });

    // Wait for canvas to be ready
    await page
      .locator("canvas")
      .first()
      .waitFor({ state: "visible", timeout: 5000 });

    // Verify authentication by checking toolbar is enabled
    await page.waitForSelector('button:has-text("Rectangle"):not([disabled])', {
      timeout: 5000,
    });

    await use(page);
  },

  /**
   * Guest (unauthenticated) page
   */
  guestPage: async ({ browser }, use) => {
    // Create context without auth state
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto("/c/main", { waitUntil: "domcontentloaded" });

    // Wait for canvas to be ready
    await page
      .locator("canvas")
      .first()
      .waitFor({ state: "visible", timeout: 5000 });

    await use(page);

    await context.close();
  },

  /**
   * Two authenticated users for collaboration testing
   * Both use the stored auth state from setup
   * Note: Tests must navigate to specific rooms using navigateToSharedRoom helper
   */
  multiUserContext: async ({ browser }, use) => {
    // Create two separate browser contexts with the same auth state
    // (simulating two users logged in as the same account)
    const context1 = await browser.newContext({ storageState: authFile });
    const context2 = await browser.newContext({ storageState: authFile });

    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    await use({ user1, user2 });

    // Cleanup
    await context1.close();
    await context2.close();
  },
});

export { expect } from "@playwright/test";
