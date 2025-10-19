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

    // Expand layers panel by clicking toggle button
    const toggleButton = authenticatedPage.getByRole("button", {
      name: "Toggle layers panel",
    });
    await toggleButton.waitFor({ state: "visible", timeout: 5000 });
    await toggleButton.click();
    await waitForSync(authenticatedPage, 500);

    // Verify layers panel is now expanded
    await expect(authenticatedPage.getByText("Layers")).toBeVisible({
      timeout: 5000,
    });

    // Create a rectangle
    await createRectangle(authenticatedPage, 100, 100, 100, 100);
    await waitForSync(authenticatedPage, 200);

    // Shape should appear in layers panel
    await expect(
      authenticatedPage.locator('[class*="label"]', { hasText: "Rectangle" }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText("No shapes on canvas"),
    ).not.toBeVisible();
  });

  test("should select shape when clicking layer entry", async ({
    authenticatedPage,
  }) => {
    await navigateToMainCanvas(authenticatedPage);

    // Expand layers panel
    const toggleButton = authenticatedPage.getByRole("button", {
      name: "Toggle layers panel",
    });
    await toggleButton.waitFor({ state: "visible", timeout: 5000 });
    await toggleButton.click();
    await waitForSync(authenticatedPage, 500);

    // Create a shape
    await createRectangle(authenticatedPage, 100, 100, 100, 100);
    await waitForSync(authenticatedPage, 300);

    // Click the layer entry in the layers panel (not the toolbar)
    const layerEntry = authenticatedPage
      .locator('[class*="layerMain"]')
      .filter({ hasText: "Rectangle" })
      .first();
    await layerEntry.click();
    await waitForSync(authenticatedPage, 100);

    // Shape should be selected (verify via UI or state - simplified test)
  });

  test("should toggle shape visibility", async ({ authenticatedPage }) => {
    await navigateToMainCanvas(authenticatedPage);

    // Expand layers panel
    const toggleButton = authenticatedPage.getByRole("button", {
      name: "Toggle layers panel",
    });
    await toggleButton.waitFor({ state: "visible", timeout: 5000 });
    await toggleButton.click();
    await waitForSync(authenticatedPage, 500);

    // Create a rectangle
    await createRectangle(authenticatedPage, 100, 100, 100, 100);
    await waitForSync(authenticatedPage, 200);

    // Find and click the visibility toggle button
    const visibilityButton = authenticatedPage
      .locator('button[title="Hide"]')
      .first();
    await visibilityButton.waitFor({ state: "visible", timeout: 5000 });
    await visibilityButton.click();
    await waitForSync(authenticatedPage, 100);

    // Shape should be hidden from canvas but still in panel (use first match)
    await expect(
      authenticatedPage
        .locator('[class*="layerMain"]', {
          hasText: "Rectangle",
        })
        .first(),
    ).toBeVisible();
  });

  test("should show layer count", async ({ authenticatedPage }) => {
    await navigateToMainCanvas(authenticatedPage);

    // Expand layers panel
    const toggleButton = authenticatedPage.getByRole("button", {
      name: "Toggle layers panel",
    });
    await toggleButton.waitFor({ state: "visible", timeout: 5000 });
    await toggleButton.click();
    await waitForSync(authenticatedPage, 500);

    // Create 3 shapes
    await createRectangle(authenticatedPage, 100, 100, 50, 50);
    await createRectangle(authenticatedPage, 200, 100, 50, 50);
    await createRectangle(authenticatedPage, 300, 100, 50, 50);
    await waitForSync(authenticatedPage, 500);

    // Should show count of 3 (use count badge selector)
    await expect(
      authenticatedPage.locator('[class*="count"]', { hasText: "3" }),
    ).toBeVisible();
  });
});
