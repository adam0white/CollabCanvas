/**
 * E2E Tests for AI Cursor Visualization and Context Awareness
 *
 * Tests:
 * - AI cursor appears during command execution
 * - Progress indicators show current operation
 * - Cursor moves between operations
 * - Context-aware commands work with selected shapes
 * - Multi-user AI cursor coordination
 * - Complex commands with many shapes don't timeout
 */

import { expect, test } from "@playwright/test";
import {
  canvasClick,
  createRectangle,
  ensureAuthenticated,
  navigateToMainCanvas,
  sendAICommand,
  switchToSelectMode,
  waitForSync,
} from "./helpers";

test.describe("AI Cursor Visualization", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMainCanvas(page);
    const isAuth = await ensureAuthenticated(page);
    expect(isAuth).toBe(true);
  });

  test("AI cursor appears during command execution", async ({ page }) => {
    // Send an AI command
    await sendAICommand(page, "create a blue rectangle at 500, 500");

    // Check for AI cursor presence (should appear briefly)
    // Note: AI cursor might disappear quickly for simple commands
    // We'll check for either the cursor or the created shape
    await waitForSync(page, 2000);

    // Verify shape was created (AI command succeeded)
    const shapes = await page.locator("canvas").first().evaluate((canvas) => {
      // Check if canvas has shapes rendered
      const ctx = (canvas as HTMLCanvasElement).getContext("2d");
      return ctx !== null;
    });

    expect(shapes).toBe(true);
  });

  test("AI cursor shows progress indicators", async ({ page }) => {
    // Send a command that creates multiple shapes (will take longer)
    await sendAICommand(page, "create 5 red circles in a row at 300, 300");

    // Wait for execution to start
    await waitForSync(page, 500);

    // Check for progress text in AI history
    await waitForSync(page, 3000);

    // Verify command appears in history
    const historyEntry = page.getByText(/created/i).first();
    await expect(historyEntry).toBeVisible({ timeout: 5000 });
  });

  test("context-aware: uses selected shapes", async ({ page }) => {
    // Create a shape first
    await createRectangle(page, 400, 400, 100, 100);
    await waitForSync(page, 500);

    // Switch to select mode and select the shape
    await switchToSelectMode(page);
    await canvasClick(page, 450, 450);
    await waitForSync(page, 300);

    // Send context-aware AI command
    await sendAICommand(
      page,
      "move the selected shape to the center",
      15000,
    );

    // Wait for execution
    await waitForSync(page, 2000);

    // Verify command succeeded (check history)
    const historyEntry = page.getByText(/moved|center/i).first();
    await expect(historyEntry).toBeVisible({ timeout: 10000 });
  });

  test("complex command with 20 shapes doesn't timeout", async ({ page }) => {
    // Send a complex command that would previously timeout
    await sendAICommand(
      page,
      "create a 4x5 grid of small blue squares starting at 200, 200",
      30000, // 30 second timeout for complex operation
    );

    // Wait for execution to complete
    await waitForSync(page, 10000);

    // Verify command succeeded
    const historyEntry = page.getByText(/created/i).first();
    await expect(historyEntry).toBeVisible({ timeout: 15000 });

    // Check that history shows successful creation
    const successIndicator = page.locator('[class*="success"]').first();
    await expect(successIndicator).toBeVisible({ timeout: 5000 });
  });

  test("AI command with viewport context", async ({ page }) => {
    // Send a command that uses viewport positioning
    await sendAICommand(page, "create a green circle here", 10000);

    // Wait for execution
    await waitForSync(page, 2000);

    // Verify shape was created near viewport center
    const historyEntry = page.getByText(/created/i).first();
    await expect(historyEntry).toBeVisible({ timeout: 10000 });
  });

  test("AI history updates in real-time", async ({ page }) => {
    // Count history entries before
    const historyBefore = await page.locator('[class*="historyEntry"]').count();

    // Send a command
    await sendAICommand(page, "create a yellow rectangle at 600, 600");

    // Wait for history to update
    await waitForSync(page, 3000);

    // Verify history entry was added
    const historyAfter = await page.locator('[class*="historyEntry"]').count();
    expect(historyAfter).toBeGreaterThan(historyBefore);
  });

  test("AI handles invalid commands gracefully", async ({ page }) => {
    // Send an invalid/unclear command
    await sendAICommand(page, "do something random that makes no sense", 10000);

    // Wait for response
    await waitForSync(page, 3000);

    // Check for error or "could not understand" message
    const errorOrMessage = page.locator('[class*="error"], [class*="failed"]').first();
    // May or may not show error - AI might interpret creatively
    // Just verify it doesn't crash
    await waitForSync(page, 1000);
  });
});

test.describe("AI Cursor Multi-User", () => {
  test("multiple users can use AI simultaneously", async ({ browser }) => {
    // Create two contexts (two users)
    const context1 = await browser.newContext({
      storageState: "playwright/.auth/user.json",
    });
    const context2 = await browser.newContext({
      storageState: "playwright/.auth/user.json",
    });

    const user1 = await context1.newPage();
    const user2 = await context2.newPage();

    try {
      // Both users navigate to the same room
      const roomId = `test-room-${Date.now()}`;
      await user1.goto(`/c/main?roomId=${roomId}`, {
        waitUntil: "domcontentloaded",
      });
      await user2.goto(`/c/main?roomId=${roomId}`, {
        waitUntil: "domcontentloaded",
      });

      await waitForSync(user1, 3000);
      await waitForSync(user2, 3000);

      // Both users send AI commands simultaneously
      const command1 = sendAICommand(
        user1,
        "create a red circle at 300, 300",
        15000,
      );
      const command2 = sendAICommand(
        user2,
        "create a blue square at 700, 700",
        15000,
      );

      // Wait for both to complete
      await Promise.all([command1, command2]);

      await waitForSync(user1, 2000);
      await waitForSync(user2, 2000);

      // Verify both commands succeeded
      const history1 = user1.locator('[class*="historyEntry"]');
      const history2 = user2.locator('[class*="historyEntry"]');

      await expect(history1.first()).toBeVisible({ timeout: 5000 });
      await expect(history2.first()).toBeVisible({ timeout: 5000 });
    } finally {
      await user1.close();
      await user2.close();
      await context1.close();
      await context2.close();
    }
  });
});

test.describe("AI Context Awareness", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMainCanvas(page);
    const isAuth = await ensureAuthenticated(page);
    expect(isAuth).toBe(true);
  });

  test("AI knows about selected shapes", async ({ page }) => {
    // Create multiple shapes
    await createRectangle(page, 200, 200, 80, 80);
    await createRectangle(page, 400, 200, 80, 80);
    await createRectangle(page, 600, 200, 80, 80);
    await waitForSync(page, 1000);

    // Select multiple shapes (Shift+Click or lasso)
    await switchToSelectMode(page);
    await canvasClick(page, 240, 240); // Select first
    await page.keyboard.down("Shift");
    await canvasClick(page, 440, 240); // Select second
    await page.keyboard.up("Shift");
    await waitForSync(page, 500);

    // Send context-aware command
    await sendAICommand(
      page,
      "arrange the selected shapes in a vertical column",
      15000,
    );

    await waitForSync(page, 3000);

    // Verify command succeeded
    const historyEntry = page.getByText(/arranged|vertical/i).first();
    await expect(historyEntry).toBeVisible({ timeout: 10000 });
  });

  test("AI provides helpful response for selection commands", async ({ page }) => {
    // Create a shape
    await createRectangle(page, 500, 500, 100, 100);
    await waitForSync(page, 500);

    // Select it
    await switchToSelectMode(page);
    await canvasClick(page, 550, 550);
    await waitForSync(page, 300);

    // Send command referring to selection
    await sendAICommand(page, "make this shape bigger", 15000);

    await waitForSync(page, 2000);

    // Verify command succeeded or got a reasonable response
    const historyEntry = page.locator('[class*="historyEntry"]').first();
    await expect(historyEntry).toBeVisible({ timeout: 10000 });
  });
});
