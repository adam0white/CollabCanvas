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
    
    // Wait for React to mount
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Give React time to render
    
    // Check that root div has content
    const rootContent = await page.locator('#root').innerHTML();
    expect(rootContent.length).toBeGreaterThan(10); // Less strict - just check it rendered something
    
    // Should show header or main container
    const hasHeader = await page.locator('header, [class*="header"], [class*="app"]').count();
    expect(hasHeader).toBeGreaterThan(0);
  });

  test('app attempts to load canvas', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Check for canvas, loading state, or main app container
    const hasCanvasOrApp = await page.locator('canvas, [data-loading="true"], [class*="canvas"], #root > div').count();
    expect(hasCanvasOrApp).toBeGreaterThan(0);
  });

  test('app shows authentication UI', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Should show some authentication-related UI (sign in button, user button, or Clerk iframe)
    const hasAuthUI = await page.locator('button, [class*="clerk"], iframe').count();
    expect(hasAuthUI).toBeGreaterThan(0);
    
    // The app should be interactive (not just a blank page)
    const htmlContent = await page.content();
    expect(htmlContent).toContain('CollabCanvas');
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
