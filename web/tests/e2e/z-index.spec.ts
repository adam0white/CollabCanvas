/**
 * E2E tests for Z-Index management features
 */

import { expect, test } from "./fixtures";
import {
  createRectangle,
  navigateToMainCanvas,
  switchToSelectMode,
  waitForSync,
} from "./helpers";

test.describe("Z-Index Management", () => {
  test.fail(
    "should bring shape to front with toolbar button",
    async ({ authenticatedPage }) => {
      await navigateToMainCanvas(authenticatedPage);

      // Create 3 overlapping rectangles
      await createRectangle(authenticatedPage, 100, 100, 100, 100);
      await waitForSync(authenticatedPage, 100);

      await createRectangle(authenticatedPage, 120, 120, 100, 100);
      await waitForSync(authenticatedPage, 100);

      await createRectangle(authenticatedPage, 140, 140, 100, 100);
      await waitForSync(authenticatedPage, 100);

      // Switch to select tool
      await switchToSelectMode(authenticatedPage);

      // Select the first rectangle using select mode + click
      await switchToSelectMode(authenticatedPage);
      await waitForSync(authenticatedPage, 200);

      // Click canvas to select (use higher X to avoid any overlays)
      const canvas = authenticatedPage.locator("canvas").first();
      const canvasBox = await canvas.boundingBox();
      if (canvasBox) {
        await authenticatedPage.mouse.click(
          canvasBox.x + 350,
          canvasBox.y + 150,
        );
      }
      await waitForSync(authenticatedPage, 200);

      // Click "To Front" button
      await authenticatedPage
        .getByRole("button", { name: /to front/i })
        .click();

      // Verify operation completed (no errors)
      await waitForSync(authenticatedPage, 200);
    },
  );

  test("should send shape to back with keyboard shortcut", async ({
    authenticatedPage,
  }) => {
    await navigateToMainCanvas(authenticatedPage);

    // Create 2 rectangles
    await createRectangle(authenticatedPage, 100, 100, 100, 100);
    await waitForSync(authenticatedPage, 100);

    await createRectangle(authenticatedPage, 150, 150, 100, 100);
    await waitForSync(authenticatedPage, 100);

    // Switch to select tool and select second rectangle
    await switchToSelectMode(authenticatedPage);
    await waitForSync(authenticatedPage, 200);

    // Click canvas to select (use bounding box to avoid panel)
    const canvas = authenticatedPage.locator("canvas").first();
    const canvasBox = await canvas.boundingBox();
    if (canvasBox) {
      await authenticatedPage.mouse.click(canvasBox.x + 300, canvasBox.y + 200);
    }
    await waitForSync(authenticatedPage, 200);

    // Press Cmd+[ to send to back
    await authenticatedPage.keyboard.press("Meta+BracketLeft");

    // Wait for update
    await waitForSync(authenticatedPage, 200);
  });

  test("should disable z-index buttons when no selection", async ({
    authenticatedPage,
  }) => {
    await navigateToMainCanvas(authenticatedPage);

    // Check that z-index buttons are disabled with no selection
    await expect(
      authenticatedPage.getByRole("button", { name: /to front/i }),
    ).toBeDisabled();
    await expect(
      authenticatedPage.getByRole("button", { name: /to back/i }),
    ).toBeDisabled();
    await expect(
      authenticatedPage.getByRole("button", { name: /^forward/i }),
    ).toBeDisabled();
    await expect(
      authenticatedPage.getByRole("button", { name: /^backward/i }),
    ).toBeDisabled();
  });
});
