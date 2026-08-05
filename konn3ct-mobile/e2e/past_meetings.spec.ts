import { test, expect } from '@playwright/test';

test.describe('Past Meetings Flow', () => {
  test('should load past meetings and display filtered list', async ({ page }) => {
    // 1. Mock Login & Dashboard
    await page.route(/.*profile.*/, route => route.fulfill({ status: 200, body: JSON.stringify({ data: { id: 1 } }) }));
    await page.route(/.*login.*/, route => route.fulfill({ status: 200, body: JSON.stringify({ success: true, token: 'fake' }) }));
    await page.route(/.*dashboard.*/, route => route.fulfill({ status: 200, body: JSON.stringify({ rooms: 1 }) }));
    
    // Mock Schedule to return a past meeting
    await page.route(/.*schedule.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 1,
              title: 'Old Town Hall',
              time: '2020-01-01T10:00:00Z', // Definitely in the past
              guest: 'guest1@test.com'
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

    // Click Past Meetings
    const pastBtn = page.getByText('Past Meetings', { exact: true });
    await expect(pastBtn).toBeVisible();
    await pastBtn.click();

    // Verify Past Meetings Screen Loaded
    await expect(page.getByText('Old Town Hall')).toBeVisible();
    
    // Test Search filtering
    const searchInput = page.getByPlaceholder('Search past meetings...');
    await searchInput.fill('Unknown');
    await expect(page.getByText('Old Town Hall')).not.toBeVisible();
    
    await searchInput.fill('Old');
    await expect(page.getByText('Old Town Hall')).toBeVisible();
  });
});
