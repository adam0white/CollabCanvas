/**
 * Smoke Tests - Basic app loading and functionality
 * 
 * These tests verify the app loads and basic UI elements are present
 * without requiring full authentication or backend.
 */

import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('app loads and shows main UI elements', async ({ page }) => {
    // Navigate to app
    await page.goto('/');
    
    // Wait for app to fully load
    await page.waitForLoadState('networkidle');
    
    // Check that root div has content (app renders)
    const rootContent = await page.locator('#root').innerHTML();
    expect(rootContent.length).toBeGreaterThan(100);
    
    // Should show header with title
    await expect(page.locator('h1')).toContainText('CollabCanvas');
    
    // Should show toolbar
    await expect(page.locator('nav[aria-label="Canvas tools"]')).toBeVisible();
  });

  test('app renders canvas', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Canvas should be visible (Konva creates canvas elements)
    await expect(page.locator('canvas').first()).toBeVisible();
    
    // Should have at least one canvas (Konva uses multiple layers)
    const canvasCount = await page.locator('canvas').count();
    expect(canvasCount).toBeGreaterThanOrEqual(1);
  });

  test('guest users see disabled tools and sign in button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should show sign in button
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    
    // Shape tools should be disabled for guests
    const rectangleBtn = page.getByRole('button', { name: /rectangle/i });
    await expect(rectangleBtn).toBeDisabled();
    
    // AI textarea should be disabled
    const aiTextarea = page.getByPlaceholder(/sign in to use ai/i);
    await expect(aiTextarea).toBeDisabled();
  });

  test('page title is correct', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CollabCanvas/i);
  });

  test('no console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Filter out expected errors (Clerk auth failures are OK in test env)
    const criticalErrors = errors.filter(err => 
      !err.includes('Clerk') && 
      !err.includes('clerk') &&
      !err.includes('publishableKey')
    );
    
    expect(criticalErrors.length).toBe(0);
  });
});
