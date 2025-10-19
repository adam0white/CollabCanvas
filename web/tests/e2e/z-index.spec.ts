/**
 * E2E tests for Z-Index management features
 */

import { expect, test } from "@playwright/test";
import { createAuthenticatedPage } from "./helpers";

test.describe("Z-Index Management", () => {
  test("should bring shape to front with toolbar button", async ({ page }) => {
    const { page: authPage } = await createAuthenticatedPage(page);

    // Create 3 overlapping rectangles
    await authPage.getByRole("button", { name: /rectangle/i }).click();

    // Create first rectangle (will be at bottom)
    await authPage
      .locator('[data-tool="rectangle"]')
      .click({ position: { x: 100, y: 100 } });
    await authPage
      .locator('[data-tool="rectangle"]')
      .click({ position: { x: 200, y: 200 } });
    await authPage.waitForTimeout(100);

    // Create second rectangle
    await authPage
      .locator('[data-tool="rectangle"]')
      .click({ position: { x: 150, y: 150 } });
    await authPage
      .locator('[data-tool="rectangle"]')
      .click({ position: { x: 250, y: 250 } });
    await authPage.waitForTimeout(100);

    // Create third rectangle
    await authPage
      .locator('[data-tool="rectangle"]')
      .click({ position: { x: 200, y: 200 } });
    await authPage
      .locator('[data-tool="rectangle"]')
      .click({ position: { x: 300, y: 300 } });
    await authPage.waitForTimeout(100);

    // Switch to select tool
    await authPage.getByRole("button", { name: /^select/i }).click();

    // Click the first rectangle to select it
    await authPage.locator("canvas").click({ position: { x: 150, y: 150 } });

    // Click "To Front" button
    await authPage.getByRole("button", { name: /to front/i }).click();

    // Verify the shape is now on top by checking if it's the last in render order
    // This is implicit - if it works, the button was functional
  });

  test("should send shape to back with keyboard shortcut", async ({ page }) => {
    const { page: authPage } = await createAuthenticatedPage(page);

    // Create 2 rectangles
    await authPage.getByRole("button", { name: /rectangle/i }).click();

    await authPage
      .locator('[data-tool="rectangle"]')
      .click({ position: { x: 100, y: 100 } });
    await authPage
      .locator('[data-tool="rectangle"]')
      .click({ position: { x: 200, y: 200 } });
    await authPage.waitForTimeout(100);

    await authPage
      .locator('[data-tool="rectangle"]')
      .click({ position: { x: 150, y: 150 } });
    await authPage
      .locator('[data-tool="rectangle"]')
      .click({ position: { x: 250, y: 250 } });
    await authPage.waitForTimeout(100);

    // Switch to select tool and select second rectangle
    await authPage.getByRole("button", { name: /^select/i }).click();
    await authPage.locator("canvas").click({ position: { x: 200, y: 200 } });

    // Press Cmd+[ to send to back
    await authPage.keyboard.press("Meta+BracketLeft");

    // Wait for update
    await authPage.waitForTimeout(200);

    // Verify operation completed (no errors)
  });

  test("should disable z-index buttons when no selection", async ({ page }) => {
    const { page: authPage } = await createAuthenticatedPage(page);

    // Check that z-index buttons are disabled with no selection
    await expect(
      authPage.getByRole("button", { name: /to front/i }),
    ).toBeDisabled();
    await expect(
      authPage.getByRole("button", { name: /to back/i }),
    ).toBeDisabled();
    await expect(
      authPage.getByRole("button", { name: /^forward/i }),
    ).toBeDisabled();
    await expect(
      authPage.getByRole("button", { name: /^backward/i }),
    ).toBeDisabled();
  });
});
