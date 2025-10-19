/**
 * Helper functions for E2E tests
 */

import type { Page } from "@playwright/test";

/**
 * Wait for Yjs to sync (give time for network propagation)
 */
export async function waitForSync(page: Page, ms = 500): Promise<void> {
  await page.waitForTimeout(ms);
}

/**
 * Navigate to main canvas and wait for it to be ready
 */
export async function navigateToMainCanvas(page: Page): Promise<void> {
  // Set localStorage before navigation to expand layers panel
  await page.goto("/c/main", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem("layersPanelCollapsed", "false");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForSync(page, 1000);

  // Wait for canvas to be visible
  await page
    .locator("canvas")
    .first()
    .waitFor({ state: "visible", timeout: 5000 });

  // Wait for auth to be picked up (toolbar enabled)
  await page
    .waitForSelector('button:has-text("Rectangle"):not([disabled])', {
      timeout: 8000,
    })
    .catch(() => {
      // If not immediately available, might need a moment for auth to sync
    });

  await waitForSync(page, 500);
}

/**
 * Navigate to a specific room and wait for it to be ready
 */
export async function navigateToRoom(
  page: Page,
  roomId: string,
): Promise<void> {
  await page.goto(`/c/main?roomId=${roomId}`, {
    waitUntil: "domcontentloaded",
  });
  await waitForSync(page, 1000);

  // Wait for canvas to be visible
  await page
    .locator("canvas")
    .first()
    .waitFor({ state: "visible", timeout: 5000 });

  // Wait for auth to be picked up (toolbar enabled) - if authenticated
  await page
    .waitForSelector('button:has-text("Rectangle"):not([disabled])', {
      timeout: 8000,
    })
    .catch(() => {
      // Guest users won't have enabled buttons, that's okay
    });

  await waitForSync(page, 500);
}

/**
 * Get canvas element with Firefox compatibility
 */
export async function getCanvas(page: Page) {
  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 5000 });
  return canvas;
}

/**
 * Canvas hover with Firefox compatibility
 * Uses force option to bypass pointer event interception issues
 */
export async function canvasHover(
  page: Page,
  x: number,
  y: number,
): Promise<void> {
  const canvas = await getCanvas(page);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas not found");

  // Move mouse to absolute position
  await page.mouse.move(box.x + x, box.y + y);
  await page.waitForTimeout(50); // Small delay for stability
}

/**
 * Canvas click with Firefox compatibility
 */
export async function canvasClick(
  page: Page,
  x: number,
  y: number,
  options?: { force?: boolean; delay?: number },
): Promise<void> {
  const canvas = await getCanvas(page);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas not found");

  // Click at absolute position
  await page.mouse.click(box.x + x, box.y + y, { delay: options?.delay });
  await waitForSync(page, 150);
}

/**
 * Canvas double-click with Firefox compatibility
 */
export async function canvasDoubleClick(
  page: Page,
  x: number,
  y: number,
): Promise<void> {
  const canvas = await getCanvas(page);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas not found");

  // Double-click at absolute position using mouse
  await page.mouse.dblclick(box.x + x, box.y + y);
  await waitForSync(page, 200);
}

/**
 * Drag operation with Firefox compatibility
 */
export async function canvasDrag(
  page: Page,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Promise<void> {
  await canvasHover(page, fromX, fromY);
  await page.mouse.down();
  await waitForSync(page, 100);
  await canvasHover(page, toX, toY);
  await page.mouse.up();
  await waitForSync(page, 200);
}

/**
 * Create a rectangle shape at given position
 */
export async function createRectangle(
  page: Page,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<void> {
  // Use exact match for toolbar button to avoid collision with layers panel
  await page
    .getByRole("button", { name: "Rectangle", exact: true })
    .first()
    .click();
  await canvasDrag(page, x, y, x + width, y + height);
}

/**
 * Create a circle shape at given position
 */
export async function createCircle(
  page: Page,
  x: number,
  y: number,
  radius: number,
): Promise<void> {
  // Use exact match for toolbar button to avoid collision with layers panel
  await page
    .getByRole("button", { name: "Circle", exact: true })
    .first()
    .click();

  // Calculate end position for desired radius
  const endX = x + radius * Math.cos(Math.PI / 4);
  const endY = y + radius * Math.sin(Math.PI / 4);

  await canvasDrag(page, x, y, endX, endY);
}

/**
 * Create a text shape at given position
 */
export async function createText(
  page: Page,
  x: number,
  y: number,
  text: string,
): Promise<void> {
  // Use exact match for toolbar button to avoid collision with layers panel
  await page.getByRole("button", { name: "Text", exact: true }).first().click();
  await waitForSync(page, 200);

  // Click canvas to place text using mouse position
  const canvas = await getCanvas(page);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas not found");

  await page.mouse.click(box.x + x, box.y + y);

  const textInput = page.locator('input[placeholder*="Enter text"]');
  await textInput.waitFor({ state: "visible", timeout: 5000 });
  await textInput.fill(text);
  await page.keyboard.press("Enter");

  await waitForSync(page, 300);
}

/**
 * Send an AI command and wait for completion
 */
export async function sendAICommand(
  page: Page,
  command: string,
  timeoutMs = 10000,
): Promise<void> {
  const aiTextarea = page.getByPlaceholder(/ask ai/i);
  await aiTextarea.fill(command);
  await page.getByRole("button", { name: /send/i }).click();

  // Wait for AI to complete
  await waitForSync(page, timeoutMs);
}

/**
 * Select a shape at given position
 */
export async function selectShape(
  page: Page,
  x: number,
  y: number,
): Promise<void> {
  await page.getByRole("button", { name: /select/i }).click();
  await canvasClick(page, x, y);
}

/**
 * Delete currently selected shape
 */
export async function deleteSelectedShape(page: Page): Promise<void> {
  await page.keyboard.press("Delete");
  await waitForSync(page, 300);
}

/**
 * Switch to select mode
 */
export async function switchToSelectMode(page: Page): Promise<void> {
  await page.getByRole("button", { name: /select/i }).click();
  await waitForSync(page, 100);
}

/**
 * Ensure user is authenticated (check for sign out button)
 */
export async function ensureAuthenticated(page: Page): Promise<boolean> {
  return await page
    .getByRole("button", { name: /sign out/i })
    .isVisible({ timeout: 2000 })
    .catch(() => false);
}

/**
 * Navigate both users to the same room
 */
export async function navigateToSharedRoom(
  user1: Page,
  user2: Page,
  roomId: string,
): Promise<void> {
  await Promise.all([
    user1.goto(`/c/main?roomId=${roomId}`, { waitUntil: "domcontentloaded" }),
    user2.goto(`/c/main?roomId=${roomId}`, { waitUntil: "domcontentloaded" }),
  ]);

  // Wait longer for auth to be picked up (storage state needs more time in multi-context)
  await waitForSync(user1, 3000);
  await waitForSync(user2, 3000);

  // Wait for canvas to be ready on both pages
  await Promise.all([
    user1
      .locator("canvas")
      .first()
      .waitFor({ state: "visible", timeout: 10000 }),
    user2
      .locator("canvas")
      .first()
      .waitFor({ state: "visible", timeout: 10000 }),
  ]);

  // Verify both users are authenticated (wait longer)
  await Promise.all([
    user1
      .getByRole("button", { name: /rectangle/i })
      .waitFor({ state: "visible", timeout: 10000 }),
    user2
      .getByRole("button", { name: /rectangle/i })
      .waitFor({ state: "visible", timeout: 10000 }),
  ]);

  // Wait for buttons to actually be enabled (not just visible)
  await Promise.all([
    user1
      .getByRole("button", { name: /rectangle/i })
      .isEnabled({ timeout: 15000 }),
    user2
      .getByRole("button", { name: /rectangle/i })
      .isEnabled({ timeout: 15000 }),
  ]);

  // Additional stabilization wait
  await waitForSync(user1, 1500);

  // Give Yjs time to establish connection
  await waitForSync(user1, 800);
}

/**
 * Count console errors (excluding DevTools warnings)
 */
export function setupErrorTracking(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("DevTools")) {
      errors.push(msg.text());
    }
  });
  return errors;
}
