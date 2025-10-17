/**
 * Authentication & Authorization E2E Tests
 *
 * Tests:
 * - Guest (unauthenticated) user access
 * - Authenticated user access
 * - Editor vs guest role enforcement
 * - Toolbar and AI panel access control
 */

import { expect, test } from "./fixtures";
import { waitForSync, createRectangle, getCanvas } from "./helpers";

test.describe("Authentication & Authorization", () => {
  test("guest user can view canvas without signing in", async ({ page }) => {
    await page.goto("/c/main", { waitUntil: "domcontentloaded" });
    await waitForSync(page, 500);

    // Canvas should be visible
    const canvas = await getCanvas(page);
    await expect(canvas).toBeVisible();
  });

  test("guest user cannot create shapes (toolbar buttons disabled)", async ({
    page,
  }) => {
    await page.goto("/c/main", { waitUntil: "domcontentloaded" });
    await waitForSync(page, 500);

    // Rectangle button should be disabled
    const rectangleButton = page.getByRole("button", { name: /rectangle/i });
    await expect(rectangleButton).toBeDisabled();
    await expect(rectangleButton).toHaveAttribute(
      "title",
      /sign in to create shapes/i,
    );

    // Circle button should be disabled
    const circleButton = page.getByRole("button", { name: /circle/i });
    await expect(circleButton).toBeDisabled();

    // Text button should be disabled
    const textButton = page.getByRole("button", { name: /text/i });
    await expect(textButton).toBeDisabled();

    // Select button should be enabled (guests can pan/zoom)
    const selectButton = page.getByRole("button", { name: /select/i });
    await expect(selectButton).toBeEnabled();
  });

  test("guest user cannot use AI assistant", async ({ page }) => {
    await page.goto("/c/main", { waitUntil: "domcontentloaded" });
    await waitForSync(page, 500);

    // AI textarea should be disabled
    const aiTextarea = page.getByPlaceholder(/sign in to use AI/i);
    await expect(aiTextarea).toBeVisible();
    await expect(aiTextarea).toBeDisabled();

    // Submit button should be disabled
    const submitButton = page.getByRole("button", { name: /send/i });
    await expect(submitButton).toBeDisabled();
  });

  test("guest user can pan and zoom canvas", async ({ page }) => {
    await page.goto("/c/main", { waitUntil: "domcontentloaded" });
    await waitForSync(page, 500);

    // Click select tool
    await page.getByRole("button", { name: /select/i }).click();

    // Get zoom percentage button
    const zoomButton = page.getByRole("button", { name: /100%/i });
    await expect(zoomButton).toBeVisible();

    // Zoom in
    await page.getByRole("button", { name: "+" }).click();

    // Check zoom level changed
    await waitForSync(page, 100);
    const newZoomText = await zoomButton.textContent();
    expect(newZoomText).not.toBe("100%");

    // Reset zoom
    await zoomButton.click();
    await waitForSync(page, 100);
    await expect(zoomButton).toHaveText("100%");
  });

  test("authenticated user can sign in", async ({ browser }) => {
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      test.skip();
    }

    // Create a new context without stored auth to test login flow
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto("/c/main", { waitUntil: "domcontentloaded" });
    await waitForSync(page, 1000);

    // Click the Sign in button in the app header (wait for it to be visible first)
    const signInButton = page.getByRole("button", { name: /sign in/i });
    await signInButton.waitFor({ state: "visible", timeout: 5000 });
    await signInButton.click();

    // The previous implementation relied on a private data attribute [data-clerk-modal]
    // which is not present in the current Clerk UI snapshot. We switch to robust
    // accessible role & name based locators exposed in the snapshot.
    // Wait for the Clerk email input (placeholder is stable) instead of dialog role
    const emailInput = page.getByPlaceholder(/enter your email address/i);
    await emailInput.waitFor({ state: "visible", timeout: 20000 });
    await emailInput.click();
    await emailInput.fill(testEmail!);
    // confirm fill
    const emailVal = await emailInput.inputValue();

    // Continue to password step (click the form's primary button to be explicit)
    await page.locator("button.cl-formButtonPrimary").first().click();

    // Password field (placeholder: "Enter your password")
    const passwordInput = page.getByPlaceholder(/enter your password/i);
    await passwordInput.waitFor({ state: "visible", timeout: 10000 });
    await passwordInput.click();
    await passwordInput.fill(testPassword!);
    const pwdVal = await passwordInput.inputValue();

    // Final continue / submit (use form primary button)
    await page.locator("button.cl-formButtonPrimary").first().click();

    // Wait for Clerk modal to detach (login processing) before checking app state.
    // Clerk can take some time to create the session; wait up to 45s.
    try {
      await page.waitForSelector(
        '.cl-modalContent, .cl-modalBackdrop, [role="dialog"]',
        { state: "detached", timeout: 45000 }
      );
    } catch {
      // If the modal didn't detach, we'll still attempt to detect auth via app indicator below.
    }

    // Prefer to detect an app-side authenticated indicator (Sign out button) which shows
    // the app has picked up the user's session. Wait up to 45s. If it's present, skip reload.
    let sawSignOut = false;
    try {
      await page
        .getByRole("button", { name: /sign out/i })
        .waitFor({ state: "visible", timeout: 45000 });
      sawSignOut = true;
    } catch {
      // no sign-out visible yet
    }

    if (!sawSignOut) {
      // Give Clerk and the app time to settle, then reload so auth state is picked up
      await page
        .waitForLoadState("networkidle", { timeout: 20000 })
        .catch(() => {});
      await page.reload();
      await page.waitForLoadState("networkidle", { timeout: 30000 });
    }

    // Wait for toolbar Rectangle button to be visible and enabled
    const rectangleButton = page.getByRole("button", { name: /rectangle/i });
    await rectangleButton.waitFor({ state: "visible", timeout: 30000 });
    await expect(rectangleButton).toBeEnabled({ timeout: 30000 });

    // Verify toolbar buttons are enabled
    await expect(
      page.getByRole("button", { name: /rectangle/i })
    ).toBeEnabled();
    await expect(page.getByRole("button", { name: /circle/i })).toBeEnabled();
    await expect(page.getByRole("button", { name: /text/i })).toBeEnabled();

    // Cleanup
    await context.close();
  });

  test("authenticated user can create shapes", async ({
    authenticatedPage,
  }) => {
    // Rectangle button should be enabled
    await expect(
      authenticatedPage.getByRole("button", { name: /rectangle/i }),
    ).toBeEnabled();

    // Create a rectangle using helper
    await createRectangle(authenticatedPage, 100, 100, 200, 150);
  });

  test("authenticated user can use AI assistant", async ({
    authenticatedPage,
  }) => {
    // AI textarea should be enabled
    const aiTextarea = authenticatedPage.getByPlaceholder(/ask ai/i);
    await expect(aiTextarea).toBeVisible();
    await expect(aiTextarea).toBeEnabled();

    // Submit button should be enabled when text is entered
    await aiTextarea.fill("Create a red rectangle at 100, 200");
    const submitButton = authenticatedPage.getByRole("button", {
      name: /send/i,
    });
    await expect(submitButton).toBeEnabled();
  });

  test("session persists across page refresh", async ({
    authenticatedPage,
  }) => {
    // Verify user is signed in
    await expect(
      authenticatedPage.getByRole("button", { name: /rectangle/i }),
    ).toBeEnabled();

    // Refresh page
    await authenticatedPage.reload({ waitUntil: "domcontentloaded" });
    await waitForSync(authenticatedPage, 1000);

    // Toolbar should still be enabled (session persisted)
    await expect(
      authenticatedPage.getByRole("button", { name: /rectangle/i }),
    ).toBeEnabled();
  });

  test("editor vs guest role enforcement", async ({
    authenticatedPage,
    guestPage,
    roomId,
  }) => {
    // Navigate both to same room
    await authenticatedPage.goto(`/c/main?roomId=${roomId}`, { waitUntil: "domcontentloaded" });
    await guestPage.goto(`/c/main?roomId=${roomId}`, { waitUntil: "domcontentloaded" });

    await waitForSync(authenticatedPage, 1000);
    await waitForSync(guestPage, 1000);

    // Editor can create shapes
    await expect(
      authenticatedPage.getByRole("button", { name: /rectangle/i }),
    ).toBeEnabled();

    // Guest cannot create shapes
    await expect(
      guestPage.getByRole("button", { name: /rectangle/i }),
    ).toBeDisabled();

    // Create a shape as editor
    await createRectangle(authenticatedPage, 150, 150, 200, 150);

    // Give time for sync
    await waitForSync(guestPage, 1000);

    // Guest should see the shape (read-only access)
    const canvas = await getCanvas(guestPage);
    await expect(canvas).toBeVisible();
  });
});
