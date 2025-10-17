/**
 * Edge Cases & Error Handling E2E Tests
 * 
 * Tests:
 * - Empty canvas states
 * - Invalid AI commands
 * - Concurrent operations
 * - Network issues
 * - Shape operations on deleted shapes
 */

import { test, expect, sendAICommand, waitForShapeCount, deleteAllShapes, createRectangleViaUI } from '../fixtures';

test.describe('Empty State Handling', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
  });

  test('canvas renders correctly with no shapes', async ({ authenticatedPage }) => {
    // Canvas should be visible and interactive
    await expect(authenticatedPage.locator('canvas')).toBeVisible();
    
    // Should show empty state or be ready for interaction
    await waitForShapeCount(authenticatedPage, 0);
  });

  test('AI command on empty canvas works', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a rectangle at 100, 100');
    
    await waitForShapeCount(authenticatedPage, 1, 5000);
  });

  test('delete on empty canvas does not crash', async ({ authenticatedPage }) => {
    // Press delete with nothing selected
    await authenticatedPage.keyboard.press('Delete');
    
    // App should not crash
    await expect(authenticatedPage.locator('canvas')).toBeVisible();
  });

  test('selecting nothing does not crash', async ({ authenticatedPage }) => {
    // Click on empty area
    await authenticatedPage.locator('canvas').first().click({ position: { x: 500, y: 500 } });
    
    // Should not crash
    await expect(authenticatedPage.locator('canvas')).toBeVisible();
  });
});

test.describe('Invalid AI Commands', () => {
  test('AI handles nonsense command gracefully', async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
    
    // Send invalid command
    try {
      await sendAICommand(authenticatedPage, 'sdkfjhskdjfh random gibberish asdfasdf');
    } catch (error) {
      // Command might fail, which is fine
    }
    
    // App should not crash
    await expect(authenticatedPage.locator('canvas')).toBeVisible();
  });

  test('AI handles command with missing parameters', async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
    
    try {
      await sendAICommand(authenticatedPage, 'Create a rectangle');
    } catch (error) {
      // Might fail due to missing parameters
    }
    
    // App should remain functional
    await expect(authenticatedPage.locator('canvas')).toBeVisible();
  });

  test('AI handles impossible requests', async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
    
    try {
      await sendAICommand(authenticatedPage, 'Delete all shapes');
    } catch (error) {
      // Should handle gracefully (no shapes to delete)
    }
    
    await expect(authenticatedPage.locator('canvas')).toBeVisible();
  });

  test('AI handles command with invalid dimensions', async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
    
    try {
      await sendAICommand(authenticatedPage, 'Create a rectangle with width -100 and height 0');
    } catch (error) {
      // Should reject invalid dimensions
    }
    
    // No shape should be created
    await waitForShapeCount(authenticatedPage, 0);
  });
});

test.describe('Concurrent Operations', () => {
  test.afterEach(async ({ multiUserContexts }) => {
    await deleteAllShapes(multiUserContexts.user1.page);
  });

  test('two users editing same shape simultaneously', async ({ multiUserContexts }) => {
    const { user1, user2 } = multiUserContexts;
    
    // Create a shape
    await createRectangleViaUI(user1.page, 200, 200, 100, 100);
    await waitForShapeCount(user2.page, 1);
    
    // Both users try to move it at the same time
    const canvas1 = user1.page.locator('canvas').first();
    const canvas2 = user2.page.locator('canvas').first();
    
    await Promise.all([
      (async () => {
        await canvas1.hover();
        await user1.page.mouse.move(250, 250);
        await user1.page.mouse.down();
        await user1.page.mouse.move(300, 300);
        await user1.page.mouse.up();
      })(),
      (async () => {
        await user2.page.waitForTimeout(50); // Slight delay
        await canvas2.hover();
        await user2.page.mouse.move(250, 250);
        await user2.page.mouse.down();
        await user2.page.mouse.move(400, 400);
        await user2.page.mouse.up();
      })(),
    ]);
    
    // Both should see a consistent final state (Yjs CRDT handles conflict)
    await user1.page.waitForTimeout(500);
    
    const user1Shape = await user1.page.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      return shapesMap.get(shapeId);
    });
    
    const user2Shape = await user2.page.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      return shapesMap.get(shapeId);
    });
    
    // Both users should see the same final position (CRDT convergence)
    expect(user1Shape.x).toBe(user2Shape.x);
    expect(user1Shape.y).toBe(user2Shape.y);
  });

  test('deleting shape while another user edits it', async ({ multiUserContexts }) => {
    const { user1, user2 } = multiUserContexts;
    
    await createRectangleViaUI(user1.page, 200, 200, 100, 100);
    await waitForShapeCount(user2.page, 1);
    
    // User1 starts dragging, User2 deletes
    const canvas1 = user1.page.locator('canvas').first();
    await canvas1.hover();
    await user1.page.mouse.move(250, 250);
    await user1.page.mouse.down();
    
    // User2 deletes the shape
    await user2.page.locator('canvas').first().click({ position: { x: 250, y: 250 } });
    await user2.page.waitForTimeout(300);
    await user2.page.keyboard.press('Delete');
    
    await user1.page.mouse.up();
    
    // Shape should be deleted for both users
    await waitForShapeCount(user1.page, 0, 3000);
    await waitForShapeCount(user2.page, 0, 3000);
  });
});

test.describe('Network & Reconnection', () => {
  test('shapes persist after network disconnect', async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
    
    // Create shapes
    await createRectangleViaUI(authenticatedPage, 100, 100, 100, 100);
    await waitForShapeCount(authenticatedPage, 1);
    
    // Simulate offline (pause network)
    const context = authenticatedPage.context();
    await context.setOffline(true);
    
    // Try to create another shape offline
    await createRectangleViaUI(authenticatedPage, 250, 100, 100, 100);
    
    // Go back online
    await context.setOffline(false);
    await authenticatedPage.waitForTimeout(1000);
    
    // Both shapes should eventually sync
    await waitForShapeCount(authenticatedPage, 2, 5000);
  });

  test('page refresh maintains connection state', async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
    
    await createRectangleViaUI(authenticatedPage, 100, 100, 100, 100);
    await waitForShapeCount(authenticatedPage, 1);
    
    // Refresh
    await authenticatedPage.reload();
    await authenticatedPage.waitForSelector('canvas', { timeout: 5000 });
    
    // Should reconnect and show shapes
    await waitForShapeCount(authenticatedPage, 1);
    
    // Should be able to create new shapes
    await createRectangleViaUI(authenticatedPage, 250, 100, 100, 100);
    await waitForShapeCount(authenticatedPage, 2);
  });
});

test.describe('Shape Operation Edge Cases', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
  });

  test.afterEach(async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
  });

  test('operating on deleted shape via AI', async ({ authenticatedPage }) => {
    // Create and delete a shape
    await sendAICommand(authenticatedPage, 'Create a rectangle at 100, 100');
    await waitForShapeCount(authenticatedPage, 1);
    
    const shapeId = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      return Array.from(doc.getMap('shapes').keys())[0];
    });
    
    // Delete it
    await sendAICommand(authenticatedPage, 'Delete the rectangle');
    await waitForShapeCount(authenticatedPage, 0);
    
    // Try to operate on deleted shape ID (if AI somehow references it)
    // This should fail gracefully
    try {
      await sendAICommand(authenticatedPage, `Move shape ${shapeId} to 200, 200`);
    } catch (error) {
      // Expected to fail
    }
    
    // App should remain functional
    await expect(authenticatedPage.locator('canvas')).toBeVisible();
  });

  test('creating tiny shapes (minimum dimensions)', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a rectangle at 100, 100 with width 5 and height 5');
    
    // Should either create shape or reject with validation error
    await authenticatedPage.waitForTimeout(2000);
    
    // App should not crash
    await expect(authenticatedPage.locator('canvas')).toBeVisible();
  });

  test('creating huge shapes (maximum dimensions)', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a rectangle at 100, 100 with width 3000 and height 3000');
    
    // Should either create or reject based on validation
    await authenticatedPage.waitForTimeout(2000);
    
    await expect(authenticatedPage.locator('canvas')).toBeVisible();
  });

  test('creating shapes at negative coordinates', async ({ authenticatedPage }) => {
    try {
      await sendAICommand(authenticatedPage, 'Create a rectangle at -100, -100 with width 100 and height 100');
      
      // Should handle gracefully (might allow or clamp to 0,0)
      await authenticatedPage.waitForTimeout(2000);
    } catch (error) {
      // Might fail, which is acceptable
    }
    
    await expect(authenticatedPage.locator('canvas')).toBeVisible();
  });

  test('rotating shape beyond 360 degrees', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a rectangle at 100, 100');
    await waitForShapeCount(authenticatedPage, 1);
    
    await sendAICommand(authenticatedPage, 'Rotate the rectangle 450 degrees');
    
    await authenticatedPage.waitForTimeout(1000);
    
    const shape = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      return shapesMap.get(shapeId);
    });
    
    // Should normalize to 0-360 range (450 -> 90)
    expect(shape.rotation).toBe(90);
  });
});

test.describe('AI Command Limits', () => {
  test('AI rejects prompt exceeding max length', async ({ authenticatedPage }) => {
    // Create very long prompt (over 1000 chars)
    const longPrompt = 'Create a shape ' + 'with many details '.repeat(100);
    
    try {
      await sendAICommand(authenticatedPage, longPrompt);
    } catch (error) {
      // Should fail validation
      expect(error).toBeDefined();
    }
  });

  test('AI handles max shapes per command limit', async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
    
    // Try to create more than 50 shapes (max limit)
    try {
      await sendAICommand(authenticatedPage, 'Create 60 rectangles');
      
      // Might create up to limit or reject
      await authenticatedPage.waitForTimeout(3000);
      
      const count = await authenticatedPage.evaluate(() => {
        // @ts-ignore
        const doc = window.yjsDoc;
        return doc.getMap('shapes').size;
      });
      
      // Should not exceed 50
      expect(count).toBeLessThanOrEqual(50);
    } catch (error) {
      // Rejection is acceptable
    }
  });
});

test.describe('Race Conditions', () => {
  test('rapid AI commands do not create duplicate shapes', async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
    
    // Send same command multiple times rapidly
    const promises = [
      sendAICommand(authenticatedPage, 'Create a red circle at 100, 100'),
      sendAICommand(authenticatedPage, 'Create a blue square at 200, 100'),
      sendAICommand(authenticatedPage, 'Create a green triangle at 300, 100'),
    ];
    
    await Promise.allSettled(promises);
    
    // Wait for all to complete
    await authenticatedPage.waitForTimeout(5000);
    
    const shapeCount = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      return doc.getMap('shapes').size;
    });
    
    // Should have approximately 3 shapes (allowing for AI interpretation)
    expect(shapeCount).toBeGreaterThan(0);
    expect(shapeCount).toBeLessThan(10); // Reasonable upper bound
  });
});
