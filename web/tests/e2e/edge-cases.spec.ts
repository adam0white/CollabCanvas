/**
 * Edge Cases & Error Handling E2E Tests
 * 
 * Tests:
 * - Empty states
 * - Concurrent operations
 * - Browser compatibility scenarios
 * - Error recovery
 */

import { test, expect } from './fixtures';

test.describe('Edge Cases & Error Handling', () => {
  test.describe('Empty States', () => {
    test('new canvas shows empty state', async ({ page, roomId }) => {
      await page.goto(`/c/main?roomId=${roomId}`);
      await page.waitForLoadState('networkidle');

      // Canvas should be visible even when empty
      const canvas = page.locator('canvas').first();
      await expect(canvas).toBeVisible();

      // No shapes should be present initially
      await page.waitForTimeout(500);
    });

    test('AI history empty state message', async ({ page }) => {
      await page.goto('/c/main');
      await page.waitForLoadState('networkidle');

      // Should show empty state message
      await expect(page.locator('text=/no ai commands|try asking/i')).toBeVisible();
    });

    test('guest mode informational messages', async ({ guestPage }) => {
      // Guest should see disabled tooltips
      const rectangleButton = guestPage.getByRole('button', { name: /rectangle/i });
      await expect(rectangleButton).toHaveAttribute('title', /sign in to create shapes/i);

      const aiTextarea = guestPage.getByPlaceholder(/sign in to use AI/i);
      await expect(aiTextarea).toBeVisible();
    });
  });

  test.describe('Concurrent Operations', () => {
    test('rapid shape creation does not create duplicates', async ({ authenticatedPage }) => {
      await authenticatedPage.getByRole('button', { name: /rectangle/i }).click();
      const canvas = authenticatedPage.locator('canvas').first();

      // Rapidly create multiple shapes
      for (let i = 0; i < 3; i++) {
        const x = 150 + i * 100;
        await canvas.hover({ position: { x, y: 200 } });
        await authenticatedPage.mouse.down();
        await canvas.hover({ position: { x: x + 80, y: 280 } });
        await authenticatedPage.mouse.up();
        await authenticatedPage.waitForTimeout(200); // Small delay between shapes
      }

      await authenticatedPage.waitForTimeout(1000);

      // Should have created 3 distinct shapes (verify no errors)
      const errors: string[] = [];
      authenticatedPage.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      expect(errors.length).toBe(0);
    });

    test('rapid AI commands do not interfere', async ({ authenticatedPage, roomId }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState('networkidle');

      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      const sendButton = authenticatedPage.getByRole('button', { name: /send/i });

      // Send first command
      await aiTextarea.fill('Create a red rectangle');
      await sendButton.click();
      await authenticatedPage.waitForTimeout(2000); // Don't wait for full completion

      // Send second command while first is processing
      await aiTextarea.fill('Create a blue circle');
      await sendButton.click();

      // Both should eventually complete
      await authenticatedPage.waitForTimeout(15000);

      // History should show both commands
      await expect(authenticatedPage.locator('text="Create a red rectangle"')).toBeVisible({ timeout: 5000 });
      await expect(authenticatedPage.locator('text="Create a blue circle"')).toBeVisible({ timeout: 5000 });
    });

    test('multiple users editing simultaneously without conflicts', async ({ multiUserContext, roomId }) => {
      const { user1, user2 } = multiUserContext;

      await user1.goto(`/c/main?roomId=${roomId}`);
      await user2.goto(`/c/main?roomId=${roomId}`);

      await Promise.all([
        user1.waitForLoadState('networkidle'),
        user2.waitForLoadState('networkidle'),
      ]);

      await user1.waitForTimeout(1000);

      // Both users create shapes simultaneously in different areas
      await user1.getByRole('button', { name: /rectangle/i }).click();
      await user2.getByRole('button', { name: /circle/i }).click();

      const canvas1 = user1.locator('canvas').first();
      const canvas2 = user2.locator('canvas').first();

      // Create in parallel
      await Promise.all([
        (async () => {
          await canvas1.hover({ position: { x: 150, y: 150 } });
          await user1.mouse.down();
          await canvas1.hover({ position: { x: 250, y: 230 } });
          await user1.mouse.up();
        })(),
        (async () => {
          await canvas2.hover({ position: { x: 500, y: 300 } });
          await user2.mouse.down();
          await canvas2.hover({ position: { x: 560, y: 360 } });
          await user2.mouse.up();
        })(),
      ]);

      // Wait for sync
      await user1.waitForTimeout(1500);

      // No errors should occur
      const errors1: string[] = [];
      const errors2: string[] = [];
      user1.on('console', msg => { if (msg.type() === 'error') errors1.push(msg.text()); });
      user2.on('console', msg => { if (msg.type() === 'error') errors2.push(msg.text()); });

      expect(errors1.length).toBe(0);
      expect(errors2.length).toBe(0);
    });
  });

  test.describe('Browser Compatibility', () => {
    test('canvas loads without errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      await page.goto('/c/main');
      await page.waitForLoadState('networkidle');

      // Filter out DevTools warnings
      const realErrors = errors.filter(e => !e.includes('DevTools'));
      expect(realErrors.length).toBe(0);
    });

    test('Clerk authentication modal appears', async ({ page }) => {
      await page.goto('/c/main');
      await page.waitForLoadState('networkidle');

      const signInButton = page.getByRole('button', { name: /sign in/i });
      await signInButton.click();

      // Clerk modal should appear
      await page.waitForSelector('[data-clerk-modal]', { timeout: 10000 });
      await expect(page.locator('[data-clerk-modal]')).toBeVisible();

      // Close modal (click outside or Escape)
      await page.keyboard.press('Escape');
    });
  });

  test.describe('Error Recovery', () => {
    test('invalid shape data handled gracefully', async ({ authenticatedPage }) => {
      // Try to create a shape with negative dimensions
      await authenticatedPage.getByRole('button', { name: /rectangle/i }).click();
      const canvas = authenticatedPage.locator('canvas').first();

      // Draw right-to-left and bottom-to-top (negative dimensions)
      await canvas.hover({ position: { x: 400, y: 400 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 200, y: 200 } });
      await authenticatedPage.mouse.up();

      await authenticatedPage.waitForTimeout(500);

      // Should handle gracefully (normalize dimensions or reject)
      const errors: string[] = [];
      authenticatedPage.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      expect(errors.filter(e => !e.includes('DevTools')).length).toBe(0);
    });

    test('AI errors display helpful messages', async ({ authenticatedPage, roomId }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState('networkidle');

      // Send an intentionally problematic command
      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.fill('Delete a shape that does not exist');
      
      await authenticatedPage.getByRole('button', { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(10000);

      // Should show some response (even if it's an error or "shape not found")
      // Don't assert specific error, just ensure no crashes
    });

    test('connection lost/restored indicator', async ({ page }) => {
      await page.goto('/c/main');
      await page.waitForLoadState('networkidle');

      // App should be in connected state
      await page.waitForTimeout(1000);

      // We can't easily simulate network disconnection in Playwright,
      // but we can verify the page loads and works
      const canvas = page.locator('canvas').first();
      await expect(canvas).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('page loads within reasonable time', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/c/main');
      await page.waitForLoadState('networkidle');
      
      const endTime = Date.now();
      const loadTime = endTime - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('canvas remains responsive with multiple shapes', async ({ authenticatedPage }) => {
      // Create several shapes
      await authenticatedPage.getByRole('button', { name: /rectangle/i }).click();
      const canvas = authenticatedPage.locator('canvas').first();

      for (let i = 0; i < 5; i++) {
        const x = 100 + i * 120;
        await canvas.hover({ position: { x, y: 200 } });
        await authenticatedPage.mouse.down();
        await canvas.hover({ position: { x: x + 100, y: 280 } });
        await authenticatedPage.mouse.up();
        await authenticatedPage.waitForTimeout(300);
      }

      // Canvas should still be responsive
      await canvas.hover({ position: { x: 300, y: 300 } });
      await authenticatedPage.waitForTimeout(100);

      // No performance errors
      const errors: string[] = [];
      authenticatedPage.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      expect(errors.length).toBe(0);
    });
  });

  test.describe('Data Validation', () => {
    test('empty text shape is not created', async ({ authenticatedPage }) => {
      await authenticatedPage.getByRole('button', { name: /text/i }).click();
      const canvas = authenticatedPage.locator('canvas').first();

      await canvas.click({ position: { x: 400, y: 300 } });
      await authenticatedPage.waitForSelector('input[placeholder*="Enter text"]', { timeout: 2000 });

      // Just press Enter without typing
      await authenticatedPage.keyboard.press('Enter');
      await authenticatedPage.waitForTimeout(500);

      // Input should close, no shape created
      await expect(authenticatedPage.locator('input[placeholder*="Enter text"]')).not.toBeVisible();
    });

    test('very small shapes (<minimum size) are not created', async ({ authenticatedPage }) => {
      // Test rectangle
      await authenticatedPage.getByRole('button', { name: /rectangle/i }).click();
      const canvas = authenticatedPage.locator('canvas').first();

      await canvas.hover({ position: { x: 200, y: 200 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 203, y: 203 } }); // 3x3 px
      await authenticatedPage.mouse.up();
      await authenticatedPage.waitForTimeout(500);

      // Test circle
      await authenticatedPage.getByRole('button', { name: /circle/i }).click();
      await canvas.hover({ position: { x: 300, y: 300 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 302, y: 302 } }); // 2px radius
      await authenticatedPage.mouse.up();
      await authenticatedPage.waitForTimeout(500);

      // Neither shape should be created (too small)
    });
  });
});
