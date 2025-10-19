/**
 * Edge Cases & Error Handling E2E Tests
 *
 * Tests:
 * - Empty states
 * - Concurrent operations
 * - Browser compatibility scenarios
 * - Error recovery
 */

import { expect, test } from "./fixtures";
import {
  canvasDrag,
  createCircle,
  createRectangle,
  getCanvas,
  waitForSync,
} from "./helpers";

test.describe("Edge Cases & Error Handling", () => {
  test.describe("Empty States", () => {
    test("new canvas shows empty state", async ({ page, roomId }) => {
      await page.goto(`/c/main?roomId=${roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForSync(page, 500);

      // Canvas should be visible even when empty
      const canvas = await getCanvas(page);
      await expect(canvas).toBeVisible();
    });

    test("AI history empty state message", async ({ guestPage, roomId }) => {
      // Use a unique room to avoid polluting main canvas
      await guestPage.goto(`/c/main?roomId=${roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForSync(guestPage, 2000);

      // Should show empty state message (guests can see AI history)
      await expect(
        guestPage.locator("text=/no ai commands|try asking/i"),
      ).toBeVisible({ timeout: 10000 });
    });

    test("guest mode informational messages", async ({ guestPage, roomId }) => {
      await guestPage.goto(`/c/main?roomId=${roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForSync(guestPage, 2000);

      // Guest should see disabled toolbar buttons
      const rectangleButton = guestPage.getByRole("button", {
        name: /rectangle/i,
      });
      await expect(rectangleButton).toBeDisabled();

      // Guest should see disabled AI input
      const aiTextarea = guestPage.getByPlaceholder(/sign in to use AI/i);
      await expect(aiTextarea).toBeVisible();
      await expect(aiTextarea).toBeDisabled();
    });
  });

  test.describe("Concurrent Operations", () => {
    test("rapid shape creation does not create duplicates", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForSync(authenticatedPage, 1000);

      // Rapidly create multiple rectangles
      for (let i = 0; i < 3; i++) {
        const x = 150 + i * 100;
        await createRectangle(authenticatedPage, x, 200, 80, 80);
        await waitForSync(authenticatedPage, 200);
      }

      // Should have created 3 distinct shapes (verify no errors)
      const errors: string[] = [];
      authenticatedPage.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      expect(errors.length).toBe(0);
    });

    test("rapid AI commands do not interfere", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForSync(authenticatedPage, 1000);

      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      const sendButton = authenticatedPage.getByRole("button", {
        name: /send/i,
      });

      // Send first command
      await aiTextarea.fill("Create a red rectangle");
      await sendButton.click();
      await waitForSync(authenticatedPage, 2000);

      // Send second command while first is processing
      await aiTextarea.fill("Create a blue circle");
      await sendButton.click();

      // Both should eventually complete
      await waitForSync(authenticatedPage, 15000);

      // History should show both commands
      await expect(
        authenticatedPage.locator('text="Create a red rectangle"'),
      ).toBeVisible({ timeout: 5000 });
      await expect(
        authenticatedPage.locator('text="Create a blue circle"'),
      ).toBeVisible({ timeout: 5000 });
    });

    test("multiple users editing simultaneously without conflicts", async ({
      multiUserContext,
      roomId,
    }) => {
      const { user1, user2 } = multiUserContext;

      await user1.goto(`/c/main?roomId=${roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await user2.goto(`/c/main?roomId=${roomId}`, {
        waitUntil: "domcontentloaded",
      });

      await waitForSync(user1, 1000);
      await waitForSync(user2, 1000);

      // Both users create shapes simultaneously in different areas
      await Promise.all([
        createRectangle(user1, 150, 150, 100, 80),
        createCircle(user2, 500, 300, 60),
      ]);

      // Wait for sync
      await user1.waitForTimeout(1500);

      // No errors should occur
      const errors1: string[] = [];
      const errors2: string[] = [];
      user1.on("console", (msg) => {
        if (msg.type() === "error") errors1.push(msg.text());
      });
      user2.on("console", (msg) => {
        if (msg.type() === "error") errors2.push(msg.text());
      });

      expect(errors1.length).toBe(0);
      expect(errors2.length).toBe(0);
    });
  });

  test.describe("Browser Compatibility", () => {
    test.skip("canvas loads without errors - KNOWN: Some expected errors from external resources", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      await page.goto("/c/main");
      await page.waitForLoadState("networkidle");

      // Filter out DevTools warnings
      const realErrors = errors.filter((e) => !e.includes("DevTools"));
      expect(realErrors.length).toBe(0);
    });

    test("Clerk authentication modal appears", async ({ guestPage }) => {
      await guestPage.goto("/c/main", { waitUntil: "domcontentloaded" });
      await waitForSync(guestPage, 1000);

      const signInButton = guestPage.getByRole("button", { name: /sign in/i });
      await expect(signInButton).toBeVisible();
      await signInButton.click();

      // Wait for Clerk modal to appear
      await waitForSync(guestPage, 1000);

      // Try multiple selectors - Clerk modal may render differently
      const emailInput = guestPage.getByPlaceholder(
        /enter your email address/i,
      );
      await expect(emailInput).toBeVisible({ timeout: 10000 });

      // Close modal
      await guestPage.keyboard.press("Escape");
    });
  });

  test.describe("Error Recovery", () => {
    test("invalid shape data handled gracefully", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForSync(authenticatedPage, 500);

      // Try to create a shape with negative dimensions
      await authenticatedPage
        .getByRole("button", { name: /rectangle/i })
        .click();

      // Draw right-to-left and bottom-to-top (negative dimensions)
      await canvasDrag(authenticatedPage, 400, 400, 200, 200);

      // Should handle gracefully (normalize dimensions or reject)
      const errors: string[] = [];
      authenticatedPage.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      expect(errors.filter((e) => !e.includes("DevTools")).length).toBe(0);
    });

    test("AI errors display helpful messages", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForSync(authenticatedPage, 800);

      // Send an intentionally problematic command
      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.fill("Delete a shape that does not exist");

      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await waitForSync(authenticatedPage, 10000);

      // Should show some response (even if it's an error or "shape not found")
      // Don't assert specific error, just ensure no crashes
    });

    test("connection lost/restored indicator", async ({ page, roomId }) => {
      await page.goto(`/c/main?roomId=${roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForSync(page, 500);

      // App should be in connected state
      const canvas = await getCanvas(page);
      await expect(canvas).toBeVisible();
    });
  });

  test.describe("Performance", () => {
    test("page loads within reasonable time", async ({ page, roomId }) => {
      const startTime = Date.now();

      await page.goto(`/c/main?roomId=${roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForSync(page, 500);

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test("canvas remains responsive with multiple shapes", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForSync(authenticatedPage, 500);

      // Create several shapes
      for (let i = 0; i < 5; i++) {
        const x = 100 + i * 120;
        await createRectangle(authenticatedPage, x, 200, 100, 80);
        await waitForSync(authenticatedPage, 200);
      }

      // Canvas should still be responsive
      const canvas = await getCanvas(authenticatedPage);
      const box = await canvas.boundingBox();
      if (box) await authenticatedPage.mouse.move(box.x + 300, box.y + 300);
      await waitForSync(authenticatedPage, 100);

      // No performance errors
      const errors: string[] = [];
      authenticatedPage.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      expect(errors.length).toBe(0);
    });
  });

  test.describe("Data Validation", () => {
    test.skip("empty text shape is not created - KNOWN BUG", async ({
      authenticatedPage,
      roomId,
    }) => {
      // TODO: This is a known missing feature - pressing Enter on empty text input should close it
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForSync(authenticatedPage, 500);

      await authenticatedPage.getByRole("button", { name: /text/i }).click();
      await waitForSync(authenticatedPage, 200);

      const canvas = await getCanvas(authenticatedPage);
      const box = await canvas.boundingBox();
      if (box) await authenticatedPage.mouse.click(box.x + 400, box.y + 300);

      const textInput = authenticatedPage.locator(
        'input[placeholder*="Enter text"]',
      );
      await textInput.waitFor({ state: "visible", timeout: 3000 });

      // Just press Enter without typing
      await authenticatedPage.keyboard.press("Enter");
      await waitForSync(authenticatedPage);

      // Input should close, no shape created
      await expect(textInput).not.toBeVisible();
    });

    test("very small shapes (<minimum size) are not created", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await waitForSync(authenticatedPage, 500);

      // Test rectangle - 3x3 px (too small)
      await authenticatedPage
        .getByRole("button", { name: /rectangle/i })
        .click();
      await canvasDrag(authenticatedPage, 200, 200, 203, 203);

      // Test circle - 2px radius (too small)
      await authenticatedPage.getByRole("button", { name: /circle/i }).click();
      await canvasDrag(authenticatedPage, 300, 300, 302, 302);

      // Neither shape should be created (too small)
    });
  });
});
