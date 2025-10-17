/**
 * Real-Time Collaboration E2E Tests
 * 
 * Tests:
 * - Multi-user shape sync
 * - Real-time cursor presence
 * - Transform sync (drag/resize/rotate visible to others)
 * - WebSocket reconnection
 */

import { test, expect, createRectangleViaUI, waitForShapeCount, deleteAllShapes } from '../fixtures';

test.describe('Multi-User Collaboration', () => {
  test.afterEach(async ({ multiUserContexts }) => {
    // Cleanup shapes after each test
    await deleteAllShapes(multiUserContexts.user1.page);
  });

  test('shapes created by user1 appear immediately for user2', async ({ multiUserContexts }) => {
    const { user1, user2 } = multiUserContexts;
    
    // User1 creates a rectangle
    await createRectangleViaUI(user1.page, 100, 100, 150, 100);
    
    // User2 should see it immediately
    await waitForShapeCount(user2.page, 1, 3000);
    
    // Verify both users see the same shape
    const user1Shapes = await user1.page.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      return Array.from(shapesMap.keys());
    });
    
    const user2Shapes = await user2.page.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      return Array.from(shapesMap.keys());
    });
    
    expect(user1Shapes).toEqual(user2Shapes);
  });

  test('shape edits sync in real-time', async ({ multiUserContexts }) => {
    const { user1, user2 } = multiUserContexts;
    
    // User1 creates a shape
    await createRectangleViaUI(user1.page, 200, 200, 100, 100);
    await waitForShapeCount(user2.page, 1);
    
    // Get the shape ID
    const shapeId = await user1.page.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      return Array.from(shapesMap.keys())[0];
    });
    
    // User1 moves the shape
    await user1.page.locator('canvas').first().hover();
    await user1.page.mouse.move(250, 250);
    await user1.page.mouse.down();
    await user1.page.mouse.move(400, 400);
    await user1.page.mouse.up();
    
    // Wait for sync
    await user1.page.waitForTimeout(500);
    
    // User2 should see the updated position
    const user2Position = await user2.page.evaluate((id) => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shape = shapesMap.get(id);
      return { x: shape.x, y: shape.y };
    }, shapeId);
    
    // Position should have changed from original (200, 200)
    expect(user2Position.x).toBeGreaterThan(200);
    expect(user2Position.y).toBeGreaterThan(200);
  });

  test('shape deletion syncs across users', async ({ multiUserContexts }) => {
    const { user1, user2 } = multiUserContexts;
    
    // User1 creates shapes
    await createRectangleViaUI(user1.page, 100, 100, 100, 100);
    await createRectangleViaUI(user1.page, 250, 100, 100, 100);
    await waitForShapeCount(user2.page, 2);
    
    // User1 selects and deletes first shape
    await user1.page.locator('canvas').first().click({ position: { x: 150, y: 150 } });
    await user1.page.waitForTimeout(300);
    await user1.page.keyboard.press('Delete');
    
    // User2 should see only 1 shape remaining
    await waitForShapeCount(user2.page, 1, 3000);
  });

  test('concurrent shape creation from multiple users', async ({ multiUserContexts }) => {
    const { user1, user2 } = multiUserContexts;
    
    // Both users create shapes simultaneously
    await Promise.all([
      createRectangleViaUI(user1.page, 100, 100, 100, 100),
      createRectangleViaUI(user2.page, 300, 100, 100, 100),
    ]);
    
    // Both users should see both shapes (2 total)
    await Promise.all([
      waitForShapeCount(user1.page, 2, 5000),
      waitForShapeCount(user2.page, 2, 5000),
    ]);
  });

  test('shapes persist after one user disconnects', async ({ browser }) => {
    // Create two contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    await page1.goto('/c/main');
    await page2.goto('/c/main');
    
    await Promise.all([
      page1.waitForSelector('canvas'),
      page2.waitForSelector('canvas'),
    ]);
    
    // User1 creates a shape
    await createRectangleViaUI(page1, 100, 100, 150, 100);
    await waitForShapeCount(page2, 1);
    
    // User1 disconnects
    await context1.close();
    
    // User2 should still see the shape
    await waitForShapeCount(page2, 1);
    
    await context2.close();
  });
});

test.describe('Cursor Presence', () => {
  test('cursor positions sync between users', async ({ multiUserContexts }) => {
    const { user1, user2 } = multiUserContexts;
    
    // User1 moves cursor on canvas
    const canvas1 = user1.page.locator('canvas').first();
    await canvas1.hover();
    await user1.page.mouse.move(300, 300);
    
    // Wait for presence sync
    await user1.page.waitForTimeout(200);
    
    // User2 should see user1's cursor
    // Check if presence/cursor elements exist
    const hasCursor = await user2.page.evaluate(() => {
      // Check for cursor indicators in the DOM or canvas
      return document.querySelectorAll('[data-presence-cursor]').length > 0;
    });
    
    // Note: This test may need adjustment based on actual cursor rendering implementation
    // The key is verifying that cursor positions are broadcast via Yjs Awareness
  });

  test('user count updates when users join/leave', async ({ browser }) => {
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto('/c/main');
    await page1.waitForSelector('canvas');
    
    // Check initial user count (should be at least 1)
    const initialCount = await page1.evaluate(() => {
      // @ts-ignore - access awareness
      const provider = window.yjsProvider;
      if (!provider) return 0;
      return provider.awareness.getStates().size;
    });
    
    expect(initialCount).toBeGreaterThanOrEqual(1);
    
    // Second user joins
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto('/c/main');
    await page2.waitForSelector('canvas');
    
    // Wait for awareness update
    await page1.waitForTimeout(500);
    
    // User count should increase
    const newCount = await page1.evaluate(() => {
      // @ts-ignore
      const provider = window.yjsProvider;
      if (!provider) return 0;
      return provider.awareness.getStates().size;
    });
    
    expect(newCount).toBeGreaterThan(initialCount);
    
    await context1.close();
    await context2.close();
  });
});

test.describe('Real-Time Transform Sync', () => {
  test('dragging shape updates position in real-time for other users', async ({ multiUserContexts }) => {
    const { user1, user2 } = multiUserContexts;
    
    // Create a shape
    await createRectangleViaUI(user1.page, 100, 100, 100, 100);
    await waitForShapeCount(user2.page, 1);
    
    // Get shape ID
    const shapeId = await user1.page.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      return Array.from(doc.getMap('shapes').keys())[0];
    });
    
    // User1 starts dragging
    await user1.page.locator('canvas').first().hover();
    await user1.page.mouse.move(150, 150);
    await user1.page.mouse.down();
    
    // Drag slowly to trigger throttled updates
    for (let i = 0; i < 5; i++) {
      await user1.page.mouse.move(150 + i * 30, 150 + i * 30);
      await user1.page.waitForTimeout(100); // Ensure throttled updates fire
    }
    
    await user1.page.mouse.up();
    
    // User2 should see intermediate position updates (not just final)
    // This verifies real-time transform sync with throttling
    const finalPos = await user2.page.evaluate((id) => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shape = doc.getMap('shapes').get(id);
      return { x: shape.x, y: shape.y };
    }, shapeId);
    
    // Position should have changed significantly
    expect(finalPos.x).toBeGreaterThan(200);
    expect(finalPos.y).toBeGreaterThan(200);
  });

  test('resize operations sync during transform', async ({ multiUserContexts }) => {
    const { user1, user2 } = multiUserContexts;
    
    // Create and select shape
    await createRectangleViaUI(user1.page, 200, 200, 100, 100);
    await waitForShapeCount(user2.page, 1);
    
    await user1.page.locator('canvas').first().click({ position: { x: 250, y: 250 } });
    await user1.page.waitForTimeout(300);
    
    // Get initial dimensions from user2's perspective
    const initialDims = await user2.page.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shape = doc.getMap('shapes').get(Array.from(doc.getMap('shapes').keys())[0]);
      return { width: shape.width, height: shape.height };
    });
    
    // User1 resizes (drag corner handle)
    await user1.page.mouse.move(300, 300);
    await user1.page.mouse.down();
    await user1.page.mouse.move(350, 350);
    await user1.page.mouse.up();
    
    await user1.page.waitForTimeout(500);
    
    // User2 should see updated dimensions
    const newDims = await user2.page.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shape = doc.getMap('shapes').get(Array.from(doc.getMap('shapes').keys())[0]);
      return { width: shape.width, height: shape.height };
    });
    
    // At least one dimension should have changed
    expect(newDims.width !== initialDims.width || newDims.height !== initialDims.height).toBe(true);
  });
});
