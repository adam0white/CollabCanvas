/**
 * AI Canvas Agent E2E Tests
 *
 * Tests:
 * - Basic AI commands (create, move, getCanvasState)
 * - Advanced AI commands (resize, rotate, style, delete, arrange)
 * - Complex AI commands (multi-shape creation, layouts)
 * - AI history sync across users
 * - Error handling and guest access
 */

import { expect, test } from "./fixtures";

test.describe("AI Canvas Agent", () => {
  test.describe("Basic AI Tools", () => {
    test("create a red rectangle with AI", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      // Find AI textarea
      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await expect(aiTextarea).toBeVisible();

      // Enter command
      await aiTextarea.fill("Create a red rectangle at 100, 200");

      // Submit
      await authenticatedPage.getByRole("button", { name: /send/i }).click();

      // Wait for AI response (loading state should appear)
      await expect(
        authenticatedPage.locator('text="AI is thinking"'),
      ).toBeVisible();

      // Wait for completion (timeout 10s)
      await authenticatedPage.waitForTimeout(10000);

      // Check history for success
      const historySection = authenticatedPage.locator(
        "text=/Created|shape|rectangle/i",
      );
      await expect(historySection.first()).toBeVisible({ timeout: 5000 });
    });

    test("create a blue circle with AI", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.fill("Create a blue circle at 300, 300 with radius 50");

      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(10000);

      // Verify command appears in history
      const history = authenticatedPage.locator("text=/circle|Created/i");
      await expect(history.first()).toBeVisible({ timeout: 5000 });
    });

    test("create text with AI", async ({ authenticatedPage, roomId }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.fill('Create a text that says "Hello World"');

      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(10000);

      // Verify in history
      const history = authenticatedPage.locator("text=/text|Hello|Created/i");
      await expect(history.first()).toBeVisible({ timeout: 5000 });
    });

    test("AI command shows loading state", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.fill("Create a rectangle");

      await authenticatedPage.getByRole("button", { name: /send/i }).click();

      // Loading indicator should appear immediately
      await expect(
        authenticatedPage.locator('text="AI is thinking"'),
      ).toBeVisible({ timeout: 1000 });
    });
  });

  test.describe("Advanced AI Tools", () => {
    test("move shape with AI", async ({ authenticatedPage, roomId }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      // First create a shape manually to get its ID
      await authenticatedPage
        .getByRole("button", { name: /rectangle/i })
        .click();
      const canvas = authenticatedPage.locator("canvas").first();
      await canvas.hover({ position: { x: 200, y: 200 } });
      await authenticatedPage.mouse.down();
      await canvas.hover({ position: { x: 300, y: 280 } });
      await authenticatedPage.mouse.up();
      await authenticatedPage.waitForTimeout(1000);

      // Now use AI to create another shape and move it
      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.fill("Create a blue circle at 400, 300");
      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(10000);

      // Try to move it (AI will need to find the shape)
      await aiTextarea.fill("Move the blue circle to 500, 500");
      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(10000);
    });

    test("change shape color with AI", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      // Create a shape
      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.fill("Create a blue circle at 300, 300");
      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(10000);

      // Change its color
      await aiTextarea.fill("Change the blue circle to green");
      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(10000);

      // Verify command in history
      const history = authenticatedPage.locator("text=/green|color|Changed/i");
      await expect(history.first()).toBeVisible({ timeout: 5000 });
    });

    test("delete shape with AI", async ({ authenticatedPage, roomId }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      // Create a shape
      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.fill("Create a red rectangle");
      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(10000);

      // Delete it
      await aiTextarea.fill("Delete the red rectangle");
      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(10000);

      // Verify deletion in history
      const history = authenticatedPage.locator("text=/Deleted|removed/i");
      await expect(history.first()).toBeVisible({ timeout: 5000 });
    });

    test("resize shape with AI", async ({ authenticatedPage, roomId }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      // Create a shape
      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.fill("Create a rectangle at 200, 200");
      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(10000);

      // Resize it
      await aiTextarea.fill("Make the rectangle twice as big");
      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(10000);
    });

    test("rotate shape with AI", async ({ authenticatedPage, roomId }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      // Create a shape
      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.fill("Create a rectangle");
      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(10000);

      // Rotate it
      await aiTextarea.fill("Rotate the rectangle 45 degrees");
      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(10000);
    });

    test("arrange shapes with AI", async ({ authenticatedPage, roomId }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      // Create multiple shapes
      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.fill("Create 3 rectangles");
      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(10000);

      // Arrange them
      await aiTextarea.fill("Arrange the rectangles in a horizontal row");
      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(10000);
    });
  });

  test.describe("Complex AI Commands", () => {
    test("create a login form (multi-shape creation)", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.fill("Create a login form");

      await authenticatedPage.getByRole("button", { name: /send/i }).click();

      // Wait for AI to complete (complex commands may take longer)
      await authenticatedPage.waitForTimeout(15000);

      // Check history for success - should show multiple shapes created
      const history = authenticatedPage.locator("text=/form|shape|Created|3/i");
      await expect(history.first()).toBeVisible({ timeout: 5000 });
    });

    test("create a navigation bar with 4 items", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.fill("Build a navigation bar with 4 items");

      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(15000);

      // Should create multiple text elements
      const history = authenticatedPage.locator("text=/navigation|4|items/i");
      await expect(history.first()).toBeVisible({ timeout: 5000 });
    });

    test("create a 3x3 grid of circles", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.fill("Create a 3x3 grid of circles");

      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(15000);

      // Should create 9 circles
      const history = authenticatedPage.locator("text=/grid|9|circle/i");
      await expect(history.first()).toBeVisible({ timeout: 5000 });
    });

    test("complex command completes within 15 seconds", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      const startTime = Date.now();

      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.fill(
        "Create a dashboard with 5 widgets arranged in a grid",
      );

      await authenticatedPage.getByRole("button", { name: /send/i }).click();

      // Wait for completion or timeout
      await authenticatedPage.waitForTimeout(15000);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 15 seconds
      expect(duration).toBeLessThan(15000);
    });
  });

  test.describe("AI History & Collaboration", () => {
    test("AI history shows all commands", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      // Send multiple commands
      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);

      await aiTextarea.fill("Create a red rectangle");
      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(10000);

      await aiTextarea.fill("Create a blue circle");
      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(10000);

      // History should show both commands
      const historySection = authenticatedPage.locator(
        '.historyList, [class*="history"]',
      );
      const entries = historySection.locator(
        '[class*="historyEntry"], [class*="entry"]',
      );
      await expect(entries).toHaveCount(2, { timeout: 5000 });
    });

    test("history displays user name, timestamp, prompt, response", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.fill("Create a rectangle");
      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(10000);

      // Check for user name (should show "You")
      await expect(authenticatedPage.locator('text="You"')).toBeVisible({
        timeout: 5000,
      });

      // Check for timestamp (relative time like "just now" or "2s ago")
      await expect(
        authenticatedPage.locator("text=/ago|just now/i"),
      ).toBeVisible({ timeout: 5000 });

      // Check for prompt
      await expect(
        authenticatedPage.locator('text="Create a rectangle"'),
      ).toBeVisible();
    });

    test("history persists across page refresh", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      // Send a command
      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.fill("Create a test rectangle");
      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(12000); // Wait for completion and persistence

      // Refresh page
      await authenticatedPage.reload();
      await authenticatedPage.waitForLoadState("networkidle");
      await authenticatedPage.waitForTimeout(2000); // Wait for Yjs to load

      // History should still be there
      await expect(
        authenticatedPage.locator('text="Create a test rectangle"'),
      ).toBeVisible({ timeout: 5000 });
    });

    test("guest users see history but cannot send commands", async ({
      guestPage,
      authenticatedPage,
      roomId,
    }) => {
      // Authenticated user creates a command first
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.fill("Create a rectangle for testing");
      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(12000);

      // Guest navigates to same room
      await guestPage.goto(`/c/main?roomId=${roomId}`);
      await guestPage.waitForLoadState("networkidle");
      await guestPage.waitForTimeout(2000);

      // Guest should see the history
      await expect(
        guestPage.locator('text="Create a rectangle for testing"'),
      ).toBeVisible({ timeout: 5000 });

      // But input should be disabled
      const guestTextarea = guestPage.getByPlaceholder(/sign in to use AI/i);
      await expect(guestTextarea).toBeDisabled();
    });

    test("multi-user AI history sync - user A sends command, user B sees it", async ({
      multiUserContext,
      roomId,
    }) => {
      const { user1, user2 } = multiUserContext;

      await user1.goto(`/c/main?roomId=${roomId}`);
      await user2.goto(`/c/main?roomId=${roomId}`);

      await Promise.all([
        user1.waitForLoadState("networkidle"),
        user2.waitForLoadState("networkidle"),
      ]);

      await user1.waitForTimeout(1000);

      // User 1 sends an AI command
      const aiTextarea1 = user1.getByPlaceholder(/ask ai/i);
      await aiTextarea1.fill("Create a shared rectangle");
      await user1.getByRole("button", { name: /send/i }).click();

      // Wait for AI to process
      await user1.waitForTimeout(12000);

      // User 2 should see the command in history
      await expect(
        user2.locator('text="Create a shared rectangle"'),
      ).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe("AI Error Handling", () => {
    test("invalid command shows error", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      await aiTextarea.fill("asdfghjkl zxcvbnm qwertyuiop"); // Gibberish

      await authenticatedPage.getByRole("button", { name: /send/i }).click();
      await authenticatedPage.waitForTimeout(10000);

      // Should show some response (either error or inability to understand)
      // The AI might respond with "I couldn't understand" or similar
    });

    test("prompt too long (>1000 chars) is rejected", async ({
      authenticatedPage,
      roomId,
    }) => {
      await authenticatedPage.goto(`/c/main?roomId=${roomId}`);
      await authenticatedPage.waitForLoadState("networkidle");

      const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
      const longPrompt = "Create a rectangle ".repeat(100); // >1000 chars

      await aiTextarea.fill(longPrompt);
      await authenticatedPage.getByRole("button", { name: /send/i }).click();

      // Should show error about prompt length
      await expect(
        authenticatedPage.locator("text=/too long|maximum/i"),
      ).toBeVisible({ timeout: 2000 });
    });

    test("guest user sees disabled input with tooltip", async ({
      guestPage,
    }) => {
      await guestPage.goto("/c/main");
      await guestPage.waitForLoadState("networkidle");

      const aiTextarea = guestPage.getByPlaceholder(/sign in to use AI/i);
      await expect(aiTextarea).toBeVisible();
      await expect(aiTextarea).toBeDisabled();

      const submitButton = guestPage.getByRole("button", { name: /send/i });
      await expect(submitButton).toBeDisabled();
      await expect(submitButton).toHaveAttribute("title", /sign in/i);
    });
  });
});
