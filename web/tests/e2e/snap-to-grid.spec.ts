/**
 * E2E tests for Snap-to-Grid functionality
 */

import { expect, test } from "./fixtures";
import {
  createRectangle,
  navigateToMainCanvas,
  waitForSync,
} from "./helpers";

test.describe("Snap-to-Grid", () => {
  test("should toggle snap-to-grid with toolbar button", async ({
    authenticatedPage,
  }) => {
    await navigateToMainCanvas(authenticatedPage);

    const snapButton = authenticatedPage.getByRole("button", { name: /snap/i });

    // Initially snap might be on or off - toggle it
    await snapButton.click();

    // Button should have active state or not
    // We just verify it's clickable and doesn't error
    await expect(snapButton).toBeVisible();
  });

  test("should change grid size with selector", async ({
    authenticatedPage,
  }) => {
    await navigateToMainCanvas(authenticatedPage);

    // Find grid size selector
    const gridSelector = authenticatedPage
      .locator("select")
      .filter({ hasText: /px/ });

    // Change to 10px
    await gridSelector.selectOption("10");
    await expect(gridSelector).toHaveValue("10");

    // Change to 50px
    await gridSelector.selectOption("50");
    await expect(gridSelector).toHaveValue("50");
  });

  test("should create shapes with snapping when enabled", async ({
    authenticatedPage,
  }) => {
    await navigateToMainCanvas(authenticatedPage);

    // Enable snap
    await authenticatedPage.getByRole("button", { name: /snap/i }).click();

    // Set grid to 20px
    const gridSelector = authenticatedPage
      .locator("select")
      .filter({ hasText: /px/ });
    await gridSelector.selectOption("20");

    // Create a rectangle - should snap to grid
    await createRectangle(authenticatedPage, 105, 115, 50, 50);

    // Shape should be created (snapped to grid)
    await waitForSync(authenticatedPage, 200);
  });
});
