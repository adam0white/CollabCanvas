/**
 * E2E tests for Alignment tools
 */

import { expect, test } from "./fixtures";
import { createRectangle, navigateToMainCanvas, waitForSync } from "./helpers";

test.describe("Alignment Tools", () => {
  test("should align shapes to the left with toolbar button", async ({
    authenticatedPage,
  }) => {
    await navigateToMainCanvas(authenticatedPage);

    // Create 3 rectangles at different X positions
    await createRectangle(authenticatedPage, 100, 100, 50, 50);
    await waitForSync(authenticatedPage, 50);

    await createRectangle(authenticatedPage, 200, 100, 50, 50);
    await waitForSync(authenticatedPage, 50);

    await createRectangle(authenticatedPage, 300, 100, 50, 50);
    await waitForSync(authenticatedPage, 50);

    // Switch to select tool
    await authenticatedPage.getByRole("button", { name: /^select/i }).click();

    // Select all rectangles with Cmd+A
    await authenticatedPage.keyboard.press("Meta+A");
    await waitForSync(authenticatedPage, 100);

    // Click align left button (icon-only, use title)
    await authenticatedPage
      .getByRole("button", { name: /Align Left/i })
      .click();

    // Wait for alignment
    await waitForSync(authenticatedPage, 200);
  });

  test("should distribute shapes horizontally", async ({
    authenticatedPage,
  }) => {
    await navigateToMainCanvas(authenticatedPage);

    // Create 4 rectangles
    for (let i = 0; i < 4; i++) {
      const x = 100 + i * 80;
      await createRectangle(authenticatedPage, x, 100, 40, 40);
    }
    await waitForSync(authenticatedPage, 500);

    // Switch to select tool and select all
    await authenticatedPage.getByRole("button", { name: /^select$/i }).first().click();
    await waitForSync(authenticatedPage, 200);
    await authenticatedPage.keyboard.press("Meta+A");
    await waitForSync(authenticatedPage, 500);

    // Verify button is enabled
    const distributeButton = authenticatedPage.getByRole("button", { name: /Distribute Horizontally/i });
    await expect(distributeButton).toBeEnabled({ timeout: 5000 });
    
    // Click distribute horizontally
    await distributeButton.click();

    // Wait for distribution
    await waitForSync(authenticatedPage, 200);
  });

  test("should disable alignment buttons when less than 2 shapes selected", async ({
    authenticatedPage,
  }) => {
    await navigateToMainCanvas(authenticatedPage);

    // Check that alignment buttons are disabled with no selection (use title attribute since buttons are icon-only)
    await expect(
      authenticatedPage.getByRole("button", { name: /Align Left/i }),
    ).toBeDisabled();
    await expect(
      authenticatedPage.getByRole("button", { name: /Align Center/i }),
    ).toBeDisabled();
    await expect(
      authenticatedPage.getByRole("button", { name: /Align Right/i }),
    ).toBeDisabled();
  });

  test("should align shapes with keyboard shortcut", async ({
    authenticatedPage,
  }) => {
    await navigateToMainCanvas(authenticatedPage);

    // Create 2 rectangles
    await createRectangle(authenticatedPage, 100, 100, 50, 50);
    await waitForSync(authenticatedPage, 50);

    await createRectangle(authenticatedPage, 200, 200, 50, 50);
    await waitForSync(authenticatedPage, 50);

    // Select all
    await authenticatedPage.getByRole("button", { name: /^select/i }).click();
    await authenticatedPage.keyboard.press("Meta+A");

    // Use keyboard shortcut for align left
    await authenticatedPage.keyboard.press("Meta+Shift+L");

    await waitForSync(authenticatedPage, 200);
  });
});
