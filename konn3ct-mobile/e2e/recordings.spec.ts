import { test, expect } from '@playwright/test';

test.describe('Recordings Flow', () => {
  test('should load recordings list', async ({ page }) => {
        // 1. Mock API Responses
    
    // Mock user profile/auth check
    await page.route(/.*profile.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 1,
            name: 'Playwright User',
            email: 'test@example.com',
          }
        })
      });
    });

    // We inject auth token to bypass login screen or navigate via login
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
    await page.route(/.*login.*/, loginMock);

    // Mock Dashboard stats (so it doesn't fail on Home)
    await page.route(/.*dashboard.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rooms: 1,
          upcoming_meetings: 0,
          streaming: 0,
          recordings: 0
        })
      });
    });

    // Mock Schedule for Dashboard
    await page.route(/.*schedule.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] })
      });
    });

    // Mock Recordings API
    await page.route(/.*recording.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              recordID: 'rec123',
              name: 'Test Recording Session',
              participants: 5,
              size: '10485760', // 10MB
              startTime: '1700000000000',
              endTime: '1700003600000', // +1 hour
            }
          ]
        })
      });
    });

        // Navigate and Login
    await page.goto('/');
    const signInButton = page.getByTestId('welcome-signin-button');
    await signInButton.waitFor({ state: 'visible', timeout: 15000 });
    await signInButton.click();

    const mdaInput = page.getByTestId('mda-input');
    if (await mdaInput.isVisible()) {
      await mdaInput.fill('test-mda');
    }
    const emailInput = page.getByTestId('email-input');
    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await emailInput.fill('test@example.com');
    await page.getByTestId('password-input').fill('password123');
    await page.getByTestId('login-button').click();

    // Verify Dashboard Loaded by checking for host meeting btn
    const hostBtn = page.getByTestId('host-meeting-btn');
    await expect(hostBtn).toBeVisible({ timeout: 15000 });

    // Go to More Tab
    const moreTab = page.getByText('More', { exact: true });
    await expect(moreTab).toBeVisible({ timeout: 15000 });
    await moreTab.click();

    // Click Recordings
    const recordingsBtn = page.locator('text=Recordings').last(); // Use last to avoid matching Dashboard stat
    await expect(recordingsBtn).toBeVisible();
    await recordingsBtn.click();

    // Verify Recordings Screen Loaded
    await expect(page.getByText('Test Recording Session')).toBeVisible();
    
    // Check if the MB conversion shows
    await expect(page.getByText('10.0 MB')).toBeVisible();
  });
});
