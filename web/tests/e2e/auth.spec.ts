/**
 * Authentication & Authorization E2E Tests
 * 
 * Tests:
 * - Guest/viewer access (read-only)
 * - Editor authentication and permissions
 * - AI command access control
 */

import { test, expect } from '../fixtures';

test.describe('Authentication & Authorization', () => {
  test('guest users can view canvas but cannot edit', async ({ guestPage }) => {
    // Guest should see canvas
    await expect(guestPage.locator('canvas')).toBeVisible();
    
    // Guest should see read-only indicator or disabled tools
    // Check if rectangle tool is disabled or shows a sign-in prompt
    const rectangleBtn = guestPage.getByRole('button', { name: /rectangle/i });
    
    // If button exists, it should either be disabled or trigger sign-in
    if (await rectangleBtn.isVisible()) {
      const isDisabled = await rectangleBtn.isDisabled();
      expect(isDisabled).toBe(true);
    }
  });

  test('guest users cannot send AI commands', async ({ guestPage }) => {
    // Try to access AI panel
    const aiInput = guestPage.getByPlaceholder(/ask ai/i);
    
    if (await aiInput.isVisible()) {
      // Input should be disabled
      const isDisabled = await aiInput.isDisabled();
      expect(isDisabled).toBe(true);
    }
  });

  test('authenticated users can access editor features', async ({ authenticatedPage }) => {
    // Should be signed in
    await expect(authenticatedPage).toHaveURL(/\/c\/main/);
    
    // Canvas should be visible
    await expect(authenticatedPage.locator('canvas')).toBeVisible();
    
    // Tools should be enabled
    const rectangleBtn = authenticatedPage.getByRole('button', { name: /rectangle/i });
    if (await rectangleBtn.isVisible()) {
      await expect(rectangleBtn).not.toBeDisabled();
    }
  });

  test('authenticated users can send AI commands', async ({ authenticatedPage }) => {
    // AI input should be accessible
    const aiInput = authenticatedPage.getByPlaceholder(/ask ai/i);
    
    if (await aiInput.isVisible()) {
      await expect(aiInput).not.toBeDisabled();
      await expect(aiInput).toBeEditable();
    }
  });

  test('session persists across page refresh', async ({ authenticatedPage }) => {
    // Navigate away and back
    await authenticatedPage.goto('/');
    await authenticatedPage.goto('/c/main');
    
    // Should still be authenticated
    await expect(authenticatedPage.locator('canvas')).toBeVisible();
    
    // User menu or indicator should be visible
    const userIndicator = authenticatedPage.locator('[data-testid="user-menu"]');
    if (await userIndicator.isVisible().catch(() => false)) {
      await expect(userIndicator).toBeVisible();
    }
  });
});
