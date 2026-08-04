import { test, expect } from '@playwright/test';

test.describe('Welcome Flow', () => {
  test('should load welcome screen and navigate to guest join', async ({ page }) => {
    // Clear any previous route state
    await page.goto('/');

    // Welcome Screen
    await expect(page.getByText('Welcome', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Sign in to your account or join a meeting without one')).toBeVisible();
    
    // Check buttons
    const signInBtn = page.getByTestId('welcome-signin-button');
    await expect(signInBtn).toBeVisible();
    
    const guestBtn = page.getByTestId('welcome-guest-button');
    await expect(guestBtn).toBeVisible();

    // Click Guest Join
    await guestBtn.click();

    // Verify Guest Join Screen Loaded
    await expect(page.getByText('Join as Guest', { exact: true }).last()).toBeVisible();
    await expect(page.getByPlaceholder('Enter Room ID')).toBeVisible();
  });
});
