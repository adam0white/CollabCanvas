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
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture pattern requires empty object
  roomId: async ({}, use) => {
    const roomId = generateRoomId();
    await use(roomId);
  },

  /**
   * Authenticated user page (uses stored auth state from setup)
   * Note: Auth state is loaded, but tests must navigate to their desired page/room
   */
  authenticatedPage: async ({ page }, use) => {
    // Auth state is already loaded from storageState config
    // Just provide the page for tests to navigate as needed
    await use(page);
  },

  /**
   * Guest (unauthenticated) page
   * Note: Tests must navigate to their desired page/room
   */
  guestPage: async ({ browser }, use) => {
    // Create context without auth state
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await use(page);

    await context.close();
  },

  /**
   * Two authenticated users for collaboration testing
   * Both use the stored auth state from setup
   * Note: Tests must navigate to specific rooms using navigateToSharedRoom helper
   */
  multiUserContext: async ({ browser, browserName }, use) => {
    // Create two separate browser contexts with the same auth state
    // (simulating two users logged in as the same account)
    const contextOptions: any = {
      storageState: authFile,
    };

    // Only add clipboard permissions for Chromium (Firefox doesn't support them)
    if (browserName === "chromium") {
      contextOptions.permissions = ["clipboard-read", "clipboard-write"];
    }

    const context1 = await browser.newContext(contextOptions);
    const context2 = await browser.newContext(contextOptions);

    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    await use({ user1, user2 });

    // Cleanup
    await context1.close();
    await context2.close();
  },
});

export { expect } from "@playwright/test";
