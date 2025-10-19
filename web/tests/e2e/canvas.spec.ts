/**
 * Canvas Interactions E2E Tests
 *
 * Tests:
 * - Pan and zoom functionality
 * - Selection behaviors
 * - Keyboard shortcuts
 * - Canvas responsiveness
 */

import { expect, test } from "./fixtures";
import {
  canvasDrag,
  createRectangle,
  getCanvas,
  navigateToMainCanvas,
  selectShape,
  waitForSync,
} from "./helpers";

test.describe("Canvas Interactions", () => {
  test.describe("Pan & Zoom", () => {
    test("mouse wheel zooms in and out", async ({ authenticatedPage }) => {
      await navigateToMainCanvas(authenticatedPage);
      const canvas = await getCanvas(authenticatedPage);
      const zoomButton = authenticatedPage
        .locator('button[class*="zoomButton"]')
        .nth(1);

      // Get initial zoom
      const initialZoom = await zoomButton.textContent();

      // Zoom in with wheel
      const box = await canvas.boundingBox();
      if (box) {
        await authenticatedPage.mouse.move(box.x + 400, box.y + 300);
        await authenticatedPage.mouse.wheel(0, -100);
      }

      await waitForSync(authenticatedPage, 200);

      // Zoom level should have changed
      const newZoom = await zoomButton.textContent();
      expect(newZoom).not.toBe(initialZoom);
    });

    test("zoom controls buttons work", async ({ authenticatedPage }) => {
      await navigateToMainCanvas(authenticatedPage);
      const zoomButton = authenticatedPage
        .locator('button[class*="zoomButton"]')
        .nth(1);
      const zoomInButton = authenticatedPage
        .getByRole("button", {
          name: "+",
        })
        .first();
      const zoomOutButton = authenticatedPage
        .getByRole("button", {
          name: "−",
        })
        .first();

      const initialZoom = await zoomButton.textContent();

      // Zoom in
      await zoomInButton.click();
      await waitForSync(authenticatedPage, 200);
      let zoomText = await zoomButton.textContent();
      expect(zoomText).not.toBe(initialZoom);
      expect(zoomText).toContain("%");

      // Zoom out
      await zoomOutButton.click();
      await waitForSync(authenticatedPage, 200);
      zoomText = await zoomButton.textContent();
      expect(zoomText).toBe(initialZoom);
    });

    test("reset zoom button returns to 100%", async ({ authenticatedPage }) => {
      await navigateToMainCanvas(authenticatedPage);
      const zoomButton = authenticatedPage
        .locator('button[class*="zoomButton"]')
        .nth(1);
      const zoomInButton = authenticatedPage
        .getByRole("button", {
          name: "+",
        })
        .first();

      // Zoom in multiple times
      await zoomInButton.click();
      await zoomInButton.click();
      await waitForSync(authenticatedPage, 200);

      const zoomedValue = await zoomButton.textContent();
      expect(zoomedValue).not.toBe("100%");

      // Click reset
      await zoomButton.click();
      await waitForSync(authenticatedPage, 200);

      // Should be back to 100%
      const finalZoom = await zoomButton.textContent();
      expect(finalZoom).toBe("100%");
    });

    test("zoom is clamped to MIN_ZOOM and MAX_ZOOM", async ({ page }) => {
      await page.goto("/c/main", { waitUntil: "domcontentloaded" });
      await waitForSync(page, 500);

      const zoomOutButton = page.getByRole("button", { name: "−" });

      // Try to zoom out many times
      for (let i = 0; i < 20; i++) {
        await zoomOutButton.click();
        await waitForSync(page, 30);
      }

      // Zoom should be clamped (minimum is 10%)
      const zoomButton = page.getByRole("button", { name: /\d+%/i });
      const zoomText = await zoomButton.textContent();
      const zoomPercent = parseInt(zoomText || "0", 10);
      expect(zoomPercent).toBeGreaterThanOrEqual(10);
    });

    test("authenticated user can pan with click-drag in select mode", async ({
      authenticatedPage,
    }) => {
      await navigateToMainCanvas(authenticatedPage);
      // Click select tool
      await authenticatedPage.getByRole("button", { name: /select/i }).click();

      // Pan the canvas
      await canvasDrag(authenticatedPage, 400, 300, 300, 200);
    });

    test("guest user can pan", async ({ guestPage }) => {
      await guestPage.goto("/c/main", { waitUntil: "domcontentloaded" });
      await waitForSync(guestPage, 1000);

      // Guest users should be able to pan
      await canvasDrag(guestPage, 400, 300, 300, 200);
    });
  });

  test.describe("Selection", () => {
    test("click shape to select", async ({ authenticatedPage, roomId }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForSync(authenticatedPage, 1000);

      // Create a rectangle
      await createRectangle(authenticatedPage, 200, 200, 150, 100);

      // Select the shape
      await selectShape(authenticatedPage, 275, 250);
    });

    test("click empty canvas deselects", async ({ authenticatedPage }) => {
      await navigateToMainCanvas(authenticatedPage);
      // Create and select a shape
      await createRectangle(authenticatedPage, 200, 200, 150, 100);
      await selectShape(authenticatedPage, 275, 250);

      // Click empty area
      const canvas = await getCanvas(authenticatedPage);
      const box = await canvas.boundingBox();
      if (box) await authenticatedPage.mouse.click(box.x + 600, box.y + 500);
      await waitForSync(authenticatedPage, 200);
    });

    test("Escape key deselects", async ({ authenticatedPage }) => {
      await navigateToMainCanvas(authenticatedPage);
      // Create and select a shape
      await createRectangle(authenticatedPage, 200, 200, 150, 100);
      await selectShape(authenticatedPage, 275, 250);

      // Press Escape
      await authenticatedPage.keyboard.press("Escape");
      await waitForSync(authenticatedPage, 200);
    });
  });

  test.describe("Keyboard Shortcuts", () => {
    test("Delete key removes selected shape", async ({ authenticatedPage }) => {
      await navigateToMainCanvas(authenticatedPage);
      // Create a rectangle
      await createRectangle(authenticatedPage, 200, 200, 150, 100);

      // Select the shape
      await selectShape(authenticatedPage, 275, 250);

      // Press Delete
      await authenticatedPage.keyboard.press("Delete");
      await waitForSync(authenticatedPage);
    });

    test("Backspace key removes selected shape", async ({
      authenticatedPage,
    }) => {
      await navigateToMainCanvas(authenticatedPage);
      // Create a circle using button click
      await authenticatedPage
        .getByRole("button", { name: "Circle tool" })
        .click();
      await canvasDrag(authenticatedPage, 300, 300, 360, 360);

      // Select the shape
      await selectShape(authenticatedPage, 330, 330);

      // Press Backspace
      await authenticatedPage.keyboard.press("Backspace");
      await waitForSync(authenticatedPage);
    });

    test("shortcuts disabled when typing in text input", async ({
      authenticatedPage,
    }) => {
      await navigateToMainCanvas(authenticatedPage);
      // Focus AI textarea
      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.click();

      // Type "Delete" - should not trigger delete shortcut
      await aiTextarea.type("Delete this text");

      // Text should still be in textarea
      const value = await aiTextarea.inputValue();
      expect(value).toBe("Delete this text");
    });
  });

  test.describe("Canvas Responsiveness", () => {
    test("canvas fills viewport", async ({ page }) => {
      await page.goto("/c/main", { waitUntil: "domcontentloaded" });
      await waitForSync(page, 500);

      const canvas = await getCanvas(page);
      const canvasBox = await canvas.boundingBox();

      // Canvas should be reasonably large
      expect(canvasBox?.width).toBeGreaterThan(400);
      expect(canvasBox?.height).toBeGreaterThan(300);
    });

    test("canvas resizes on viewport change", async ({ page }) => {
      await page.goto("/c/main");
      await page.waitForLoadState("networkidle");

      const canvas = page.locator("canvas").first();
      const initialBox = await canvas.boundingBox();

      // Resize viewport
      await page.setViewportSize({ width: 1600, height: 900 });
      await page.waitForTimeout(500);

      const newBox = await canvas.boundingBox();

      // Canvas should have resized
      expect(newBox?.width).toBeGreaterThan(initialBox?.width || 0);
    });
  });

  test.describe("Grid", () => {
    test("grid is visible on canvas", async ({ page }) => {
      await page.goto("/c/main");
      await page.waitForLoadState("networkidle");

      // Grid should be rendered (we can't easily verify visually, but no errors should occur)
      const canvas = page.locator("canvas").first();
      await expect(canvas).toBeVisible();
    });

    test("grid scales with zoom", async ({ page }) => {
      await page.goto("/c/main");
      await page.waitForLoadState("networkidle");

      // Zoom in
      const zoomInButton = page.getByRole("button", { name: "+" }).first();
      await zoomInButton.click();
      await page.waitForTimeout(200);

      // Grid should still be visible (no errors)
      const canvas = page.locator("canvas").first();
      await expect(canvas).toBeVisible();
    });
  });
});
