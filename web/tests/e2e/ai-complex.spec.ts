/**
 * AI Complex Commands E2E Tests
 * 
 * Tests:
 * - Multi-shape creation (login forms, navigation bars)
 * - Spatial context understanding
 * - Complex layouts (grids, forms)
 * - Batch operations
 */

import { test, expect, sendAICommand, waitForShapeCount, deleteAllShapes } from '../fixtures';

test.describe('AI Complex Multi-Shape Commands', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
  });

  test.afterEach(async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
  });

  test('AI should create login form (3+ shapes)', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a login form with username field, password field, and submit button');
    
    // Should create at least 3 shapes
    await waitForShapeCount(authenticatedPage, 3, 10000);
    
    const shapes = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      return Array.from(shapesMap.values());
    });
    
    expect(shapes.length).toBeGreaterThanOrEqual(3);
    
    // Shapes should be vertically arranged (y coordinates increasing)
    const sortedByY = [...shapes].sort((a, b) => a.y - b.y);
    expect(sortedByY[1].y).toBeGreaterThan(sortedByY[0].y);
    expect(sortedByY[2].y).toBeGreaterThan(sortedByY[1].y);
  });

  test('AI should create navigation bar with multiple items', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a navigation bar with 4 menu items: Home, About, Services, Contact');
    
    // Should create 4 items
    await waitForShapeCount(authenticatedPage, 4, 10000);
    
    const shapes = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      return Array.from(shapesMap.values());
    });
    
    expect(shapes.length).toBe(4);
    
    // Should be horizontally arranged (x coordinates increasing, y similar)
    const sortedByX = [...shapes].sort((a, b) => a.x - b.x);
    expect(sortedByX[1].x).toBeGreaterThan(sortedByX[0].x);
    expect(sortedByX[2].x).toBeGreaterThan(sortedByX[1].x);
    expect(sortedByX[3].x).toBeGreaterThan(sortedByX[2].x);
    
    // Y coordinates should be similar (horizontal alignment)
    const yValues = shapes.map(s => s.y);
    const avgY = yValues.reduce((a, b) => a + b, 0) / yValues.length;
    yValues.forEach(y => {
      expect(Math.abs(y - avgY)).toBeLessThan(50); // Within 50px tolerance
    });
  });

  test('AI should create 3x3 grid of shapes', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a 3x3 grid of blue circles');
    
    // Should create 9 circles
    await waitForShapeCount(authenticatedPage, 9, 10000);
    
    const shapes = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      return Array.from(shapesMap.values());
    });
    
    expect(shapes.length).toBe(9);
    
    // All should be circles
    shapes.forEach(shape => {
      expect(shape.type).toBe('circle');
    });
    
    // Should be arranged in grid pattern
    // Get unique X and Y coordinates
    const xCoords = [...new Set(shapes.map(s => s.x))].sort((a, b) => a - b);
    const yCoords = [...new Set(shapes.map(s => s.y))].sort((a, b) => a - b);
    
    expect(xCoords.length).toBe(3); // 3 columns
    expect(yCoords.length).toBe(3); // 3 rows
  });

  test('AI should create dashboard layout with multiple sections', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a dashboard with a header, sidebar, and 3 content cards');
    
    // Should create at least 5 shapes (header + sidebar + 3 cards)
    await waitForShapeCount(authenticatedPage, 5, 10000);
    
    const shapes = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      return Array.from(shapesMap.values());
    });
    
    expect(shapes.length).toBeGreaterThanOrEqual(5);
  });

  test('AI should create multiple shapes with consistent styling', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create 5 red rectangles in a horizontal row');
    
    await waitForShapeCount(authenticatedPage, 5, 10000);
    
    const shapes = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      return Array.from(shapesMap.values());
    });
    
    // All should be rectangles
    shapes.forEach(shape => {
      expect(shape.type).toBe('rectangle');
      expect(shape.fill).toBe('#FF0000'); // Red
    });
    
    // Should be horizontally arranged
    const sortedByX = [...shapes].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sortedByX.length; i++) {
      expect(sortedByX[i].x).toBeGreaterThan(sortedByX[i - 1].x);
    }
  });
});

test.describe('AI Spatial Context Understanding', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
  });

  test.afterEach(async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
  });

  test('AI should create shape relative to existing shape (below)', async ({ authenticatedPage }) => {
    // Create base shape
    await sendAICommand(authenticatedPage, 'Create a red rectangle at 200, 100 with width 100 and height 80');
    await waitForShapeCount(authenticatedPage, 1);
    
    const firstShape = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      return shapesMap.get(shapeId);
    });
    
    // Create shape below it
    await sendAICommand(authenticatedPage, 'Create a blue circle below the red rectangle');
    await waitForShapeCount(authenticatedPage, 2);
    
    const shapes = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      return Array.from(shapesMap.values());
    });
    
    const circle = shapes.find(s => s.type === 'circle');
    expect(circle).toBeDefined();
    
    // Circle should be below rectangle (higher Y coordinate)
    expect(circle!.y).toBeGreaterThan(firstShape.y + firstShape.height);
  });

  test('AI should create shape to the right of existing shape', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a square at 100, 100 with width 80 and height 80');
    await waitForShapeCount(authenticatedPage, 1);
    
    const firstShape = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      return shapesMap.get(shapeId);
    });
    
    await sendAICommand(authenticatedPage, 'Create a circle to the right of the square');
    await waitForShapeCount(authenticatedPage, 2);
    
    const shapes = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      return Array.from(shapesMap.values());
    });
    
    const circle = shapes.find(s => s.type === 'circle');
    expect(circle).toBeDefined();
    
    // Circle should be to the right (higher X coordinate)
    expect(circle!.x).toBeGreaterThan(firstShape.x + firstShape.width);
  });

  test('AI should understand "center" context', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a large red circle in the center of the canvas');
    await waitForShapeCount(authenticatedPage, 1);
    
    const shape = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      return shapesMap.get(shapeId);
    });
    
    // Should be roughly centered (canvas is typically 2000x2000)
    // Allow some tolerance
    expect(shape.x).toBeGreaterThan(800);
    expect(shape.x).toBeLessThan(1200);
    expect(shape.y).toBeGreaterThan(800);
    expect(shape.y).toBeLessThan(1200);
  });
});

test.describe('AI Batch Operations', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
  });

  test.afterEach(async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
  });

  test('AI should handle atomic batch creation', async ({ authenticatedPage }) => {
    // All shapes should be created in single transaction
    await sendAICommand(authenticatedPage, 'Create 5 rectangles in a row');
    
    // All 5 should appear atomically
    await waitForShapeCount(authenticatedPage, 5, 10000);
    
    const shapes = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      return Array.from(shapesMap.values());
    });
    
    // All should have been created by AI
    shapes.forEach(shape => {
      expect(shape.aiGenerated).toBe(true);
      expect(shape.createdBy).toBe('ai-assistant');
    });
  });

  test('AI should maintain relative positions in batch operations', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a form with label "Name:" and an input field next to it');
    
    await waitForShapeCount(authenticatedPage, 2, 10000);
    
    const shapes = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      return Array.from(shapesMap.values());
    });
    
    // Should have 2 shapes positioned relative to each other
    expect(shapes.length).toBe(2);
    
    // They should be close to each other (horizontally aligned)
    const yDiff = Math.abs(shapes[0].y - shapes[1].y);
    expect(yDiff).toBeLessThan(50); // Should be roughly on same line
  });
});

test.describe('AI Complex Command Performance', () => {
  test('complex AI command completes within reasonable time', async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
    
    const startTime = Date.now();
    
    await sendAICommand(authenticatedPage, 'Create a dashboard with header, sidebar, and 6 content cards arranged in a 2x3 grid');
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Complex commands should complete within 15 seconds
    expect(duration).toBeLessThan(15000);
  });
});
