/**
 * E2E tests for Export functionality
 */

import { expect, test } from "./fixtures";
import { createRectangle, navigateToMainCanvas, waitForSync } from "./helpers";

test.describe("Export Canvas", () => {
  test.fail(
    "should open export modal with Cmd+E",
    async ({ authenticatedPage }) => {
      await navigateToMainCanvas(authenticatedPage);

      // Press Cmd+E to open export modal (no canvas click needed)
      await authenticatedPage.keyboard.press("Meta+E");

      // Verify modal appears
      await waitForSync(authenticatedPage, 300);
      await expect(authenticatedPage.getByText("Export Canvas")).toBeVisible();
    },
  );

  test("should show export options in modal", async ({ authenticatedPage }) => {
    await navigateToMainCanvas(authenticatedPage);

    // Open export modal via toolbar button
    await authenticatedPage.getByRole("button", { name: /export/i }).click();
    await waitForSync(authenticatedPage, 200);

    // Verify format options
    await expect(
      authenticatedPage.getByText("PNG (Raster Image)"),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByText("SVG (Vector Graphic)"),
    ).toBeVisible();

    // Verify scope options
    await expect(authenticatedPage.getByText("Entire Canvas")).toBeVisible();
    await expect(authenticatedPage.getByText(/Selected Shapes/i)).toBeVisible();

    // Verify quality options for PNG
    await expect(authenticatedPage.getByText("1x (Standard)")).toBeVisible();
    await expect(
      authenticatedPage.getByText("2x (High Definition)"),
    ).toBeVisible();
    await expect(authenticatedPage.getByText("4x (Ultra HD)")).toBeVisible();

    // Verify filename input
    await expect(
      authenticatedPage.getByPlaceholder("Enter filename..."),
    ).toBeVisible();
  });

  test("should disable selection export when no shapes selected", async ({
    authenticatedPage,
  }) => {
    await navigateToMainCanvas(authenticatedPage);

    // Open export modal
    await authenticatedPage.getByRole("button", { name: /export/i }).click();
    await waitForSync(authenticatedPage, 200);

    // Selection option should be disabled
    const selectionRadio = authenticatedPage.getByRole("radio", {
      name: /Selected Shapes/i,
    });
    await expect(selectionRadio).toBeDisabled();
  });

  test.fail(
    "should enable selection export when shapes are selected",
    async ({ authenticatedPage }) => {
      await navigateToMainCanvas(authenticatedPage);

      // Create a rectangle
      await createRectangle(authenticatedPage, 100, 100, 100, 100);
      await waitForSync(authenticatedPage, 100);

      // Select it
      await authenticatedPage.getByRole("button", { name: /^select/i }).click();
      await authenticatedPage
        .locator("canvas")
        .first()
        .click({ position: { x: 150, y: 150 } });

      // Open export modal
      await authenticatedPage.getByRole("button", { name: /export/i }).click();
      await waitForSync(authenticatedPage, 200);

      // Selection option should be enabled
      const selectionRadio = authenticatedPage.getByRole("radio", {
        name: /Selected Shapes/i,
      });
      await expect(selectionRadio).toBeEnabled();
    },
  );

  test("should close modal on cancel", async ({ authenticatedPage }) => {
    await navigateToMainCanvas(authenticatedPage);

    // Open modal via toolbar button
    await authenticatedPage.getByRole("button", { name: /export/i }).click();
    await waitForSync(authenticatedPage, 300);
    await expect(authenticatedPage.getByText("Export Canvas")).toBeVisible({
      timeout: 5000,
    });

    // Click cancel
    await authenticatedPage.getByRole("button", { name: /cancel/i }).click();

    // Modal should close
    await waitForSync(authenticatedPage, 200);
    await expect(
      authenticatedPage.getByText("Export Canvas"),
    ).not.toBeVisible();
  });
});
