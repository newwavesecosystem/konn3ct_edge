import { test, expect } from '@playwright/test';

test.describe('Schedule Flow', () => {
  test('should schedule a meeting and submit successfully', async ({ page }) => {
    // 1. Mock API Responses
    // Auth
    await page.route('**/kv4/user', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 1, name: 'Playwright User' }
        })
      });
    });

    // Let's perform a fast login
    const loginMock = (route: any) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'fake-token',
          access_token: 'fake-token',
          user: { name: 'Playwright User', email: 'test@example.com' },
          data: { name: 'Playwright User', email: 'test@example.com' }
        })
      });
    };
    await page.route('**/*login*', loginMock);

    // Mock initial schedule fetch (empty)
    await page.route('**/kv4/schedule', route => {
      // For POST requests (creation) vs GET
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: true, message: 'Scheduled Successfully' })
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] })
        });
      }
    });

    // Mock rooms fetch
    await page.route('**/kv4/myrooms', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rooms: [
            { id: 1, name: 'My Personal Room', slug: 'my-personal-room' }
          ]
        })
      });
    });

    await page.goto('/');

    const signInButton = page.getByTestId('welcome-signin-button');
    await signInButton.waitFor({ state: 'visible', timeout: 15000 });
    await signInButton.click();

    // Fast login
    const mdaInput = page.getByTestId('mda-input');
    if (await mdaInput.isVisible()) {
      await mdaInput.fill('test-mda');
    }
    const emailInput = page.getByTestId('email-input');
    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await emailInput.fill('test@example.com');
    await page.getByTestId('password-input').fill('password123');
    await page.getByTestId('login-button').click();

    // Wait for Dashboard
    await expect(page.getByTestId('schedule-meeting-btn')).toBeVisible({ timeout: 15000 });
    
    // Navigate to Schedule
    await page.getByTestId('schedule-meeting-btn').click();

    // Verify Schedule Screen
    const fab = page.getByTestId('schedule-fab');
    await expect(fab).toBeVisible();

    // Open modal
    await fab.click();

    // Fill form
    const titleInput = page.getByTestId('schedule-title-input');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Playwright Test Meeting');

    const hostnameInput = page.getByTestId('schedule-hostname-input');
    await hostnameInput.fill('Playwright Host');

    // Select Room
    await page.getByTestId('schedule-room-select').click();
    await expect(page.getByText('My Personal Room')).toBeVisible();
    await page.getByText('My Personal Room').click();

    // Submit
    const submitBtn = page.getByTestId('schedule-submit-btn');
    await expect(submitBtn).toBeVisible();
    
    // Dialog handling for successful alert
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    await submitBtn.click();

    // Allow time for request and animation
    await page.waitForTimeout(2000);
  });
});
