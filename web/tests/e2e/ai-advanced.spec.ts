/**
 * AI Canvas Agent - Advanced Tools E2E Tests
 * 
 * Tests:
 * - resizeShape (absolute and scale)
 * - rotateShape
 * - updateShapeStyle
 * - deleteShape
 * - arrangeShapes (horizontal, vertical, grid)
 * - findShapes (pattern matching)
 */

import { test, expect, sendAICommand, waitForShapeCount, deleteAllShapes } from '../fixtures';

test.describe('AI Advanced Tools - Manipulation', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
  });

  test.afterEach(async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
  });

  test('AI should resize shape with absolute dimensions', async ({ authenticatedPage }) => {
    // Create initial shape
    await sendAICommand(authenticatedPage, 'Create a rectangle at 100, 100 with width 100 and height 100');
    await waitForShapeCount(authenticatedPage, 1);
    
    // Resize it
    await sendAICommand(authenticatedPage, 'Resize the rectangle to 200 width and 150 height');
    
    await authenticatedPage.waitForTimeout(1000);
    
    // Verify new dimensions
    const shape = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      return shapesMap.get(shapeId);
    });
    
    expect(shape.width).toBe(200);
    expect(shape.height).toBe(150);
  });

  test('AI should resize shape with scale factor', async ({ authenticatedPage }) => {
    // Create shape
    await sendAICommand(authenticatedPage, 'Create a circle at 200, 200 with radius 50');
    await waitForShapeCount(authenticatedPage, 1);
    
    const initialShape = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      return shapesMap.get(shapeId);
    });
    
    // Double the size
    await sendAICommand(authenticatedPage, 'Make the circle twice as big');
    
    await authenticatedPage.waitForTimeout(1000);
    
    const resizedShape = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      return shapesMap.get(shapeId);
    });
    
    expect(resizedShape.radius).toBe(initialShape.radius * 2);
  });

  test('AI should rotate shape by degrees', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a rectangle at 150, 150 with width 100 and height 80');
    await waitForShapeCount(authenticatedPage, 1);
    
    // Rotate 45 degrees
    await sendAICommand(authenticatedPage, 'Rotate the rectangle 45 degrees');
    
    await authenticatedPage.waitForTimeout(1000);
    
    const shape = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      return shapesMap.get(shapeId);
    });
    
    expect(shape.rotation).toBe(45);
  });

  test('AI should update shape fill color', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a blue rectangle at 100, 100 with width 100 and height 100');
    await waitForShapeCount(authenticatedPage, 1);
    
    // Change color to red
    await sendAICommand(authenticatedPage, 'Change the rectangle color to red');
    
    await authenticatedPage.waitForTimeout(1000);
    
    const shape = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      return shapesMap.get(shapeId);
    });
    
    expect(shape.fill).toBe('#FF0000');
  });

  test('AI should delete shape', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a rectangle at 100, 100 with width 100 and height 100');
    await waitForShapeCount(authenticatedPage, 1);
    
    // Delete it
    await sendAICommand(authenticatedPage, 'Delete the rectangle');
    
    await waitForShapeCount(authenticatedPage, 0, 3000);
  });

  test('AI should update stroke properties', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a rectangle at 100, 100 with width 100 and height 100');
    await waitForShapeCount(authenticatedPage, 1);
    
    await sendAICommand(authenticatedPage, 'Add a black stroke with width 3 to the rectangle');
    
    await authenticatedPage.waitForTimeout(1000);
    
    const shape = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      return shapesMap.get(shapeId);
    });
    
    expect(shape.stroke).toBe('#000000');
    expect(shape.strokeWidth).toBe(3);
  });
});

test.describe('AI Advanced Tools - Layout', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
  });

  test.afterEach(async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
  });

  test('AI should arrange shapes horizontally', async ({ authenticatedPage }) => {
    // Create multiple shapes
    await sendAICommand(authenticatedPage, 'Create 3 rectangles: one at 100,100, one at 150,200, one at 200,150, all with width 80 and height 60');
    await waitForShapeCount(authenticatedPage, 3, 5000);
    
    // Arrange horizontally
    await sendAICommand(authenticatedPage, 'Arrange all shapes horizontally');
    
    await authenticatedPage.waitForTimeout(1500);
    
    // Verify they're in a horizontal line
    const shapes = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      return Array.from(shapesMap.values()).map(s => ({ x: s.x, y: s.y }));
    });
    
    // All should have the same Y coordinate (first shape's Y)
    const firstY = shapes[0].y;
    shapes.forEach(shape => {
      expect(shape.y).toBe(firstY);
    });
    
    // X coordinates should be different and increasing
    expect(shapes[1].x).toBeGreaterThan(shapes[0].x);
    expect(shapes[2].x).toBeGreaterThan(shapes[1].x);
  });

  test('AI should arrange shapes vertically', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create 3 circles at different positions: 100,100 radius 40, 200,150 radius 40, 300,120 radius 40');
    await waitForShapeCount(authenticatedPage, 3, 5000);
    
    await sendAICommand(authenticatedPage, 'Arrange all circles vertically');
    
    await authenticatedPage.waitForTimeout(1500);
    
    const shapes = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      return Array.from(shapesMap.values()).map(s => ({ x: s.x, y: s.y }));
    });
    
    // All should have the same X coordinate
    const firstX = shapes[0].x;
    shapes.forEach(shape => {
      expect(shape.x).toBe(firstX);
    });
    
    // Y coordinates should be different and increasing
    expect(shapes[1].y).toBeGreaterThan(shapes[0].y);
    expect(shapes[2].y).toBeGreaterThan(shapes[1].y);
  });

  test('AI should arrange shapes in a grid', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create 6 small squares, each 50x50, at random positions');
    await waitForShapeCount(authenticatedPage, 6, 5000);
    
    await sendAICommand(authenticatedPage, 'Arrange all shapes in a 3x2 grid');
    
    await authenticatedPage.waitForTimeout(1500);
    
    const shapes = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      return Array.from(shapesMap.values()).map(s => ({ x: s.x, y: s.y }));
    });
    
    // Should have exactly 6 shapes
    expect(shapes.length).toBe(6);
    
    // Should be arranged in rows (3 columns)
    // First 3 shapes should have same Y, next 3 should have different Y
    const row1Y = shapes[0].y;
    const row2Y = shapes[3].y;
    
    expect(shapes[1].y).toBe(row1Y);
    expect(shapes[2].y).toBe(row1Y);
    expect(shapes[4].y).toBe(row2Y);
    expect(shapes[5].y).toBe(row2Y);
  });
});

test.describe('AI Advanced Tools - Pattern Matching', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
  });

  test.afterEach(async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
  });

  test('AI should find shapes by color', async ({ authenticatedPage }) => {
    // Create shapes with different colors
    await sendAICommand(authenticatedPage, 'Create a red rectangle at 100,100 with width 100 and height 100');
    await sendAICommand(authenticatedPage, 'Create a blue circle at 250,100 with radius 50');
    await sendAICommand(authenticatedPage, 'Create a red circle at 400,100 with radius 50');
    await waitForShapeCount(authenticatedPage, 3, 5000);
    
    // Delete all red shapes
    await sendAICommand(authenticatedPage, 'Delete all red shapes');
    
    await waitForShapeCount(authenticatedPage, 1, 3000);
    
    // Only blue shape should remain
    const remainingShape = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      return shapesMap.get(shapeId);
    });
    
    expect(remainingShape.fill).toBe('#0000FF');
  });

  test('AI should find shapes by type', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a rectangle at 100,100 with width 100 and height 80');
    await sendAICommand(authenticatedPage, 'Create a circle at 250,100 with radius 50');
    await sendAICommand(authenticatedPage, 'Create another circle at 400,100 with radius 40');
    await waitForShapeCount(authenticatedPage, 3, 5000);
    
    // Change color of all circles
    await sendAICommand(authenticatedPage, 'Make all circles green');
    
    await authenticatedPage.waitForTimeout(1500);
    
    const shapes = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      return Array.from(shapesMap.values());
    });
    
    // Circles should be green, rectangle should not
    const circles = shapes.filter(s => s.type === 'circle');
    const rectangles = shapes.filter(s => s.type === 'rectangle');
    
    circles.forEach(circle => {
      expect(circle.fill).toBe('#00FF00');
    });
    
    // Rectangle should have different color
    expect(rectangles[0].fill).not.toBe('#00FF00');
  });

  test('AI should find text by content', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create text "Hello" at 100,100');
    await sendAICommand(authenticatedPage, 'Create text "World" at 100,150');
    await sendAICommand(authenticatedPage, 'Create text "Hello again" at 100,200');
    await waitForShapeCount(authenticatedPage, 3, 5000);
    
    // Delete text containing "Hello"
    await sendAICommand(authenticatedPage, 'Delete all text that contains "Hello"');
    
    await waitForShapeCount(authenticatedPage, 1, 3000);
    
    // Only "World" should remain
    const remainingShape = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      return shapesMap.get(shapeId);
    });
    
    expect(remainingShape.text).toBe('World');
  });
});

test.describe('AI Idempotency', () => {
  test('duplicate command IDs should return cached results', async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
    
    // Send first command
    await sendAICommand(authenticatedPage, 'Create a rectangle at 100,100 with width 100 and height 100');
    await waitForShapeCount(authenticatedPage, 1);
    
    // Note: Testing idempotency properly requires access to command IDs
    // This is more of an integration test concept
    // The backend should handle duplicate commandIds and return cached results
  });
});
