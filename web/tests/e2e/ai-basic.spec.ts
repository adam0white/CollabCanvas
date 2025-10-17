/**
 * AI Canvas Agent - Basic Tools E2E Tests
 * 
 * Tests:
 * - createShape (rectangle, circle, text)
 * - moveShape
 * - getCanvasState
 * - Color normalization
 */

import { test, expect, sendAICommand, waitForShapeCount, deleteAllShapes, waitForAIHistoryEntry } from '../fixtures';

test.describe('AI Basic Tools', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Ensure we start with clean canvas
    await deleteAllShapes(authenticatedPage);
  });

  test.afterEach(async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
  });

  test('AI should create rectangle with explicit dimensions', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a red rectangle at position 100, 200 with width 150 and height 100');
    
    // Should create 1 shape
    await waitForShapeCount(authenticatedPage, 1);
    
    // Verify shape properties
    const shape = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      return shapesMap.get(shapeId);
    });
    
    expect(shape.type).toBe('rectangle');
    expect(shape.x).toBe(100);
    expect(shape.y).toBe(200);
    expect(shape.width).toBe(150);
    expect(shape.height).toBe(100);
    expect(shape.aiGenerated).toBe(true);
    expect(shape.createdBy).toBe('ai-assistant');
  });

  test('AI should normalize color names to hex', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a purple circle at 300, 300 with radius 50');
    
    await waitForShapeCount(authenticatedPage, 1);
    
    const shape = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      return shapesMap.get(shapeId);
    });
    
    expect(shape.type).toBe('circle');
    // Purple should be normalized to #800080
    expect(shape.fill).toBe('#800080');
  });

  test('AI should create circle with specified radius', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a blue circle at 400, 400 with radius 75');
    
    await waitForShapeCount(authenticatedPage, 1);
    
    const shape = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      return shapesMap.get(shapeId);
    });
    
    expect(shape.type).toBe('circle');
    expect(shape.radius).toBe(75);
    expect(shape.x).toBe(400);
    expect(shape.y).toBe(400);
  });

  test('AI should create text shape', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create text that says "Hello World" at position 200, 100');
    
    await waitForShapeCount(authenticatedPage, 1);
    
    const shape = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      return shapesMap.get(shapeId);
    });
    
    expect(shape.type).toBe('text');
    expect(shape.text).toBe('Hello World');
    expect(shape.x).toBe(200);
    expect(shape.y).toBe(100);
  });

  test('AI should move shape to new position', async ({ authenticatedPage }) => {
    // First create a shape
    await sendAICommand(authenticatedPage, 'Create a green rectangle at 100, 100 with width 100 and height 100');
    await waitForShapeCount(authenticatedPage, 1);
    
    // Get shape ID
    const shapeId = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      return Array.from(shapesMap.keys())[0];
    });
    
    // Move the shape
    await sendAICommand(authenticatedPage, `Move the shape to 300, 300`);
    
    // Verify new position
    const shape = await authenticatedPage.evaluate((id) => {
      // @ts-ignore
      const doc = window.yjsDoc;
      return doc.getMap('shapes').get(id);
    }, shapeId);
    
    expect(shape.x).toBe(300);
    expect(shape.y).toBe(300);
  });

  test('AI should handle multiple color variations', async ({ authenticatedPage }) => {
    // Test various color names
    const colorTests = [
      { color: 'red', hex: '#FF0000' },
      { color: 'blue', hex: '#0000FF' },
      { color: 'green', hex: '#00FF00' },
      { color: 'yellow', hex: '#FFFF00' },
    ];
    
    for (const { color, hex } of colorTests) {
      await deleteAllShapes(authenticatedPage);
      await sendAICommand(authenticatedPage, `Create a ${color} rectangle at 100, 100 with width 50 and height 50`);
      await waitForShapeCount(authenticatedPage, 1);
      
      const shape = await authenticatedPage.evaluate(() => {
        // @ts-ignore
        const doc = window.yjsDoc;
        const shapesMap = doc.getMap('shapes');
        const shapeId = Array.from(shapesMap.keys())[0];
        return shapesMap.get(shapeId);
      });
      
      expect(shape.fill).toBe(hex);
    }
  });

  test('AI command should appear in history', async ({ authenticatedPage }) => {
    const prompt = 'Create a rectangle at 100, 100';
    await sendAICommand(authenticatedPage, prompt);
    
    // Verify history entry appears
    await waitForAIHistoryEntry(authenticatedPage, prompt);
  });

  test('AI should handle errors gracefully', async ({ authenticatedPage }) => {
    // Send invalid command
    await sendAICommand(authenticatedPage, 'Create an invalid shape with nonsense parameters');
    
    // Should show error or handle gracefully (not crash)
    // The AI might still try to create something or return an error
    // Key is that the app doesn't crash
    await expect(authenticatedPage.locator('canvas')).toBeVisible();
  });
});

test.describe('AI Command Performance', () => {
  test('simple AI command completes within 10 seconds', async ({ authenticatedPage }) => {
    const startTime = Date.now();
    
    await sendAICommand(authenticatedPage, 'Create a square at 100, 100');
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should complete within 10 seconds (AI.COMMAND_TIMEOUT_MS)
    expect(duration).toBeLessThan(10000);
  });
});
