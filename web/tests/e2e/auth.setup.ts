/**
 * Global authentication setup
 * Saves authenticated state to be reused across tests
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as setup } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authFile = path.join(__dirname, "../../playwright/.auth/user.json");

setup("authenticate", async ({ page }) => {
  const testEmail = process.env.TEST_USER_EMAIL;
  const testPassword = process.env.TEST_USER_PASSWORD;

  if (!testEmail || !testPassword) {
    throw new Error(
      "TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in environment variables",
    );
  }

  // Navigate to app
  await page.goto("/c/main", { waitUntil: "domcontentloaded" });

  // Wait for initial load
  await page.waitForTimeout(3000);

  // Check if already signed in
  const isSignedIn = await page
    .getByRole("button", { name: /sign out/i })
    .isVisible({ timeout: 2000 })
    .catch(() => false);

  if (!isSignedIn) {
    // Click sign in button
    const signInButton = page.getByRole("button", { name: /sign in/i });
    await signInButton.waitFor({ state: "visible", timeout: 8000 });
    await signInButton.click();

    // Wait for the Clerk email input and fill it
    const emailInput = page.getByPlaceholder(/enter your email address/i);
    await emailInput.waitFor({ state: "visible", timeout: 8000 });
    await emailInput.fill(testEmail);

    // Continue to password step - try multiple selectors
    await page.waitForTimeout(500);
    const continueBtn = page.locator("button.cl-formButtonPrimary").first();
    await continueBtn.click();

    // Password field
    const passwordInput = page.getByPlaceholder(/enter your password/i);
    await passwordInput.waitFor({ state: "visible", timeout: 8000 });
    await passwordInput.fill(testPassword);

    // Final submit
    await page.waitForTimeout(500);
    const submitBtn = page.locator("button.cl-formButtonPrimary").first();
    await submitBtn.click();

    // Wait for modal to close
    await page.waitForTimeout(3000);

    // Wait for authentication to complete - check for enabled toolbar
    await page.waitForTimeout(2000);

    // Verify auth by checking if Rectangle button is enabled
    const rectEnabled = await page
      .waitForSelector('button:has-text("Rectangle"):not([disabled])', {
        timeout: 8000,
      })
      .then(() => true)
      .catch(() => false);

    if (!rectEnabled) {
      // Reload page to pick up auth state
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);

      // Try again
      await page.waitForSelector(
        'button:has-text("Rectangle"):not([disabled])',
        {
          timeout: 8000,
        },
      );
    }
  }

  // Final verification - ensure toolbar is enabled
  await page.waitForSelector('button:has-text("Rectangle"):not([disabled])', {
    timeout: 8000,
  });

  // Also verify canvas is visible
  await page
    .locator("canvas")
    .first()
    .waitFor({ state: "visible", timeout: 5000 });

  // Save signed-in state
  await page.context().storageState({ path: authFile });

  console.log("✓ Authentication state saved successfully");
});
