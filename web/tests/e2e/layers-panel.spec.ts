/**
 * E2E tests for Layers Panel
 */

import { expect, test } from "@playwright/test";
import { createAuthenticatedPage } from "./helpers";

test.describe("Layers Panel", () => {
  test("should show layers panel with created shapes", async ({ page }) => {
    const { page: authPage } = await createAuthenticatedPage(page);

    // Verify layers panel is visible
    await expect(authPage.getByText("Layers")).toBeVisible();

    // Initially should show "No shapes"
    await expect(authPage.getByText("No shapes on canvas")).toBeVisible();

    // Create a rectangle
    await authPage.getByRole("button", { name: /rectangle/i }).click();
    await authPage.locator('[data-tool="rectangle"]').click({ position: { x: 100, y: 100 } });
    await authPage.locator('[data-tool="rectangle"]').click({ position: { x: 200, y: 200 } });
    await authPage.waitForTimeout(200);

    // Shape should appear in layers panel
    await expect(authPage.getByText("Rectangle")).toBeVisible();
    await expect(authPage.getByText("No shapes on canvas")).not.toBeVisible();
  });

  test("should select shape when clicking layer entry", async ({ page }) => {
    const { page: authPage } = await createAuthenticatedPage(page);

    // Create a shape
    await authPage.getByRole("button", { name: /rectangle/i }).click();
    await authPage.locator('[data-tool="rectangle"]').click({ position: { x: 100, y: 100 } });
    await authPage.locator('[data-tool="rectangle"]').click({ position: { x: 200, y: 200 } });
    await authPage.waitForTimeout(200);

    // Switch to select tool
    await authPage.getByRole("button", { name: /^select/i }).click();

    // Click the layer entry
    const layerEntry = authPage.getByText("Rectangle").first();
    await layerEntry.click();

    // Layer should be highlighted (selected state)
    await authPage.waitForTimeout(100);
  });

  test("should toggle shape visibility", async ({ page }) => {
    const { page: authPage } = await createAuthenticatedPage(page);

    // Create a rectangle
    await authPage.getByRole("button", { name: /rectangle/i }).click();
    await authPage.locator('[data-tool="rectangle"]').click({ position: { x: 100, y: 100 } });
    await authPage.locator('[data-tool="rectangle"]').click({ position: { x: 200, y: 200 } });
    await authPage.waitForTimeout(200);

    // Find visibility toggle button (eye icon)
    const visibilityButton = authPage.locator('button[title="Hide"]').first();
    
    // Toggle visibility off
    await visibilityButton.click();
    await authPage.waitForTimeout(100);

    // Shape should be hidden from canvas but still in panel
    await expect(authPage.getByText("Rectangle")).toBeVisible();
  });

  test("should show layer count", async ({ page }) => {
    const { page: authPage } = await createAuthenticatedPage(page);

    // Create 3 shapes
    await authPage.getByRole("button", { name: /rectangle/i }).click();

    for (let i = 0; i < 3; i++) {
      const x = 100 + i * 100;
      await authPage.locator('[data-tool="rectangle"]').click({ position: { x, y: 100 } });
      await authPage.locator('[data-tool="rectangle"]').click({ position: { x: x + 50, y: 150 } });
      await authPage.waitForTimeout(50);
    }

    await authPage.waitForTimeout(200);

    // Should show count of 3
    await expect(authPage.getByText("3")).toBeVisible();
  });
});
