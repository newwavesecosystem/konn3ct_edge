import { test, expect } from '@playwright/test';

test.describe('Conn3ct Landing & App', () => {
  test('landing page has correct title', async ({ page }) => {
    // Navigate to the root
    await page.goto('/');

    // Next.js dev server may take a moment to compile, playwright waits automatically
    // Validate we're on the landing page or login by checking some basic text
    await expect(page).toHaveTitle(/konn3ct/i);
  });
});
