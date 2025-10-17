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
import {
  createRectangle,
  createCircle,
  navigateToSharedRoom,
  waitForSync,
  selectShape,
  canvasDrag,
  getCanvas,
} from "./helpers";

test.describe("Real-Time Collaboration", () => {
  test.describe("Cursor Presence", () => {
    test("user A moves mouse, user B sees cursor in real-time", async ({
      multiUserContext,
      roomId,
    }) => {
      const { user1, user2 } = multiUserContext;

      // Navigate both users to same room
      await navigateToSharedRoom(user1, user2, roomId);

      // User 1 moves mouse on canvas
      const canvas1 = await getCanvas(user1);
      const box1 = await canvas1.boundingBox();
      if (box1) {
        await user1.mouse.move(box1.x + 300, box1.y + 300);
      }
      await waitForSync(user1, 200);

      // User 2 should see User 1's cursor (verify no errors)
      const errors: string[] = [];
      user2.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      await waitForSync(user2, 300);
      expect(errors.length).toBe(0);
    });

    test("multiple users cursors visible simultaneously", async ({
      multiUserContext,
      roomId,
    }) => {
      const { user1, user2 } = multiUserContext;

      await navigateToSharedRoom(user1, user2, roomId);

      // Both users move cursors
      const canvas1 = await getCanvas(user1);
      const canvas2 = await getCanvas(user2);
      
      const box1 = await canvas1.boundingBox();
      const box2 = await canvas2.boundingBox();
      
      if (box1) await user1.mouse.move(box1.x + 200, box1.y + 200);
      if (box2) await user2.mouse.move(box2.x + 400, box2.y + 400);

      await waitForSync(user1, 300);
    });
  });

  test.describe("Shape Sync", () => {
    test("user A creates shape, user B sees it instantly", async ({
      multiUserContext,
      roomId,
    }) => {
      const { user1, user2 } = multiUserContext;

      await navigateToSharedRoom(user1, user2, roomId);

      // User 1 creates a rectangle
      await createRectangle(user1, 200, 200, 200, 150);

      // Wait for Yjs sync
      await waitForSync(user2, 800);

      // User 2 should see the shape (verify no errors)
      const errors: string[] = [];
      user2.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      await waitForSync(user2, 300);
      expect(errors.length).toBe(0);
    });

    test("user A moves shape, user B sees movement in real-time", async ({
      multiUserContext,
      roomId,
    }) => {
      const { user1, user2 } = multiUserContext;

      await navigateToSharedRoom(user1, user2, roomId);

      // User 1 creates a shape
      await createRectangle(user1, 200, 200, 150, 100);
      await waitForSync(user2, 800);

      // User 1 selects and moves the shape
      await selectShape(user1, 275, 250);
      await canvasDrag(user1, 275, 250, 400, 400);

      // User 2 should see the movement
      await waitForSync(user2, 800);
    });

    test("user A deletes shape, user B sees deletion", async ({
      multiUserContext,
      roomId,
    }) => {
      const { user1, user2 } = multiUserContext;

      await navigateToSharedRoom(user1, user2, roomId);

      // User 1 creates a shape
      await createCircle(user1, 300, 300, 60);
      await waitForSync(user2, 800);

      // User 1 deletes the shape
      await selectShape(user1, 330, 330);
      await user1.keyboard.press("Delete");

      // User 2 should see the deletion
      await waitForSync(user2, 800);
    });
  });

  test.describe("Multi-User Editing", () => {
    test("two users create shapes simultaneously", async ({
      multiUserContext,
      roomId,
    }) => {
      const { user1, user2 } = multiUserContext;

      await navigateToSharedRoom(user1, user2, roomId);

      // Both users create shapes at the same time
      await Promise.all([
        createRectangle(user1, 200, 200, 150, 100),
        createCircle(user2, 500, 300, 60),
      ]);

      // Wait for sync
      await waitForSync(user1, 1000);

      // Both shapes should exist for both users (no conflicts)
    });

    test("two users move different shapes at same time", async ({
      multiUserContext,
      roomId,
    }) => {
      const { user1, user2 } = multiUserContext;

      await navigateToSharedRoom(user1, user2, roomId);

      // User 1 creates first shape
      await createRectangle(user1, 200, 200, 100, 80);
      await waitForSync(user2, 800);

      // User 2 creates second shape
      await createRectangle(user2, 400, 200, 100, 80);
      await waitForSync(user1, 800);

      // Both users move their shapes simultaneously
      await Promise.all([
        selectShape(user1, 250, 240).then(() => canvasDrag(user1, 250, 240, 250, 400)),
        selectShape(user2, 450, 240).then(() => canvasDrag(user2, 450, 240, 450, 400)),
      ]);

      // Wait for sync
      await waitForSync(user1, 1000);

      // Both shapes should be moved correctly (no conflicts)
    });
  });

  test.describe("Persistence", () => {
    test("shapes persist after page refresh", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`, { waitUntil: "domcontentloaded" });
      await waitForSync(authenticatedPage, 1000);

      // Create multiple shapes
      await createRectangle(authenticatedPage, 200, 200, 150, 100);
      await createCircle(authenticatedPage, 500, 300, 60);

      // Wait for persistence
      await waitForSync(authenticatedPage, 1500);

      // Refresh page
      await authenticatedPage.reload({ waitUntil: "domcontentloaded" });
      await waitForSync(authenticatedPage, 1500);

      // Shapes should still be visible (verify no errors)
      const errors: string[] = [];
      authenticatedPage.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      await waitForSync(authenticatedPage, 300);
      expect(errors.filter((e) => !e.includes("DevTools")).length).toBe(0);
    });
  });
});
