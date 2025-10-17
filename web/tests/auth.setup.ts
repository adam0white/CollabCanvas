/**
 * Global authentication setup
 * Saves authenticated state to be reused across tests
 */

import { test as setup } from "@playwright/test";
import path from "node:path";

const authFile = path.join(__dirname, "../playwright/.auth/user.json");

setup("authenticate", async ({ page, context }) => {
  const testEmail = process.env.TEST_USER_EMAIL;
  const testPassword = process.env.TEST_USER_PASSWORD;

  if (!testEmail || !testPassword) {
    throw new Error(
      "TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in environment variables"
    );
  }

  // Navigate to app
  await page.goto("/c/main", { waitUntil: "domcontentloaded" });

  // Wait a bit for Clerk to load
  await page.waitForTimeout(2000);

  // Check if already signed in
  const isSignedIn = await page
    .getByRole("button", { name: /sign out/i })
    .isVisible({ timeout: 3000 })
    .catch(() => false);

  if (!isSignedIn) {
    // Click sign in button
    const signInButton = page.getByRole("button", { name: /sign in/i });
    await signInButton.waitFor({ state: "visible", timeout: 5000 });
    await signInButton.click();

    // Wait for the Clerk email input and fill it
    const emailInput = page.getByPlaceholder(/enter your email address/i);
    await emailInput.waitFor({ state: "visible", timeout: 5000 });
    await emailInput.fill(testEmail);

    // Continue to password step
    await page.locator("button.cl-formButtonPrimary").first().click();

    // Password field
    const passwordInput = page.getByPlaceholder(/enter your password/i);
    await passwordInput.waitFor({ state: "visible", timeout: 5000 });
    await passwordInput.fill(testPassword);

    // Final submit
    await page.locator("button.cl-formButtonPrimary").first().click();

    // Wait for authentication to complete
    await page
      .getByRole("button", { name: /sign out/i })
      .waitFor({ state: "visible", timeout: 10000 });

    // Extra wait for Clerk to fully settle
    await page.waitForTimeout(2000);
  }

  // Verify authentication by checking toolbar is enabled
  await page.waitForSelector('button:has-text("Rectangle"):not([disabled])', {
    timeout: 5000,
  });

  // Save signed-in state
  await page.context().storageState({ path: authFile });
});

