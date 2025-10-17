/**
 * Playwright Test Fixtures for CollabCanvas
 * 
 * Provides reusable test utilities:
 * - Authenticated user contexts
 * - Multi-user collaboration contexts
 * - Helper functions for shape creation/verification
 */

import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';

// Test user credentials from environment
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || '';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || '';

/**
 * Extended test fixtures
 */
type TestFixtures = {
  authenticatedPage: Page;
  guestPage: Page;
  multiUserContexts: {
    user1: { page: Page; context: BrowserContext };
    user2: { page: Page; context: BrowserContext };
  };
};

export const test = base.extend<TestFixtures>({
  /**
   * Fixture: Authenticated editor page
   * Logs in with TEST_USER_EMAIL and provides authenticated session
   */
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to the app
    await page.goto('/c/main');
    
    // Check if already signed in (Clerk may have stored session)
    const isSignedIn = await page.locator('[data-testid="user-menu"]').isVisible({ timeout: 2000 }).catch(() => false);
    
    if (!isSignedIn && TEST_USER_EMAIL && TEST_USER_PASSWORD) {
      // Click sign in button
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Wait for Clerk modal and fill in credentials
      await page.waitForSelector('.cl-modalContent', { timeout: 10000 });
      await page.fill('input[name="identifier"]', TEST_USER_EMAIL);
      await page.click('button:has-text("Continue")');
      
      await page.fill('input[name="password"]', TEST_USER_PASSWORD);
      await page.click('button:has-text("Continue")');
      
      // Wait for redirect back to canvas
      await page.waitForURL('**/c/main', { timeout: 10000 });
    }
    
    // Wait for canvas to be ready
    await page.waitForSelector('canvas', { timeout: 5000 });
    
    await use(page);
    
    await context.close();
  },

  /**
   * Fixture: Guest/viewer page (no authentication)
   */
  guestPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto('/c/main');
    
    // Wait for canvas to load (guests can view)
    await page.waitForSelector('canvas', { timeout: 5000 });
    
    await use(page);
    
    await context.close();
  },

  /**
   * Fixture: Two authenticated user contexts for collaboration testing
   */
  multiUserContexts: async ({ browser }, use) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Both navigate to the same room
    await page1.goto('/c/main');
    await page2.goto('/c/main');
    
    // Wait for both canvases to be ready
    await Promise.all([
      page1.waitForSelector('canvas', { timeout: 5000 }),
      page2.waitForSelector('canvas', { timeout: 5000 }),
    ]);
    
    await use({
      user1: { page: page1, context: context1 },
      user2: { page: page2, context: context2 },
    });
    
    await context1.close();
    await context2.close();
  },
});

/**
 * Helper: Wait for shape count on canvas
 */
export async function waitForShapeCount(page: Page, expectedCount: number, timeout = 5000) {
  await expect(async () => {
    const shapeCount = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return 0;
      // Count shapes by checking Konva layer children
      // @ts-ignore - accessing Konva internals
      const stage = canvas._konva;
      if (!stage) return 0;
      const layer = stage.children[0];
      if (!layer) return 0;
      // Filter out non-shape elements (grid, cursors, etc.)
      return layer.children.filter((child: any) => 
        child.name() === 'shape' || child.className === 'Rect' || child.className === 'Circle' || child.className === 'Text'
      ).length;
    });
    expect(shapeCount).toBe(expectedCount);
  }).toPass({ timeout });
}

/**
 * Helper: Get shape IDs from canvas
 */
export async function getShapeIds(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    // Access Yjs document to get shape IDs
    // @ts-ignore - accessing global Yjs doc
    const doc = window.yjsDoc;
    if (!doc) return [];
    const shapesMap = doc.getMap('shapes');
    return Array.from(shapesMap.keys());
  });
}

/**
 * Helper: Create shape via UI (click and drag)
 */
export async function createRectangleViaUI(page: Page, x: number, y: number, width: number, height: number) {
  // Select rectangle tool
  await page.getByRole('button', { name: /rectangle/i }).click();
  
  // Click and drag on canvas
  const canvas = page.locator('canvas').first();
  await canvas.hover();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + width, y + height);
  await page.mouse.up();
  
  // Switch back to select tool
  await page.getByRole('button', { name: /select/i }).click();
}

/**
 * Helper: Send AI command
 */
export async function sendAICommand(page: Page, prompt: string) {
  // Focus AI input
  await page.getByPlaceholder(/ask ai/i).click();
  
  // Type prompt
  await page.getByPlaceholder(/ask ai/i).fill(prompt);
  
  // Submit
  await page.getByRole('button', { name: /send/i }).click();
  
  // Wait for loading to finish
  await page.waitForSelector('[data-testid="ai-loading"]', { state: 'hidden', timeout: 15000 });
}

/**
 * Helper: Wait for AI history entry
 */
export async function waitForAIHistoryEntry(page: Page, prompt: string, timeout = 10000) {
  await expect(page.getByText(prompt)).toBeVisible({ timeout });
}

/**
 * Helper: Delete all shapes (cleanup)
 */
export async function deleteAllShapes(page: Page) {
  await page.evaluate(() => {
    // @ts-ignore
    const doc = window.yjsDoc;
    if (!doc) return;
    const shapesMap = doc.getMap('shapes');
    const keys = Array.from(shapesMap.keys());
    keys.forEach(key => shapesMap.delete(key));
  });
}

export { expect };
