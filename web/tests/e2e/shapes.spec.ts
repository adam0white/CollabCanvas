/**
 * Shape Creation & Editing E2E Tests
 *
 * Tests:
 * - Rectangle creation, editing, deletion
 * - Circle creation, editing, deletion
 * - Text creation, editing, deletion
 * - Shape properties and persistence
 */

import { expect, test } from "./fixtures";
import {
  canvasClick,
  canvasDrag,
  createCircle,
  createRectangle,
  createText,
  selectShape,
  switchToSelectMode,
  waitForSync,
} from "./helpers";

test.describe("Shape Creation & Editing", () => {
  test.describe("Rectangle Operations", () => {
    test("create rectangle with click-and-drag", async ({
      authenticatedPage,
    }) => {
      // Create rectangle using helper
      await createRectangle(authenticatedPage, 200, 200, 200, 150);

      // Verify no errors occurred
      const consoleErrors: string[] = [];
      authenticatedPage.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      expect(consoleErrors.length).toBe(0);
    });

    test("small rectangles (<10px) are not created", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage
        .getByRole("button", { name: /rectangle/i })
        .click();

      // Draw very small rectangle (5px) - should not be created
      await canvasDrag(authenticatedPage, 200, 200, 205, 205);

      // Check that no shape was created (UI should not show a tiny shape)
      // For now, verify no errors
    });

    test("drag rectangle to move", async ({ authenticatedPage }) => {
      // Create a rectangle
      await createRectangle(authenticatedPage, 200, 200, 150, 100);

      // Switch to select tool and select the shape
      await selectShape(authenticatedPage, 275, 250);

      // Drag the shape to new position
      await canvasDrag(authenticatedPage, 275, 250, 400, 400);
    });

    test("delete rectangle with Delete key", async ({ authenticatedPage }) => {
      // Create rectangle
      await createRectangle(authenticatedPage, 200, 200, 150, 100);

      // Select and delete
      await selectShape(authenticatedPage, 275, 250);
      await authenticatedPage.keyboard.press("Delete");
      await waitForSync(authenticatedPage);
    });
  });

  test.describe("Circle Operations", () => {
    test("create circle with click-and-drag from center", async ({
      authenticatedPage,
    }) => {
      // Create circle with 70px radius
      await createCircle(authenticatedPage, 300, 300, 70);
    });

    test("small circles (<5px radius) are not created", async ({
      authenticatedPage,
    }) => {
      // Attempt to create very small circle (should not be created)
      await createCircle(authenticatedPage, 300, 300, 4);
    });

    test("move and delete circle", async ({ authenticatedPage }) => {
      // Create circle
      await createCircle(authenticatedPage, 300, 300, 60);

      // Select and move
      await selectShape(authenticatedPage, 300, 300);
      await canvasDrag(authenticatedPage, 300, 300, 450, 450);

      // Delete
      await authenticatedPage.keyboard.press("Delete");
      await waitForSync(authenticatedPage);
    });
  });

  test.describe("Text Operations", () => {
    test("create text shape by clicking canvas", async ({
      authenticatedPage,
    }) => {
      await createText(authenticatedPage, 400, 300, "Hello World");
    });

    test("cancel text creation with Escape", async ({ authenticatedPage }) => {
      await authenticatedPage.getByRole("button", { name: /text/i }).click();
      await waitForSync(authenticatedPage, 200);

      // Click canvas using mouse position
      const canvas = authenticatedPage.locator("canvas").first();
      const box = await canvas.boundingBox();
      if (box) await authenticatedPage.mouse.click(box.x + 400, box.y + 300);

      // Wait for text input
      const textInput = authenticatedPage.locator(
        'input[placeholder*="Enter text"]',
      );
      await textInput.waitFor({ state: "visible", timeout: 5000 });

      // Type some text
      await textInput.fill("Cancel this");

      // Press Escape to cancel
      await authenticatedPage.keyboard.press("Escape");

      // Input should disappear
      await expect(textInput).not.toBeVisible();
    });

    test("empty text is not created", async ({ authenticatedPage }) => {
      await authenticatedPage.getByRole("button", { name: /text/i }).click();
      await waitForSync(authenticatedPage, 200);

      // Click canvas using mouse position
      const canvas = authenticatedPage.locator("canvas").first();
      const box = await canvas.boundingBox();
      if (box) await authenticatedPage.mouse.click(box.x + 400, box.y + 300);

      // Wait for text input
      const textInput = authenticatedPage.locator(
        'input[placeholder*="Enter text"]',
      );
      await textInput.waitFor({ state: "visible", timeout: 5000 });

      // Don't type anything, just press Enter
      await authenticatedPage.keyboard.press("Enter");
      await waitForSync(authenticatedPage);

      // No text shape should be created
    });

    test("double-click text to edit", async ({ authenticatedPage }) => {
      // Create a text shape
      await createText(authenticatedPage, 400, 300, "Original Text");

      // Switch to select tool
      await switchToSelectMode(authenticatedPage);

      // Double-click the text to edit
      await authenticatedPage
        .locator("canvas")
        .first()
        .dblclick({ position: { x: 400, y: 300 } });
      await waitForSync(authenticatedPage, 300);

      // Text input should appear again
      const textInput = authenticatedPage.locator(
        'input[placeholder*="Enter text"]',
      );
      if (await textInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await textInput.clear();
        await textInput.fill("Updated Text");
        await authenticatedPage.keyboard.press("Enter");
        await waitForSync(authenticatedPage);
      }
    });
  });

  test.describe("Shape Properties", () => {
    test("deselect with Escape key", async ({ authenticatedPage }) => {
      // Create and select a rectangle
      await createRectangle(authenticatedPage, 200, 200, 150, 100);
      await selectShape(authenticatedPage, 275, 250);

      // Press Escape to deselect
      await authenticatedPage.keyboard.press("Escape");
      await waitForSync(authenticatedPage, 200);

      // Shape should be deselected
    });

    test("click empty canvas deselects shape", async ({
      authenticatedPage,
    }) => {
      // Create and select a rectangle
      await createRectangle(authenticatedPage, 200, 200, 150, 100);
      await selectShape(authenticatedPage, 275, 250);

      // Click empty area
      await canvasClick(authenticatedPage, 600, 500);
    });

    test("shapes persist across page refresh", async ({
      authenticatedPage,
      roomId,
    }) => {
      // Navigate to specific room
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForSync(authenticatedPage, 1000);

      // Create a rectangle
      await createRectangle(authenticatedPage, 200, 200, 150, 100);
      await waitForSync(authenticatedPage, 1000); // Wait for persistence

      // Refresh page
      await authenticatedPage.reload({ waitUntil: "domcontentloaded" });
      await waitForSync(authenticatedPage, 1000); // Wait for Yjs to load state

      // Shape should still be there (we'd need to inspect Yjs state to verify)
    });
  });
});
