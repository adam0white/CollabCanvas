/**
 * E2E tests for Export functionality
 */

import { expect, test } from "@playwright/test";
import { createAuthenticatedPage } from "./helpers";

test.describe("Export Canvas", () => {
  test("should open export modal with Cmd+E", async ({ page }) => {
    const { page: authPage } = await createAuthenticatedPage(page);

    // Press Cmd+E to open export modal
    await authPage.keyboard.press("Meta+E");

    // Verify modal appears
    await expect(authPage.getByRole("dialog")).toBeVisible();
    await expect(authPage.getByText("Export Canvas")).toBeVisible();
  });

  test("should show export options in modal", async ({ page }) => {
    const { page: authPage } = await createAuthenticatedPage(page);

    // Open export modal via toolbar button
    await authPage.getByRole("button", { name: /export/i }).click();

    // Verify format options
    await expect(authPage.getByText("PNG (Raster Image)")).toBeVisible();
    await expect(authPage.getByText("SVG (Vector Graphic)")).toBeVisible();

    // Verify scope options
    await expect(authPage.getByText("Entire Canvas")).toBeVisible();
    await expect(authPage.getByText(/Selected Shapes/i)).toBeVisible();

    // Verify quality options for PNG
    await expect(authPage.getByText("1x (Standard)")).toBeVisible();
    await expect(authPage.getByText("2x (High Definition)")).toBeVisible();
    await expect(authPage.getByText("4x (Ultra HD)")).toBeVisible();

    // Verify filename input
    await expect(authPage.getByPlaceholder("Enter filename...")).toBeVisible();
  });

  test("should disable selection export when no shapes selected", async ({
    page,
  }) => {
    const { page: authPage } = await createAuthenticatedPage(page);

    // Open export modal
    await authPage.getByRole("button", { name: /export/i }).click();

    // Selection option should be disabled
    const selectionRadio = authPage.getByRole("radio", {
      name: /Selected Shapes/i,
    });
    await expect(selectionRadio).toBeDisabled();
  });

  test("should enable selection export when shapes are selected", async ({
    page,
  }) => {
    const { page: authPage } = await createAuthenticatedPage(page);

    // Create a rectangle
    await authPage.getByRole("button", { name: /rectangle/i }).click();
    await authPage
      .locator('[data-tool="rectangle"]')
      .click({ position: { x: 100, y: 100 } });
    await authPage
      .locator('[data-tool="rectangle"]')
      .click({ position: { x: 200, y: 200 } });
    await authPage.waitForTimeout(100);

    // Select it
    await authPage.getByRole("button", { name: /^select/i }).click();
    await authPage.locator("canvas").click({ position: { x: 150, y: 150 } });

    // Open export modal
    await authPage.getByRole("button", { name: /export/i }).click();

    // Selection option should be enabled
    const selectionRadio = authPage.getByRole("radio", {
      name: /Selected Shapes/i,
    });
    await expect(selectionRadio).toBeEnabled();
  });

  test("should close modal on cancel", async ({ page }) => {
    const { page: authPage } = await createAuthenticatedPage(page);

    // Open modal
    await authPage.keyboard.press("Meta+E");
    await expect(authPage.getByRole("dialog")).toBeVisible();

    // Click cancel
    await authPage.getByRole("button", { name: /cancel/i }).click();

    // Modal should close
    await expect(authPage.getByRole("dialog")).not.toBeVisible();
  });
});
