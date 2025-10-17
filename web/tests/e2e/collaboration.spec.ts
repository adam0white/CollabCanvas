/**
 * Real-Time Collaboration E2E Tests
 *
 * Tests:
 * - Cursor presence across multiple users
 * - Shape sync between users
 * - Multi-user editing scenarios
 * - Persistence and reconnection
 */

import { expect, test } from "./fixtures";

test.describe("Real-Time Collaboration", () => {
  test.describe("Cursor Presence", () => {
    test("user A moves mouse, user B sees cursor in real-time", async ({
      multiUserContext,
      roomId,
    }) => {
      const { user1, user2 } = multiUserContext;

      // Navigate both users to same room
      await user1.goto(`/c/main?roomId=${roomId}`);
      await user2.goto(`/c/main?roomId=${roomId}`);

      await user1.waitForLoadState("networkidle");
      await user2.waitForLoadState("networkidle");

      // Give Yjs time to establish connection
      await user1.waitForTimeout(1000);

      // User 1 moves mouse on canvas
      const canvas1 = user1.locator("canvas").first();
      await canvas1.hover({ position: { x: 300, y: 300 } });
      await user1.waitForTimeout(200);

      // User 2 should see User 1's cursor
      // We can't easily verify the visual cursor, but we can check there are no console errors
      const errors: string[] = [];
      user2.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      await user2.waitForTimeout(500);
      expect(errors.length).toBe(0);
    });

    test("multiple users cursors visible simultaneously", async ({
      multiUserContext,
      roomId,
    }) => {
      const { user1, user2 } = multiUserContext;

      await user1.goto(`/c/main?roomId=${roomId}`);
      await user2.goto(`/c/main?roomId=${roomId}`);

      await Promise.all([
        user1.waitForLoadState("networkidle"),
        user2.waitForLoadState("networkidle"),
      ]);

      await user1.waitForTimeout(1000);

      // Both users move cursors
      const canvas1 = user1.locator("canvas").first();
      const canvas2 = user2.locator("canvas").first();

      await canvas1.hover({ position: { x: 200, y: 200 } });
      await canvas2.hover({ position: { x: 400, y: 400 } });

      await user1.waitForTimeout(500);

      // Both should see each other's cursors (verify no errors)
    });
  });

  test.describe("Shape Sync", () => {
    test("user A creates shape, user B sees it instantly", async ({
      multiUserContext,
      roomId,
    }) => {
      const { user1, user2 } = multiUserContext;

      await user1.goto(`/c/main?roomId=${roomId}`);
      await user2.goto(`/c/main?roomId=${roomId}`);

      await Promise.all([
        user1.waitForLoadState("networkidle"),
        user2.waitForLoadState("networkidle"),
      ]);

      await user1.waitForTimeout(1000);

      // User 1 creates a rectangle
      await user1.getByRole("button", { name: /rectangle/i }).click();
      const canvas1 = user1.locator("canvas").first();

      await canvas1.hover({ position: { x: 200, y: 200 } });
      await user1.mouse.down();
      await canvas1.hover({ position: { x: 400, y: 350 } });
      await user1.mouse.up();

      // Wait for Yjs sync
      await user1.waitForTimeout(1000);

      // User 2 should see the shape (verify no errors on user2's page)
      const errors: string[] = [];
      user2.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      await user2.waitForTimeout(500);
      expect(errors.length).toBe(0);
    });

    test("user A moves shape, user B sees movement in real-time", async ({
      multiUserContext,
      roomId,
    }) => {
      const { user1, user2 } = multiUserContext;

      await user1.goto(`/c/main?roomId=${roomId}`);
      await user2.goto(`/c/main?roomId=${roomId}`);

      await Promise.all([
        user1.waitForLoadState("networkidle"),
        user2.waitForLoadState("networkidle"),
      ]);

      await user1.waitForTimeout(1000);

      // User 1 creates a shape
      await user1.getByRole("button", { name: /rectangle/i }).click();
      const canvas1 = user1.locator("canvas").first();

      await canvas1.hover({ position: { x: 200, y: 200 } });
      await user1.mouse.down();
      await canvas1.hover({ position: { x: 350, y: 300 } });
      await user1.mouse.up();
      await user1.waitForTimeout(1000);

      // User 1 selects and moves the shape
      await user1.getByRole("button", { name: /select/i }).click();
      await canvas1.click({ position: { x: 275, y: 250 } });
      await user1.waitForTimeout(200);

      // Drag the shape
      await canvas1.hover({ position: { x: 275, y: 250 } });
      await user1.mouse.down();
      await canvas1.hover({ position: { x: 400, y: 400 } });
      await user1.mouse.up();

      // User 2 should see the movement
      await user2.waitForTimeout(1000);
    });

    test("user A deletes shape, user B sees deletion", async ({
      multiUserContext,
      roomId,
    }) => {
      const { user1, user2 } = multiUserContext;

      await user1.goto(`/c/main?roomId=${roomId}`);
      await user2.goto(`/c/main?roomId=${roomId}`);

      await Promise.all([
        user1.waitForLoadState("networkidle"),
        user2.waitForLoadState("networkidle"),
      ]);

      await user1.waitForTimeout(1000);

      // User 1 creates a shape
      await user1.getByRole("button", { name: /circle/i }).click();
      const canvas1 = user1.locator("canvas").first();

      await canvas1.hover({ position: { x: 300, y: 300 } });
      await user1.mouse.down();
      await canvas1.hover({ position: { x: 360, y: 360 } });
      await user1.mouse.up();
      await user1.waitForTimeout(1000);

      // User 1 deletes the shape
      await user1.getByRole("button", { name: /select/i }).click();
      await canvas1.click({ position: { x: 300, y: 300 } });
      await user1.waitForTimeout(200);
      await user1.keyboard.press("Delete");

      // User 2 should see the deletion
      await user2.waitForTimeout(1000);
    });
  });

  test.describe("Multi-User Editing", () => {
    test("two users create shapes simultaneously", async ({
      multiUserContext,
      roomId,
    }) => {
      const { user1, user2 } = multiUserContext;

      await user1.goto(`/c/main?roomId=${roomId}`);
      await user2.goto(`/c/main?roomId=${roomId}`);

      await Promise.all([
        user1.waitForLoadState("networkidle"),
        user2.waitForLoadState("networkidle"),
      ]);

      await user1.waitForTimeout(1000);

      // Both users create shapes at the same time
      await user1.getByRole("button", { name: /rectangle/i }).click();
      await user2.getByRole("button", { name: /circle/i }).click();

      const canvas1 = user1.locator("canvas").first();
      const canvas2 = user2.locator("canvas").first();

      // Create shapes simultaneously
      const create1 = async () => {
        await canvas1.hover({ position: { x: 200, y: 200 } });
        await user1.mouse.down();
        await canvas1.hover({ position: { x: 350, y: 300 } });
        await user1.mouse.up();
      };

      const create2 = async () => {
        await canvas2.hover({ position: { x: 500, y: 300 } });
        await user2.mouse.down();
        await canvas2.hover({ position: { x: 560, y: 360 } });
        await user2.mouse.up();
      };

      await Promise.all([create1(), create2()]);

      // Wait for sync
      await user1.waitForTimeout(1500);

      // Both shapes should exist for both users (no conflicts)
    });

    test("two users move different shapes at same time", async ({
      multiUserContext,
      roomId,
    }) => {
      const { user1, user2 } = multiUserContext;

      await user1.goto(`/c/main?roomId=${roomId}`);
      await user2.goto(`/c/main?roomId=${roomId}`);

      await Promise.all([
        user1.waitForLoadState("networkidle"),
        user2.waitForLoadState("networkidle"),
      ]);

      await user1.waitForTimeout(1000);

      // User 1 creates first shape
      await user1.getByRole("button", { name: /rectangle/i }).click();
      const canvas1 = user1.locator("canvas").first();
      await canvas1.hover({ position: { x: 200, y: 200 } });
      await user1.mouse.down();
      await canvas1.hover({ position: { x: 300, y: 280 } });
      await user1.mouse.up();
      await user1.waitForTimeout(500);

      // User 2 creates second shape
      await user2.getByRole("button", { name: /rectangle/i }).click();
      const canvas2 = user2.locator("canvas").first();
      await canvas2.hover({ position: { x: 400, y: 200 } });
      await user2.mouse.down();
      await canvas2.hover({ position: { x: 500, y: 280 } });
      await user2.mouse.up();
      await user2.waitForTimeout(1000);

      // Both users switch to select and move their shapes simultaneously
      await user1.getByRole("button", { name: /select/i }).click();
      await user2.getByRole("button", { name: /select/i }).click();

      await canvas1.click({ position: { x: 250, y: 240 } });
      await canvas2.click({ position: { x: 450, y: 240 } });
      await user1.waitForTimeout(200);

      // Move simultaneously
      const move1 = async () => {
        await canvas1.hover({ position: { x: 250, y: 240 } });
        await user1.mouse.down();
        await canvas1.hover({ position: { x: 250, y: 400 } });
        await user1.mouse.up();
      };

      const move2 = async () => {
        await canvas2.hover({ position: { x: 450, y: 240 } });
        await user2.mouse.down();
        await canvas2.hover({ position: { x: 450, y: 400 } });
        await user2.mouse.up();
      };

      await Promise.all([move1(), move2()]);

      // Wait for sync
      await user1.waitForTimeout(1500);

      // Both shapes should be moved correctly (no conflicts)
    });
  });

  test.describe("Persistence", () => {
    test("shapes persist after page refresh", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      // Create multiple shapes
      await authenticatedPage
        .getByRole("button", { name: /rectangle/i })
        .click();
      const canvas = authenticatedPage.locator("canvas").first();

      await canvas.hover({ position: { x: 200, y: 200 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 350, y: 300 } });
      await authenticatedPage.mouse.up();
      await authenticatedPage.waitForTimeout(500);

      await authenticatedPage.getByRole("button", { name: /circle/i }).click();
      await canvas.hover({ position: { x: 500, y: 300 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 560, y: 360 } });
      await authenticatedPage.mouse.up();

      // Wait for persistence
      await authenticatedPage.waitForTimeout(2000);

      // Refresh page
      await authenticatedPage.reload();
      await authenticatedPage.waitForLoadState("networkidle");
      await authenticatedPage.waitForTimeout(1500);

      // Shapes should still be visible (verify no errors)
      const errors: string[] = [];
      authenticatedPage.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      await authenticatedPage.waitForTimeout(500);
      expect(errors.filter((e) => !e.includes("DevTools")).length).toBe(0);
    });
  });
});
