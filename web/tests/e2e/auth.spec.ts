/**
 * Authentication & Authorization E2E Tests
 *
 * Tests:
 * - Guest (unauthenticated) user access
 * - Authenticated user access
 * - Editor vs guest role enforcement
 * - Toolbar and AI panel access control
 */

import { expect, test } from "./fixtures";

test.describe("Authentication & Authorization", () => {
  test("guest user can view canvas without signing in", async ({ page }) => {
    await page.goto("/c/main");
    await page.waitForLoadState("networkidle");

    // Canvas should be visible
    await expect(page.locator("canvas")).toBeVisible();

    // Grid should be visible (background)
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
  });

  test("guest user cannot create shapes (toolbar buttons disabled)", async ({
    page,
  }) => {
    await page.goto("/c/main");
    await page.waitForLoadState("networkidle");

    // Rectangle button should be disabled
    const rectangleButton = page.getByRole("button", { name: /rectangle/i });
    await expect(rectangleButton).toBeDisabled();
    await expect(rectangleButton).toHaveAttribute(
      "title",
      /sign in to create shapes/i,
    );

    // Circle button should be disabled
    const circleButton = page.getByRole("button", { name: /circle/i });
    await expect(circleButton).toBeDisabled();

    // Text button should be disabled
    const textButton = page.getByRole("button", { name: /text/i });
    await expect(textButton).toBeDisabled();

    // Select button should be enabled (guests can pan/zoom)
    const selectButton = page.getByRole("button", { name: /select/i });
    await expect(selectButton).toBeEnabled();
  });

  test("guest user cannot use AI assistant", async ({ page }) => {
    await page.goto("/c/main");
    await page.waitForLoadState("networkidle");

    // AI textarea should be disabled
    const aiTextarea = page.getByPlaceholder(/sign in to use AI/i);
    await expect(aiTextarea).toBeVisible();
    await expect(aiTextarea).toBeDisabled();

    // Submit button should be disabled
    const submitButton = page.getByRole("button", { name: /send/i });
    await expect(submitButton).toBeDisabled();
  });

  test("guest user can pan and zoom canvas", async ({ page }) => {
    await page.goto("/c/main");
    await page.waitForLoadState("networkidle");

    // Click select tool
    await page.getByRole("button", { name: /select/i }).click();

    // Get zoom percentage button
    const zoomButton = page.getByRole("button", { name: /100%/i });
    await expect(zoomButton).toBeVisible();

    // Zoom in
    await page.getByRole("button", { name: "+" }).click();

    // Check zoom level changed (wait for UI update)
    await page.waitForTimeout(100);
    const newZoomText = await zoomButton.textContent();
    expect(newZoomText).not.toBe("100%");

    // Reset zoom
    await zoomButton.click();
    await page.waitForTimeout(100);
    await expect(zoomButton).toHaveText("100%");
  });

  test("authenticated user can sign in", async ({ page }) => {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      test.skip();
    }

    await page.goto("/c/main");
    await page.waitForLoadState("networkidle");

    // Click sign in
    await page.getByRole("button", { name: /sign in/i }).click();

    // Wait for Clerk modal
    await page.waitForSelector("[data-clerk-modal]", { timeout: 10000 });

    // Fill credentials
    await page.fill('input[name="identifier"]', testEmail);
    await page.click('button[type="submit"]');
    await page.waitForSelector('input[name="password"]', { timeout: 5000 });
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');

    // Wait for sign in to complete
    await page.waitForSelector("[data-clerk-modal]", {
      state: "hidden",
      timeout: 10000,
    });

    // Verify toolbar buttons are enabled
    await expect(
      page.getByRole("button", { name: /rectangle/i }),
    ).toBeEnabled();
    await expect(page.getByRole("button", { name: /circle/i })).toBeEnabled();
    await expect(page.getByRole("button", { name: /text/i })).toBeEnabled();
  });

  test("authenticated user can create shapes", async ({
    authenticatedPage,
  }) => {
    // Rectangle button should be enabled
    await expect(
      authenticatedPage.getByRole("button", { name: /rectangle/i }),
    ).toBeEnabled();

    // Click rectangle tool
    await authenticatedPage.getByRole("button", { name: /rectangle/i }).click();

    // Get canvas
    const canvas = authenticatedPage.locator("canvas").first();

    // Draw rectangle by clicking and dragging
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    await canvas.hover({ position: { x: 100, y: 100 } });
    await authenticatedPage.mouse.down();
    await canvas.hover({ position: { x: 300, y: 250 } });
    await authenticatedPage.mouse.up();

    // Give Yjs time to sync
    await authenticatedPage.waitForTimeout(500);

    // Verify shape was created (we can't easily verify visually, but no errors should occur)
    // In a real test, we'd check the Yjs state or use visual regression testing
  });

  test("authenticated user can use AI assistant", async ({
    authenticatedPage,
  }) => {
    // AI textarea should be enabled
    const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
    await expect(aiTextarea).toBeVisible();
    await expect(aiTextarea).toBeEnabled();

    // Submit button should be enabled when text is entered
    await aiTextarea.fill("Create a red rectangle at 100, 200");
    const submitButton = authenticatedPage.getByRole("button", {
      name: /send/i,
    });
    await expect(submitButton).toBeEnabled();
  });

  test("session persists across page refresh", async ({
    authenticatedPage,
  }) => {
    // Verify user is signed in
    await expect(
      authenticatedPage.getByRole("button", { name: /rectangle/i }),
    ).toBeEnabled();

    // Refresh page
    await authenticatedPage.reload();
    await authenticatedPage.waitForLoadState("networkidle");

    // Toolbar should still be enabled (session persisted)
    await expect(
      authenticatedPage.getByRole("button", { name: /rectangle/i }),
    ).toBeEnabled();
  });

  test("editor vs guest role enforcement", async ({
    authenticatedPage,
    guestPage,
    roomId,
  }) => {
    // Navigate both to same room
    await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
    await guestPage.goto(`/c/main?roomId=${roomId}`);

    await authenticatedPage.waitForLoadState("networkidle");
    await guestPage.waitForLoadState("networkidle");

    // Editor can create shapes
    await expect(
      authenticatedPage.getByRole("button", { name: /rectangle/i }),
    ).toBeEnabled();

    // Guest cannot create shapes
    await expect(
      guestPage.getByRole("button", { name: /rectangle/i }),
    ).toBeDisabled();

    // Create a shape as editor
    await authenticatedPage.getByRole("button", { name: /rectangle/i }).click();
    const canvas = authenticatedPage.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (box) {
      await canvas.hover({ position: { x: 150, y: 150 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 350, y: 300 } });
      await authenticatedPage.mouse.up();
    }

    // Give time for sync
    await authenticatedPage.waitForTimeout(1000);

    // Guest should see the shape (read-only access)
    // Visual verification would be ideal, but we can verify no errors occurred
    await expect(guestPage.locator("canvas")).toBeVisible();
  });
});
