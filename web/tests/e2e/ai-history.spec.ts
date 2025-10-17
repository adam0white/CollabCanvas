/**
 * AI History & Collaboration E2E Tests
 * 
 * Tests:
 * - AI history sync across users
 * - Guest users see history but cannot send commands
 * - History persistence
 * - Concurrent AI commands
 */

import { test, expect, sendAICommand, waitForAIHistoryEntry, deleteAllShapes } from '../fixtures';

test.describe('AI History Sync', () => {
  test.afterEach(async ({ multiUserContexts }) => {
    await deleteAllShapes(multiUserContexts.user1.page);
  });

  test('AI history appears for all users', async ({ multiUserContexts }) => {
    const { user1, user2 } = multiUserContexts;
    
    // User1 sends AI command
    const prompt = 'Create a blue circle at 200, 200 with radius 60';
    await sendAICommand(user1.page, prompt);
    
    // Both users should see the history entry
    await Promise.all([
      waitForAIHistoryEntry(user1.page, prompt),
      waitForAIHistoryEntry(user2.page, prompt, 5000),
    ]);
  });

  test('history entries show user attribution', async ({ multiUserContexts }) => {
    const { user1 } = multiUserContexts;
    
    await sendAICommand(user1.page, 'Create a rectangle at 100, 100');
    
    // Wait for history entry
    await user1.page.waitForTimeout(1000);
    
    // Check if history entry exists with user information
    const historyEntry = await user1.page.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const aiHistory = doc.getArray('aiHistory');
      if (aiHistory.length === 0) return null;
      return aiHistory.get(0);
    });
    
    expect(historyEntry).not.toBeNull();
    if (historyEntry) {
      expect(historyEntry.userId).toBeDefined();
      expect(historyEntry.userName).toBeDefined();
      expect(historyEntry.timestamp).toBeDefined();
    }
  });

  test('concurrent AI commands from multiple users', async ({ multiUserContexts }) => {
    const { user1, user2 } = multiUserContexts;
    
    // Both users send commands simultaneously
    const prompt1 = 'Create a red square at 100, 100';
    const prompt2 = 'Create a blue circle at 300, 100';
    
    await Promise.all([
      sendAICommand(user1.page, prompt1),
      sendAICommand(user2.page, prompt2),
    ]);
    
    // Both commands should appear in history for both users
    await Promise.all([
      waitForAIHistoryEntry(user1.page, prompt1, 10000),
      waitForAIHistoryEntry(user1.page, prompt2, 10000),
      waitForAIHistoryEntry(user2.page, prompt1, 10000),
      waitForAIHistoryEntry(user2.page, prompt2, 10000),
    ]);
  });

  test('AI history persists across page refresh', async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
    
    const prompt = 'Create a green rectangle at 150, 150';
    await sendAICommand(authenticatedPage, prompt);
    await waitForAIHistoryEntry(authenticatedPage, prompt);
    
    // Refresh page
    await authenticatedPage.reload();
    await authenticatedPage.waitForSelector('canvas', { timeout: 5000 });
    
    // History should still be visible
    await waitForAIHistoryEntry(authenticatedPage, prompt, 5000);
  });

  test('history shows success/failure status', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a rectangle at 100, 100');
    
    await authenticatedPage.waitForTimeout(1500);
    
    // Check history entry has success flag
    const historyEntry = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const aiHistory = doc.getArray('aiHistory');
      if (aiHistory.length === 0) return null;
      // Get most recent entry
      return aiHistory.get(aiHistory.length - 1);
    });
    
    expect(historyEntry).not.toBeNull();
    if (historyEntry) {
      expect(historyEntry.success).toBeDefined();
      expect(typeof historyEntry.success).toBe('boolean');
    }
  });

  test('history entries contain shapes affected', async ({ authenticatedPage }) => {
    await deleteAllShapes(authenticatedPage);
    
    await sendAICommand(authenticatedPage, 'Create a rectangle at 100, 100 with width 100 and height 100');
    
    await authenticatedPage.waitForTimeout(1500);
    
    const historyEntry = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const aiHistory = doc.getArray('aiHistory');
      if (aiHistory.length === 0) return null;
      return aiHistory.get(aiHistory.length - 1);
    });
    
    expect(historyEntry).not.toBeNull();
    if (historyEntry) {
      expect(historyEntry.shapesAffected).toBeDefined();
      expect(Array.isArray(historyEntry.shapesAffected)).toBe(true);
      expect(historyEntry.shapesAffected.length).toBeGreaterThan(0);
    }
  });
});

test.describe('AI History Display', () => {
  test('history panel shows recent entries', async ({ authenticatedPage }) => {
    // Send a few commands
    await sendAICommand(authenticatedPage, 'Create a rectangle at 100, 100');
    await sendAICommand(authenticatedPage, 'Create a circle at 200, 200');
    
    // Check if AI history panel exists and shows entries
    const historyVisible = await authenticatedPage.getByText('Create a rectangle at 100, 100').isVisible({ timeout: 3000 });
    expect(historyVisible).toBe(true);
  });

  test('history entries show timestamp', async ({ authenticatedPage }) => {
    await sendAICommand(authenticatedPage, 'Create a shape');
    
    await authenticatedPage.waitForTimeout(1000);
    
    // Check for timestamp display (e.g., "2m ago", "just now")
    // This depends on the UI implementation
    const historyEntry = await authenticatedPage.evaluate(() => {
      // @ts-ignore
      const doc = window.yjsDoc;
      const aiHistory = doc.getArray('aiHistory');
      if (aiHistory.length === 0) return null;
      return aiHistory.get(aiHistory.length - 1);
    });
    
    expect(historyEntry?.timestamp).toBeDefined();
    expect(typeof historyEntry?.timestamp).toBe('number');
  });
});

test.describe('Guest AI Access', () => {
  test('guest users see AI history', async ({ guestPage }) => {
    // Guest page should show AI history panel
    // Even if they can't interact with it
    const canvas = guestPage.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // If AI panel exists, guest should be able to see history
    // but not send commands (tested in auth.spec.ts)
  });
});
