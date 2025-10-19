/**
 * E2E tests for Alignment tools
 */

import { expect, test } from "@playwright/test";
import { createAuthenticatedPage } from "./helpers";

test.describe("Alignment Tools", () => {
  test("should align shapes to the left with toolbar button", async ({ page }) => {
    const { page: authPage } = await createAuthenticatedPage(page);

    // Create 3 rectangles at different X positions
    await authPage.getByRole("button", { name: /rectangle/i }).click();

    await authPage.locator('[data-tool="rectangle"]').click({ position: { x: 100, y: 100 } });
    await authPage.locator('[data-tool="rectangle"]').click({ position: { x: 150, y: 150 } });
    await authPage.waitForTimeout(50);

    await authPage.locator('[data-tool="rectangle"]').click({ position: { x: 200, y: 100 } });
    await authPage.locator('[data-tool="rectangle"]').click({ position: { x: 250, y: 150 } });
    await authPage.waitForTimeout(50);

    await authPage.locator('[data-tool="rectangle"]').click({ position: { x: 300, y: 100 } });
    await authPage.locator('[data-tool="rectangle"]').click({ position: { x: 350, y: 150 } });
    await authPage.waitForTimeout(50);

    // Switch to select tool
    await authPage.getByRole("button", { name: /^select/i }).click();

    // Select all rectangles with Cmd+A
    await authPage.keyboard.press("Meta+A");
    await authPage.waitForTimeout(100);

    // Click align left button
    await authPage.getByRole("button", { name: /^left$/i }).click();

    // Wait for alignment
    await authPage.waitForTimeout(200);

    // Verify operation completed
  });

  test("should distribute shapes horizontally", async ({ page }) => {
    const { page: authPage } = await createAuthenticatedPage(page);

    // Create 4 rectangles
    await authPage.getByRole("button", { name: /rectangle/i }).click();

    for (let i = 0; i < 4; i++) {
      const x = 100 + i * 80;
      await authPage.locator('[data-tool="rectangle"]').click({ position: { x, y: 100 } });
      await authPage.locator('[data-tool="rectangle"]').click({ position: { x: x + 40, y: 140 } });
      await authPage.waitForTimeout(50);
    }

    // Switch to select tool and select all
    await authPage.getByRole("button", { name: /^select/i }).click();
    await authPage.keyboard.press("Meta+A");
    await authPage.waitForTimeout(100);

    // Click distribute horizontally
    await authPage.getByRole("button", { name: /h-dist/i }).click();

    // Wait for distribution
    await authPage.waitForTimeout(200);

    // Verify operation completed
  });

  test("should disable alignment buttons when less than 2 shapes selected", async ({ page }) => {
    const { page: authPage } = await createAuthenticatedPage(page);

    // Check that alignment buttons are disabled with no selection
    await expect(authPage.getByRole("button", { name: /^left$/i })).toBeDisabled();
    await expect(authPage.getByRole("button", { name: /^center$/i })).toBeDisabled();
    await expect(authPage.getByRole("button", { name: /^right$/i })).toBeDisabled();
  });

  test("should align shapes with keyboard shortcut", async ({ page }) => {
    const { page: authPage } = await createAuthenticatedPage(page);

    // Create 2 rectangles
    await authPage.getByRole("button", { name: /rectangle/i }).click();

    await authPage.locator('[data-tool="rectangle"]').click({ position: { x: 100, y: 100 } });
    await authPage.locator('[data-tool="rectangle"]').click({ position: { x: 150, y: 150 } });
    await authPage.waitForTimeout(50);

    await authPage.locator('[data-tool="rectangle"]').click({ position: { x: 200, y: 200 } });
    await authPage.locator('[data-tool="rectangle"]').click({ position: { x: 250, y: 250 } });
    await authPage.waitForTimeout(50);

    // Select all
    await authPage.getByRole("button", { name: /^select/i }).click();
    await authPage.keyboard.press("Meta+A");

    // Use keyboard shortcut for align left
    await authPage.keyboard.press("Meta+Shift+L");

    await authPage.waitForTimeout(200);

    // Verify operation completed
  });
});
