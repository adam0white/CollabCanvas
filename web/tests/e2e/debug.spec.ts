/**
 * Debug test to understand what's happening
 */

import { test, expect } from '@playwright/test';

test('debug: check what actually renders', async ({ page }) => {
  // Capture all console messages
  const messages: string[] = [];
  page.on('console', msg => {
    messages.push(`[${msg.type()}] ${msg.text()}`);
  });
  
  // Capture errors
  const errors: string[] = [];
  page.on('pageerror', error => {
    errors.push(error.message);
  });
  
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000); // Give it time to render
  
  // Get the actual HTML content
  const rootHTML = await page.locator('#root').innerHTML();
  console.log('=== ROOT HTML ===');
  console.log(rootHTML);
  console.log('=== LENGTH:', rootHTML.length);
  
  // Get all console messages
  console.log('\n=== CONSOLE MESSAGES ===');
  messages.forEach(msg => console.log(msg));
  
  // Get all errors
  console.log('\n=== PAGE ERRORS ===');
  errors.forEach(err => console.log(err));
  
  // Check what scripts loaded
  const scripts = await page.locator('script').count();
  console.log('\n=== SCRIPT COUNT:', scripts);
  
  // Check if React loaded
  const hasReact = await page.evaluate(() => {
    // @ts-ignore
    return typeof React !== 'undefined' || typeof window.React !== 'undefined';
  });
  console.log('=== HAS REACT:', hasReact);
  
  // Take a screenshot
  await page.screenshot({ path: '/tmp/debug-screenshot.png', fullPage: true });
  console.log('\n=== Screenshot saved to /tmp/debug-screenshot.png');
});
