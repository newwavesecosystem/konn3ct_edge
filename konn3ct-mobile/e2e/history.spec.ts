import { test, expect } from '@playwright/test';

test.describe('History Flow', () => {
  test('should load history and display static mock items', async ({ page }) => {
    // Read .env to check if GOV_LOGIN is true
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.includes('EXPO_PUBLIC_GOV_LOGIN=true')) {
        test.skip(true, 'History is disabled in Gov build');
      }
    }

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

    // Click History
    const historyBtn = page.getByText('History', { exact: true }).first(); // it is a list item
    await expect(historyBtn).toBeVisible();
    await historyBtn.click();

    // Verify History Screen Loaded
    // The history screen has a hardcoded item "Quarterly Planning"
    await expect(page.getByText('Quarterly Planning')).toBeVisible();
    await expect(page.getByText('john.doe@example.com, sarah.w@example.com')).toBeVisible();

    // Test Resend btn
    const resendBtn = page.getByText('Resend').first();
    await resendBtn.click();
    await expect(page.getByText('Resending...')).toBeVisible();
  });
});
