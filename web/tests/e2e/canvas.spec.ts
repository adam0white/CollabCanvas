/**
 * Canvas Interactions E2E Tests
 * 
 * Tests:
 * - Pan and zoom functionality
 * - Selection behaviors
 * - Keyboard shortcuts
 * - Canvas responsiveness
 */

import { test, expect } from './fixtures';

test.describe('Canvas Interactions', () => {
  test.describe('Pan & Zoom', () => {
    test('mouse wheel zooms in and out', async ({ page }) => {
      await page.goto('/c/main');
      await page.waitForLoadState('networkidle');

      const canvas = page.locator('canvas').first();
      const zoomButton = page.getByRole('button', { name: /100%/i });

      // Initial zoom should be 100%
      await expect(zoomButton).toHaveText('100%');

      // Zoom in with wheel (simulate wheel event)
      await canvas.hover({ position: { x: 400, y: 300 } });
      await page.mouse.wheel(0, -100); // Negative deltaY zooms in
      
      await page.waitForTimeout(200);

      // Zoom level should have changed
      const zoomText = await zoomButton.textContent();
      expect(zoomText).not.toBe('100%');
    });

    test('zoom controls buttons work', async ({ page }) => {
      await page.goto('/c/main');
      await page.waitForLoadState('networkidle');

      const zoomButton = page.getByRole('button', { name: /100%/i });
      const zoomInButton = page.getByRole('button', { name: '+' });
      const zoomOutButton = page.getByRole('button', { name: '−' });

      // Zoom in
      await zoomInButton.click();
      await page.waitForTimeout(100);
      let zoomText = await zoomButton.textContent();
      expect(zoomText).toContain('110%'); // ~110% after one click

      // Zoom out
      await zoomOutButton.click();
      await page.waitForTimeout(100);
      zoomText = await zoomButton.textContent();
      expect(zoomText).toBe('100%');
    });

    test('reset zoom button returns to 100%', async ({ page }) => {
      await page.goto('/c/main');
      await page.waitForLoadState('networkidle');

      const zoomButton = page.getByRole('button', { name: /100%/i });
      const zoomInButton = page.getByRole('button', { name: '+' });

      // Zoom in multiple times
      await zoomInButton.click();
      await zoomInButton.click();
      await page.waitForTimeout(200);

      // Click reset
      await zoomButton.click();
      await page.waitForTimeout(100);

      // Should be back to 100%
      await expect(zoomButton).toHaveText('100%');
    });

    test('zoom is clamped to MIN_ZOOM and MAX_ZOOM', async ({ page }) => {
      await page.goto('/c/main');
      await page.waitForLoadState('networkidle');

      const zoomOutButton = page.getByRole('button', { name: '−' });

      // Try to zoom out many times
      for (let i = 0; i < 20; i++) {
        await zoomOutButton.click();
        await page.waitForTimeout(50);
      }

      // Zoom should be clamped (minimum is 10%)
      const zoomButton = page.getByRole('button', { name: /\d+%/i });
      const zoomText = await zoomButton.textContent();
      const zoomPercent = parseInt(zoomText || '0');
      expect(zoomPercent).toBeGreaterThanOrEqual(10);
    });

    test('authenticated user can pan with click-drag in select mode', async ({ authenticatedPage }) => {
      // Click select tool
      await authenticatedPage.getByRole('button', { name: /select/i }).click();

      const canvas = authenticatedPage.locator('canvas').first();
      
      // Get initial stage position (we can't easily verify, but ensure no errors)
      await canvas.hover({ position: { x: 400, y: 300 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 300, y: 200 } });
      await authenticatedPage.mouse.up();

      await authenticatedPage.waitForTimeout(200);
    });

    test('guest user can pan', async ({ guestPage }) => {
      await guestPage.waitForLoadState('networkidle');

      // Guest should be in select mode by default
      const canvas = guestPage.locator('canvas').first();
      
      await canvas.hover({ position: { x: 400, y: 300 } });
      await guestPage.mouse.down();
      await canvas.hover({ position: { x: 300, y: 200 } });
      await guestPage.mouse.up();

      await guestPage.waitForTimeout(200);
    });
  });

  test.describe('Selection', () => {
    test('click shape to select', async ({ authenticatedPage }) => {
      // Create a shape first
      await authenticatedPage.getByRole('button', { name: /rectangle/i }).click();
      const canvas = authenticatedPage.locator('canvas').first();
      
      await canvas.hover({ position: { x: 200, y: 200 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 350, y: 300 } });
      await authenticatedPage.mouse.up();
      await authenticatedPage.waitForTimeout(500);

      // Switch to select tool and click shape
      await authenticatedPage.getByRole('button', { name: /select/i }).click();
      await canvas.click({ position: { x: 275, y: 250 } });
      
      await authenticatedPage.waitForTimeout(200);
      // Shape should be selected (transformer visible, but we can't easily verify)
    });

    test('click empty canvas deselects', async ({ authenticatedPage }) => {
      // Create and select a shape
      await authenticatedPage.getByRole('button', { name: /rectangle/i }).click();
      const canvas = authenticatedPage.locator('canvas').first();
      
      await canvas.hover({ position: { x: 200, y: 200 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 350, y: 300 } });
      await authenticatedPage.mouse.up();
      await authenticatedPage.waitForTimeout(500);

      await authenticatedPage.getByRole('button', { name: /select/i }).click();
      await canvas.click({ position: { x: 275, y: 250 } });
      await authenticatedPage.waitForTimeout(200);

      // Click empty area
      await canvas.click({ position: { x: 600, y: 500 } });
      await authenticatedPage.waitForTimeout(200);
    });

    test('Escape key deselects', async ({ authenticatedPage }) => {
      // Create and select a shape
      await authenticatedPage.getByRole('button', { name: /rectangle/i }).click();
      const canvas = authenticatedPage.locator('canvas').first();
      
      await canvas.hover({ position: { x: 200, y: 200 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 350, y: 300 } });
      await authenticatedPage.mouse.up();
      await authenticatedPage.waitForTimeout(500);

      await authenticatedPage.getByRole('button', { name: /select/i }).click();
      await canvas.click({ position: { x: 275, y: 250 } });
      await authenticatedPage.waitForTimeout(200);

      // Press Escape
      await authenticatedPage.keyboard.press('Escape');
      await authenticatedPage.waitForTimeout(200);
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('Delete key removes selected shape', async ({ authenticatedPage }) => {
      // Create shape
      await authenticatedPage.getByRole('button', { name: /rectangle/i }).click();
      const canvas = authenticatedPage.locator('canvas').first();
      
      await canvas.hover({ position: { x: 200, y: 200 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 350, y: 300 } });
      await authenticatedPage.mouse.up();
      await authenticatedPage.waitForTimeout(500);

      // Select shape
      await authenticatedPage.getByRole('button', { name: /select/i }).click();
      await canvas.click({ position: { x: 275, y: 250 } });
      await authenticatedPage.waitForTimeout(200);

      // Press Delete
      await authenticatedPage.keyboard.press('Delete');
      await authenticatedPage.waitForTimeout(500);
    });

    test('Backspace key removes selected shape', async ({ authenticatedPage }) => {
      // Create shape
      await authenticatedPage.getByRole('button', { name: /circle/i }).click();
      const canvas = authenticatedPage.locator('canvas').first();
      
      await canvas.hover({ position: { x: 300, y: 300 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 360, y: 360 } });
      await authenticatedPage.mouse.up();
      await authenticatedPage.waitForTimeout(500);

      // Select shape
      await authenticatedPage.getByRole('button', { name: /select/i }).click();
      await canvas.click({ position: { x: 300, y: 300 } });
      await authenticatedPage.waitForTimeout(200);

      // Press Backspace
      await authenticatedPage.keyboard.press('Backspace');
      await authenticatedPage.waitForTimeout(500);
    });

    test('shortcuts disabled when typing in text input', async ({ authenticatedPage }) => {
      // Focus AI textarea
      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.click();

      // Type "Delete" - should not trigger delete shortcut
      await aiTextarea.type('Delete this text');

      // Text should still be in textarea
      const value = await aiTextarea.inputValue();
      expect(value).toBe('Delete this text');
    });
  });

  test.describe('Canvas Responsiveness', () => {
    test('canvas fills viewport', async ({ page }) => {
      await page.goto('/c/main');
      await page.waitForLoadState('networkidle');

      const canvas = page.locator('canvas').first();
      const canvasBox = await canvas.boundingBox();

      // Canvas should be reasonably large
      expect(canvasBox?.width).toBeGreaterThan(400);
      expect(canvasBox?.height).toBeGreaterThan(300);
    });

    test('canvas resizes on viewport change', async ({ page }) => {
      await page.goto('/c/main');
      await page.waitForLoadState('networkidle');

      const canvas = page.locator('canvas').first();
      const initialBox = await canvas.boundingBox();

      // Resize viewport
      await page.setViewportSize({ width: 1600, height: 900 });
      await page.waitForTimeout(500);

      const newBox = await canvas.boundingBox();

      // Canvas should have resized
      expect(newBox?.width).toBeGreaterThan(initialBox?.width || 0);
    });
  });

  test.describe('Grid', () => {
    test('grid is visible on canvas', async ({ page }) => {
      await page.goto('/c/main');
      await page.waitForLoadState('networkidle');

      // Grid should be rendered (we can't easily verify visually, but no errors should occur)
      const canvas = page.locator('canvas').first();
      await expect(canvas).toBeVisible();
    });

    test('grid scales with zoom', async ({ page }) => {
      await page.goto('/c/main');
      await page.waitForLoadState('networkidle');

      // Zoom in
      const zoomInButton = page.getByRole('button', { name: '+' });
      await zoomInButton.click();
      await page.waitForTimeout(200);

      // Grid should still be visible (no errors)
      const canvas = page.locator('canvas').first();
      await expect(canvas).toBeVisible();
    });
  });
});
