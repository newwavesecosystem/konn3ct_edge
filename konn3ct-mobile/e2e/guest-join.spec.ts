import { test, expect } from '@playwright/test';

test.describe('Guest Join Flow', () => {
  test('should navigate to Guest Join and show validation errors', async ({ page }) => {
    // Start at the root (Login Screen)
    await page.goto('/');
    
    // Find and click the "Join as Guest" link at the bottom
    const guestLink = page.getByTestId('welcome-guest-button');
    await guestLink.waitFor({ state: 'visible', timeout: 150000 });
    await guestLink.click();

    // Verify we navigated to the Guest Join screen by looking for its specific input
    const nameInput = page.getByTestId('guest-name-input');
    await expect(nameInput).toBeVisible({ timeout: 150000 });

    // Find the Join Meeting button and click it to trigger validation
    const joinButton = page.getByTestId('guest-join-button');
    await joinButton.click();

    // Expect the first validation error: Name is required
    const errorText = page.locator('text=Please enter your display name.').first();
    await expect(errorText).toBeVisible();
  });

  test('should validate empty room ID', async ({ page }) => {
    await page.goto('/');
    const guestLink = page.getByTestId('welcome-guest-button');
    await guestLink.waitFor({ state: 'visible', timeout: 150000 });
    await guestLink.click();

    // Fill only the name
    const nameInput = page.getByTestId('guest-name-input');
    await nameInput.waitFor({ state: 'visible', timeout: 150000 });
    await nameInput.fill('Playwright Tester');

    // Click Join
    const joinButton = page.getByTestId('guest-join-button');
    await joinButton.click();

    // Expect the second validation error: Room ID is required
    const errorText = page.locator('text=Please enter the Room ID.').first();
    await expect(errorText).toBeVisible();
  });
});
