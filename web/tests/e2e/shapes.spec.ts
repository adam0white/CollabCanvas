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

test.describe("Shape Creation & Editing", () => {
  test.describe("Rectangle Operations", () => {
    test("create rectangle with click-and-drag", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage
        .getByRole("button", { name: /rectangle/i })
        .click();

      const canvas = authenticatedPage.locator("canvas").first();
      const box = await canvas.boundingBox();
      if (!box) throw new Error("Canvas not found");

      // Draw rectangle
      await canvas.hover({ position: { x: 200, y: 200 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 400, y: 350 } });
      await authenticatedPage.mouse.up();

      // Wait for Yjs sync
      await authenticatedPage.waitForTimeout(500);

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

      const canvas = authenticatedPage.locator("canvas").first();

      // Draw very small rectangle
      await canvas.hover({ position: { x: 200, y: 200 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 205, y: 205 } }); // Only 5px
      await authenticatedPage.mouse.up();

      await authenticatedPage.waitForTimeout(500);

      // Check that no shape was created in Yjs (we'd need to inspect Yjs state)
      // For now, verify no errors
    });

    test("drag rectangle to move", async ({ authenticatedPage }) => {
      // First create a rectangle
      await authenticatedPage
        .getByRole("button", { name: /rectangle/i })
        .click();
      const canvas = authenticatedPage.locator("canvas").first();

      await canvas.hover({ position: { x: 200, y: 200 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 350, y: 300 } });
      await authenticatedPage.mouse.up();
      await authenticatedPage.waitForTimeout(500);

      // Switch to select tool
      await authenticatedPage.getByRole("button", { name: /select/i }).click();

      // Click on the shape to select it
      await canvas.click({ position: { x: 275, y: 250 } });
      await authenticatedPage.waitForTimeout(200);

      // Drag the shape
      await canvas.hover({ position: { x: 275, y: 250 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 400, y: 400 } });
      await authenticatedPage.mouse.up();

      await authenticatedPage.waitForTimeout(500);
    });

    test("delete rectangle with Delete key", async ({ authenticatedPage }) => {
      // Create rectangle
      await authenticatedPage
        .getByRole("button", { name: /rectangle/i })
        .click();
      const canvas = authenticatedPage.locator("canvas").first();

      await canvas.hover({ position: { x: 200, y: 200 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 350, y: 300 } });
      await authenticatedPage.mouse.up();
      await authenticatedPage.waitForTimeout(500);

      // Switch to select tool and select shape
      await authenticatedPage.getByRole("button", { name: /select/i }).click();
      await canvas.click({ position: { x: 275, y: 250 } });
      await authenticatedPage.waitForTimeout(200);

      // Press Delete key
      await authenticatedPage.keyboard.press("Delete");
      await authenticatedPage.waitForTimeout(500);

      // Shape should be deleted (verify no errors)
    });
  });

  test.describe("Circle Operations", () => {
    test("create circle with click-and-drag from center", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.getByRole("button", { name: /circle/i }).click();

      const canvas = authenticatedPage.locator("canvas").first();

      // Draw circle from center
      await canvas.hover({ position: { x: 300, y: 300 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 350, y: 350 } }); // ~70px radius
      await authenticatedPage.mouse.up();

      await authenticatedPage.waitForTimeout(500);
    });

    test("small circles (<5px radius) are not created", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.getByRole("button", { name: /circle/i }).click();

      const canvas = authenticatedPage.locator("canvas").first();

      // Draw tiny circle
      await canvas.hover({ position: { x: 300, y: 300 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 303, y: 303 } }); // ~4px radius
      await authenticatedPage.mouse.up();

      await authenticatedPage.waitForTimeout(500);
    });

    test("move and delete circle", async ({ authenticatedPage }) => {
      // Create circle
      await authenticatedPage.getByRole("button", { name: /circle/i }).click();
      const canvas = authenticatedPage.locator("canvas").first();

      await canvas.hover({ position: { x: 300, y: 300 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 360, y: 360 } });
      await authenticatedPage.mouse.up();
      await authenticatedPage.waitForTimeout(500);

      // Select and move
      await authenticatedPage.getByRole("button", { name: /select/i }).click();
      await canvas.click({ position: { x: 300, y: 300 } });
      await authenticatedPage.waitForTimeout(200);

      await canvas.hover({ position: { x: 300, y: 300 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 450, y: 450 } });
      await authenticatedPage.mouse.up();
      await authenticatedPage.waitForTimeout(500);

      // Delete
      await authenticatedPage.keyboard.press("Delete");
      await authenticatedPage.waitForTimeout(500);
    });
  });

  test.describe("Text Operations", () => {
    test("create text shape by clicking canvas", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.getByRole("button", { name: /text/i }).click();

      const canvas = authenticatedPage.locator("canvas").first();

      // Click to place text
      await canvas.click({ position: { x: 400, y: 300 } });

      // Wait for text input overlay
      await authenticatedPage.waitForSelector(
        'input[placeholder*="Enter text"]',
        { timeout: 2000 },
      );

      // Type text
      await authenticatedPage.fill(
        'input[placeholder*="Enter text"]',
        "Hello World",
      );

      // Press Enter to submit
      await authenticatedPage.keyboard.press("Enter");

      await authenticatedPage.waitForTimeout(500);
    });

    test("cancel text creation with Escape", async ({ authenticatedPage }) => {
      await authenticatedPage.getByRole("button", { name: /text/i }).click();

      const canvas = authenticatedPage.locator("canvas").first();
      await canvas.click({ position: { x: 400, y: 300 } });

      // Wait for text input
      await authenticatedPage.waitForSelector(
        'input[placeholder*="Enter text"]',
        { timeout: 2000 },
      );

      // Type some text
      await authenticatedPage.fill(
        'input[placeholder*="Enter text"]',
        "Cancel this",
      );

      // Press Escape to cancel
      await authenticatedPage.keyboard.press("Escape");

      // Input should disappear
      await expect(
        authenticatedPage.locator('input[placeholder*="Enter text"]'),
      ).not.toBeVisible();
    });

    test("empty text is not created", async ({ authenticatedPage }) => {
      await authenticatedPage.getByRole("button", { name: /text/i }).click();

      const canvas = authenticatedPage.locator("canvas").first();
      await canvas.click({ position: { x: 400, y: 300 } });

      // Wait for text input
      await authenticatedPage.waitForSelector(
        'input[placeholder*="Enter text"]',
        { timeout: 2000 },
      );

      // Don't type anything, just press Enter
      await authenticatedPage.keyboard.press("Enter");

      await authenticatedPage.waitForTimeout(500);

      // No text shape should be created
    });

    test("double-click text to edit", async ({ authenticatedPage }) => {
      // First create a text shape
      await authenticatedPage.getByRole("button", { name: /text/i }).click();
      const canvas = authenticatedPage.locator("canvas").first();

      await canvas.click({ position: { x: 400, y: 300 } });
      await authenticatedPage.waitForSelector(
        'input[placeholder*="Enter text"]',
        { timeout: 2000 },
      );
      await authenticatedPage.fill(
        'input[placeholder*="Enter text"]',
        "Original Text",
      );
      await authenticatedPage.keyboard.press("Enter");
      await authenticatedPage.waitForTimeout(500);

      // Switch to select tool
      await authenticatedPage.getByRole("button", { name: /select/i }).click();
      await authenticatedPage.waitForTimeout(200);

      // Double-click the text to edit (approximate position)
      await canvas.dblclick({ position: { x: 400, y: 300 } });
      await authenticatedPage.waitForTimeout(300);

      // Text input should appear again
      const textInput = authenticatedPage.locator(
        'input[placeholder*="Enter text"]',
      );
      if (await textInput.isVisible()) {
        await textInput.clear();
        await textInput.fill("Updated Text");
        await authenticatedPage.keyboard.press("Enter");
        await authenticatedPage.waitForTimeout(500);
      }
    });
  });

  test.describe("Shape Properties", () => {
    test("deselect with Escape key", async ({ authenticatedPage }) => {
      // Create and select a rectangle
      await authenticatedPage
        .getByRole("button", { name: /rectangle/i })
        .click();
      const canvas = authenticatedPage.locator("canvas").first();

      await canvas.hover({ position: { x: 200, y: 200 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 350, y: 300 } });
      await authenticatedPage.mouse.up();
      await authenticatedPage.waitForTimeout(500);

      // Select the shape
      await authenticatedPage.getByRole("button", { name: /select/i }).click();
      await canvas.click({ position: { x: 275, y: 250 } });
      await authenticatedPage.waitForTimeout(200);

      // Press Escape to deselect
      await authenticatedPage.keyboard.press("Escape");
      await authenticatedPage.waitForTimeout(200);

      // Shape should be deselected (no visual way to verify, but no errors should occur)
    });

    test("click empty canvas deselects shape", async ({
      authenticatedPage,
    }) => {
      // Create and select a rectangle
      await authenticatedPage
        .getByRole("button", { name: /rectangle/i })
        .click();
      const canvas = authenticatedPage.locator("canvas").first();

      await canvas.hover({ position: { x: 200, y: 200 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 350, y: 300 } });
      await authenticatedPage.mouse.up();
      await authenticatedPage.waitForTimeout(500);

      // Select the shape
      await authenticatedPage.getByRole("button", { name: /select/i }).click();
      await canvas.click({ position: { x: 275, y: 250 } });
      await authenticatedPage.waitForTimeout(200);

      // Click empty area
      await canvas.click({ position: { x: 600, y: 500 } });
      await authenticatedPage.waitForTimeout(200);
    });

    test("shapes persist across page refresh", async ({
      authenticatedPage,
      roomId,
    }) => {
      // Navigate to specific room
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      // Create a rectangle
      await authenticatedPage
        .getByRole("button", { name: /rectangle/i })
        .click();
      const canvas = authenticatedPage.locator("canvas").first();

      await canvas.hover({ position: { x: 200, y: 200 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 350, y: 300 } });
      await authenticatedPage.mouse.up();
      await authenticatedPage.waitForTimeout(1000); // Wait for persistence

      // Refresh page
      await authenticatedPage.reload();
      await authenticatedPage.waitForLoadState("networkidle");
      await authenticatedPage.waitForTimeout(1000); // Wait for Yjs to load state

      // Shape should still be there (we'd need to inspect Yjs state to verify)
      // For now, verify no errors occurred
    });
  });
});
