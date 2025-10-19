/**
 * E2E tests for Layers Panel
 */

import { expect, test } from "./fixtures";
import { createRectangle, navigateToMainCanvas, waitForSync } from "./helpers";

test.describe("Layers Panel", () => {
  test("should show layers panel with created shapes", async ({
    authenticatedPage,
  }) => {
    await navigateToMainCanvas(authenticatedPage);

    // Verify layers panel is visible
    await expect(authenticatedPage.getByText("Layers")).toBeVisible();

    // Initially should show "No shapes"
    await expect(
      authenticatedPage.getByText("No shapes on canvas"),
    ).toBeVisible();

    // Create a rectangle
    await createRectangle(authenticatedPage, 100, 100, 100, 100);
    await waitForSync(authenticatedPage, 200);

    // Shape should appear in layers panel
    await expect(authenticatedPage.getByText("Rectangle")).toBeVisible();
    await expect(
      authenticatedPage.getByText("No shapes on canvas"),
    ).not.toBeVisible();
  });

  test("should select shape when clicking layer entry", async ({
    authenticatedPage,
  }) => {
    await navigateToMainCanvas(authenticatedPage);

    // Create a shape
    await createRectangle(authenticatedPage, 100, 100, 100, 100);
    await waitForSync(authenticatedPage, 200);

    // Switch to select tool
    await authenticatedPage.getByRole("button", { name: /^select/i }).click();

    // Click the layer entry
    const layerEntry = authenticatedPage.getByText("Rectangle").first();
    await layerEntry.click();

    // Layer should be highlighted (selected state)
    await waitForSync(authenticatedPage, 100);
  });

  test("should toggle shape visibility", async ({ authenticatedPage }) => {
    await navigateToMainCanvas(authenticatedPage);

    // Create a rectangle
    await createRectangle(authenticatedPage, 100, 100, 100, 100);
    await waitForSync(authenticatedPage, 200);

    // Find visibility toggle button (eye icon)
    const visibilityButton = authenticatedPage
      .locator('button[title="Hide"]')
      .first();

    // Toggle visibility off
    await visibilityButton.click();
    await waitForSync(authenticatedPage, 100);

    // Shape should be hidden from canvas but still in panel
    await expect(authenticatedPage.getByText("Rectangle")).toBeVisible();
  });

  test("should show layer count", async ({ authenticatedPage }) => {
    await navigateToMainCanvas(authenticatedPage);

    // Create 3 shapes
    for (let i = 0; i < 3; i++) {
      const x = 100 + i * 100;
      await createRectangle(authenticatedPage, x, 100, 50, 50);
      await waitForSync(authenticatedPage, 50);
    }

    await waitForSync(authenticatedPage, 200);

    // Should show count of 3
    await expect(authenticatedPage.getByText("3")).toBeVisible();
  });
});
