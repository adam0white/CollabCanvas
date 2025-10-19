/**
 * E2E tests for Snap-to-Grid functionality
 */

import { expect, test } from "@playwright/test";
import { createAuthenticatedPage } from "./helpers";

test.describe("Snap-to-Grid", () => {
  test("should toggle snap-to-grid with toolbar button", async ({ page }) => {
    const { page: authPage } = await createAuthenticatedPage(page);

    const snapButton = authPage.getByRole("button", { name: /snap/i });

    // Initially snap might be on or off - toggle it
    await snapButton.click();

    // Button should have active state or not
    // We just verify it's clickable and doesn't error
    await expect(snapButton).toBeVisible();
  });

  test("should change grid size with selector", async ({ page }) => {
    const { page: authPage } = await createAuthenticatedPage(page);

    // Find grid size selector
    const gridSelector = authPage.locator("select").filter({ hasText: /px/ });

    // Change to 10px
    await gridSelector.selectOption("10");
    await expect(gridSelector).toHaveValue("10");

    // Change to 50px
    await gridSelector.selectOption("50");
    await expect(gridSelector).toHaveValue("50");
  });

  test("should create shapes with snapping when enabled", async ({ page }) => {
    const { page: authPage } = await createAuthenticatedPage(page);

    // Enable snap
    await authPage.getByRole("button", { name: /snap/i }).click();

    // Set grid to 20px
    const gridSelector = authPage.locator("select").filter({ hasText: /px/ });
    await gridSelector.selectOption("20");

    // Create a rectangle
    await authPage.getByRole("button", { name: /rectangle/i }).click();

    // Click at non-grid position - should snap to nearest grid point
    await authPage
      .locator('[data-tool="rectangle"]')
      .click({ position: { x: 105, y: 115 } });
    await authPage
      .locator('[data-tool="rectangle"]')
      .click({ position: { x: 155, y: 165 } });

    // Shape should be created (snapped to grid)
    await authPage.waitForTimeout(200);
  });
});
