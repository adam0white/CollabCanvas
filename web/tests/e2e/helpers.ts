/**
 * Helper functions for E2E tests
 */

import type { Page } from "@playwright/test";

/**
 * Wait for Yjs to sync (give time for network propagation)
 */
export async function waitForSync(page: Page, ms = 1000): Promise<void> {
  await page.waitForTimeout(ms);
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
  await page.getByRole("button", { name: /rectangle/i }).click();
  const canvas = page.locator("canvas").first();

  await canvas.hover({ position: { x, y } });
  await page.mouse.down();
  await canvas.hover({ position: { x: x + width, y: y + height } });
  await page.mouse.up();

  await waitForSync(page, 500);
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
  await page.getByRole("button", { name: /circle/i }).click();
  const canvas = page.locator("canvas").first();

  await canvas.hover({ position: { x, y } });
  await page.mouse.down();

  // Calculate end position for desired radius
  const endX = x + radius * Math.cos(Math.PI / 4);
  const endY = y + radius * Math.sin(Math.PI / 4);

  await canvas.hover({ position: { x: endX, y: endY } });
  await page.mouse.up();

  await waitForSync(page, 500);
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
  await page.getByRole("button", { name: /text/i }).click();
  const canvas = page.locator("canvas").first();

  await canvas.click({ position: { x, y } });
  await page.waitForSelector('input[placeholder*="Enter text"]', {
    timeout: 2000,
  });
  await page.fill('input[placeholder*="Enter text"]', text);
  await page.keyboard.press("Enter");

  await waitForSync(page, 500);
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
  await page.waitForTimeout(timeoutMs);
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
  const canvas = page.locator("canvas").first();
  await canvas.click({ position: { x, y } });
  await page.waitForTimeout(200);
}

/**
 * Delete currently selected shape
 */
export async function deleteSelectedShape(page: Page): Promise<void> {
  await page.keyboard.press("Delete");
  await waitForSync(page, 500);
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
    user1.goto(`/c/main?roomId=${roomId}`),
    user2.goto(`/c/main?roomId=${roomId}`),
  ]);

  await Promise.all([
    user1.waitForLoadState("networkidle"),
    user2.waitForLoadState("networkidle"),
  ]);

  // Give Yjs time to establish connection
  await waitForSync(user1, 1000);
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
