import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// Read .env to check if GOV_LOGIN is true
const envPath = path.join(process.cwd(), '.env');
let isGovLogin = false;
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  isGovLogin = envContent.includes('EXPO_PUBLIC_GOV_LOGIN=true');
}

test.describe('Settings Flow', () => {
  test('should load settings screen and handle UI changes', async ({ page }) => {
    // Mock login and navigation
    const loginMock = (route: any) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'fake-token',
          access_token: 'fake-token',
          user: { name: 'Test User', email: 'test@example.com' },
          data: { name: 'Test User', email: 'test@example.com' }
        })
      });
    };
    await page.route(/.*login.*/, loginMock);
    await page.route(/.*profile.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { user: { name: 'Test User' } }
        })
      });
    });
    
    // Default dashboard mocks
    await page.route(/.*dashboard.*/, route => route.fulfill({ status: 200, body: '{}' }));
    await page.route(/.*schedule.*/, route => route.fulfill({ status: 200, body: '{"data":[]}' }));
    await page.route(/.*rooms.*user.*/, route => route.fulfill({ status: 200, body: '{"data":[]}' }));

    await page.goto('/');
    const signInButton = page.getByTestId('welcome-signin-button');
    await signInButton.waitFor({ state: 'visible', timeout: 15000 });
    await signInButton.click();
    
    const mdaInput = page.getByTestId('mda-input');
    if (await mdaInput.isVisible()) {
      await mdaInput.fill('test-mda');
    }
    await page.getByTestId('email-input').fill('test@example.com');
    await page.getByTestId('password-input').fill('password123');
    await page.getByTestId('login-button').click();

    // Click More Tab
    const moreTab = page.getByText('More', { exact: true });
    await expect(moreTab).toBeVisible({ timeout: 15000 });
    await moreTab.click();

    // Click Settings
    const settingsBtn = page.getByText('Settings', { exact: true });
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    // Verify Settings Loaded
    await expect(page.getByText('Manage your account preferences and profile.')).toBeVisible();
    await expect(page.getByText('Language', { exact: true })).toBeVisible();

    if (!isGovLogin) {
      await expect(page.getByText('Appearance')).toBeVisible();
      // Click a theme
      await page.getByText('Dark').click();
      await page.getByText('System').click();
    }
  });
});
