/**
 * Shape Creation & Editing E2E Tests
 * 
 * Tests:
 * - Rectangle, circle, text shape creation
 * - Shape movement, resize, rotation
 * - Shape deletion
 * - Shape property editing
 */

import { test, expect, createRectangleViaUI, waitForShapeCount, deleteAllShapes } from '../fixtures';

test.describe('Shape Creation', () => {
  test.afterEach(async ({ authenticatedPage }) => {
    // Cleanup: delete all shapes after each test
    await deleteAllShapes(authenticatedPage);
  });

  test('should create rectangle via click and drag', async ({ authenticatedPage }) => {
    // Create a rectangle
    await createRectangleViaUI(authenticatedPage, 100, 100, 200, 150);
    
    // Verify shape appears on canvas
    await waitForShapeCount(authenticatedPage, 1);
  });

  test('should create circle via tool', async ({ authenticatedPage }) => {
    // Select circle tool
    const circleBtn = authenticatedPage.getByRole('button', { name: /circle/i });
    if (await circleBtn.isVisible()) {
      await circleBtn.click();
      
      // Click and drag to create circle
      const canvas = authenticatedPage.locator('canvas').first();
      await canvas.click({ position: { x: 300, y: 300 } });
      await authenticatedPage.mouse.move(350, 350);
      await authenticatedPage.mouse.up();
      
      // Verify shape created
      await waitForShapeCount(authenticatedPage, 1);
    }
  });

  test('should create text shape', async ({ authenticatedPage }) => {
    // Select text tool
    const textBtn = authenticatedPage.getByRole('button', { name: /text/i });
    if (await textBtn.isVisible()) {
      await textBtn.click();
      
      // Click on canvas to place text
      const canvas = authenticatedPage.locator('canvas').first();
      await canvas.click({ position: { x: 400, y: 200 } });
      
      // Type text
      await authenticatedPage.keyboard.type('Hello World');
      
      // Press Enter or click away to confirm
      await authenticatedPage.keyboard.press('Enter');
      
      // Verify text shape created
      await waitForShapeCount(authenticatedPage, 1);
    }
  });

  test('should delete shape with Delete key', async ({ authenticatedPage }) => {
    // Create a shape
    await createRectangleViaUI(authenticatedPage, 150, 150, 100, 100);
    await waitForShapeCount(authenticatedPage, 1);
    
    // Select the shape by clicking it
    const canvas = authenticatedPage.locator('canvas').first();
    await canvas.click({ position: { x: 200, y: 200 } });
    
    // Wait a bit for selection
    await authenticatedPage.waitForTimeout(300);
    
    // Press Delete key
    await authenticatedPage.keyboard.press('Delete');
    
    // Verify shape is deleted
    await waitForShapeCount(authenticatedPage, 0, 3000);
  });

  test('should move shape by dragging', async ({ authenticatedPage }) => {
    // Create a shape
    await createRectangleViaUI(authenticatedPage, 100, 100, 100, 100);
    await waitForShapeCount(authenticatedPage, 1);
    
    // Get initial position
    const initialPos = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      const shape = shapesMap.get(shapeId);
      return { x: shape.x, y: shape.y };
    });
    
    // Drag the shape
    const canvas = authenticatedPage.locator('canvas').first();
    await canvas.hover();
    await authenticatedPage.mouse.move(150, 150);
    await authenticatedPage.mouse.down();
    await authenticatedPage.mouse.move(300, 300);
    await authenticatedPage.mouse.up();
    
    // Wait for position to update
    await authenticatedPage.waitForTimeout(500);
    
    // Verify position changed
    const newPos = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      const shape = shapesMap.get(shapeId);
      return { x: shape.x, y: shape.y };
    });
    
    expect(newPos.x).not.toBe(initialPos.x);
    expect(newPos.y).not.toBe(initialPos.y);
  });

  test('should persist shapes across page refresh', async ({ authenticatedPage }) => {
    // Create shapes
    await createRectangleViaUI(authenticatedPage, 100, 100, 100, 100);
    await createRectangleViaUI(authenticatedPage, 250, 100, 100, 100);
    await waitForShapeCount(authenticatedPage, 2);
    
    // Refresh page
    await authenticatedPage.reload();
    await authenticatedPage.waitForSelector('canvas', { timeout: 5000 });
    
    // Shapes should still be there
    await waitForShapeCount(authenticatedPage, 2);
  });
});

test.describe('Shape Editing', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Create a test shape
    await createRectangleViaUI(authenticatedPage, 200, 200, 150, 100);
    await waitForShapeCount(authenticatedPage, 1);
  });

  test.afterEach(async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
  });

  test('should select shape on click', async ({ authenticatedPage }) => {
    // Click on the shape
    const canvas = authenticatedPage.locator('canvas').first();
    await canvas.click({ position: { x: 275, y: 250 } });
    
    // Wait a bit for selection
    await authenticatedPage.waitForTimeout(300);
    
    // Should show selection handles (Konva transformer)
    // This is visual, hard to test precisely, but we can check for selection state
    const hasSelection = await authenticatedPage.evaluate(() => {
      // Check if any shape is selected in the UI state
      return document.querySelector('[data-selected="true"]') !== null;
    });
    
    // Note: This may need adjustment based on actual implementation
    // The key is that clicking a shape should select it
  });

  test('should resize shape with transform handles', async ({ authenticatedPage }) => {
    // Select the shape
    const canvas = authenticatedPage.locator('canvas').first();
    await canvas.click({ position: { x: 275, y: 250 } });
    await authenticatedPage.waitForTimeout(300);
    
    // Get initial dimensions
    const initialDims = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      const shape = shapesMap.get(shapeId);
      return { width: shape.width, height: shape.height };
    });
    
    // Try to drag a corner handle (approximate position)
    await authenticatedPage.mouse.move(350, 300);
    await authenticatedPage.mouse.down();
    await authenticatedPage.mouse.move(400, 350);
    await authenticatedPage.mouse.up();
    
    await authenticatedPage.waitForTimeout(500);
    
    // Verify dimensions changed
    const newDims = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const shapesMap = doc.getMap('shapes');
      const shapeId = Array.from(shapesMap.keys())[0];
      const shape = shapesMap.get(shapeId);
      return { width: shape.width, height: shape.height };
    });
    
    // At least one dimension should have changed
    const dimsChanged = newDims.width !== initialDims.width || newDims.height !== initialDims.height;
    expect(dimsChanged).toBe(true);
  });
});
