import { test, expect } from '@playwright/test';

test.describe('Lobby Flow', () => {
  test('should enter the lobby and handle wait state', async ({ page }) => {
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

    await page.route('**/kv4/user', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 1, name: 'Playwright User' }
        })
      });
    });

    await page.route('**/kv4/dashboard', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rooms: 0, upcoming_meetings: 0 })
      });
    });

    // Mock Lobby entry (getting token)
    await page.route('**/kv4/validate-meeting*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { token: 'mock-meeting-token' }
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
    await expect(page.getByTestId('join-meeting-btn')).toBeVisible({ timeout: 15000 });

    // Open Join Modal
    await page.getByTestId('join-meeting-btn').click();
    await page.getByTestId('join-room-id-input').fill('wait-room-123');
    
    // We mock the websocket to simulate waiting in the lobby
    await page.route('**/*', async route => {
      if (route.request().url().includes('mediasoup')) {
        // Just let it timeout or mock it gracefully so we see the waiting status
        return route.abort(); 
      }
      return route.continue();
    });

    await page.getByTestId('join-room-submit-btn').click();

    // We should see the Lobby leave button while connecting or waiting
    const leaveBtn = page.getByTestId('leave-lobby-btn');
    await expect(leaveBtn).toBeVisible({ timeout: 10000 });

    // Click leave
    await leaveBtn.click();

    // We should be redirected back to Dashboard
    await expect(page.getByTestId('join-meeting-btn')).toBeVisible();
  });
});
