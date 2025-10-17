/**
 * Playwright Test Fixtures for CollabCanvas
 *
 * Provides reusable fixtures for:
 * - Authenticated users (using real Clerk credentials)
 * - Multi-browser contexts for collaboration testing
 * - Test isolation with unique room IDs
 */

import { test as base, type Page } from "@playwright/test";

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
  roomId: async ({}, use) => {
    const roomId = generateRoomId();
    await use(roomId);
  },

  /**
   * Authenticated user page (using real Clerk credentials)
   */
  authenticatedPage: async ({ page, context }, use) => {
    // Get test credentials from environment
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      throw new Error(
        "TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in environment variables",
      );
    }

    // Navigate to app
    await page.goto("/c/main");

    // Wait for Clerk to load
    await page.waitForLoadState("networkidle");

    // Check if already signed in (for faster tests)
    const isSignedIn = await page
      .getByRole("button", { name: /sign out/i })
      .isVisible()
      .catch(() => false);

    if (!isSignedIn) {
      // Click sign in button
      await page.getByRole("button", { name: /sign in/i }).click();

      // Wait for Clerk modal
      await page.waitForSelector("[data-clerk-modal]", { timeout: 10000 });

      // Fill in credentials
      await page.fill('input[name="identifier"]', testEmail);
      await page.click('button[type="submit"]');

      // Wait for password field and fill
      await page.waitForSelector('input[name="password"]', { timeout: 5000 });
      await page.fill('input[name="password"]', testPassword);
      await page.click('button[type="submit"]');

      // Wait for sign in to complete
      await page.waitForSelector("[data-clerk-modal]", {
        state: "hidden",
        timeout: 10000,
      });
    }

    // Verify authentication by checking toolbar is enabled
    await page.waitForSelector('button:has-text("Rectangle"):not([disabled])', {
      timeout: 10000,
    });

    await use(page);

    // Cleanup: sign out after test
    // await page.getByRole('button', { name: /sign out/i }).click().catch(() => {});
  },

  /**
   * Guest (unauthenticated) page
   */
  guestPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/c/main");
    await page.waitForLoadState("networkidle");

    await use(page);

    await context.close();
  },

  /**
   * Two authenticated users for collaboration testing
   */
  multiUserContext: async ({ browser }, use) => {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD must be set");
    }

    // Create two separate browser contexts (simulating two users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    // Sign in both users
    for (const page of [user1, user2]) {
      await page.goto("/c/main");
      await page.waitForLoadState("networkidle");

      const isSignedIn = await page
        .getByRole("button", { name: /sign out/i })
        .isVisible()
        .catch(() => false);

      if (!isSignedIn) {
        await page.getByRole("button", { name: /sign in/i }).click();
        await page.waitForSelector("[data-clerk-modal]", { timeout: 10000 });
        await page.fill('input[name="identifier"]', testEmail);
        await page.click('button[type="submit"]');
        await page.waitForSelector('input[name="password"]', { timeout: 5000 });
        await page.fill('input[name="password"]', testPassword);
        await page.click('button[type="submit"]');
        await page.waitForSelector("[data-clerk-modal]", {
          state: "hidden",
          timeout: 10000,
        });
      }
    }

    await use({ user1, user2 });

    // Cleanup
    await context1.close();
    await context2.close();
  },
});

export { expect } from "@playwright/test";
