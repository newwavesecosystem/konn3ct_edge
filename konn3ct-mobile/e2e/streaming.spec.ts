import { test, expect } from '@playwright/test';

test.describe('Streaming Flow', () => {
  test('should load streaming list and start a stream', async ({ page }) => {
    // 1. Mock APIs
    await page.route(/.*profile.*/, route => route.fulfill({ status: 200, body: JSON.stringify({ data: { id: 1 } }) }));
    await page.route(/.*login.*/, route => route.fulfill({ status: 200, body: JSON.stringify({ success: true, token: 'fake' }) }));
    await page.route(/.*dashboard.*/, route => route.fulfill({ status: 200, body: JSON.stringify({ rooms: 1 }) }));
    await page.route(/.*schedule.*/, route => route.fulfill({ status: 200, body: JSON.stringify({ data: [] }) }));

    await page.route(/.*myrooms.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rooms: [
            { id: 1, name: 'Main Hall' }
          ]
        })
      });
    });

    await page.route(/.*streaming.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            room_name: 'Main Hall',
            type: 'Youtube',
            status: 'running',
            is_running: true,
            created_at: '2026-10-10'
          }
        ])
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

    // Click Streaming
    const streamingBtn = page.locator('text=Streaming').last(); // Use last to avoid matching Dashboard stat
    await expect(streamingBtn).toBeVisible();
    await streamingBtn.click();

    // Verify Streams Loaded
    await expect(page.getByText('Main Hall').first()).toBeVisible();

    // Mock start stream
    await page.route(/.*start.*/, route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, message: 'Stream started successfully' })
      });
    });

    // Start New Stream
    const openModalBtn = page.getByTestId('open-stream-modal');
    await openModalBtn.click();

    // Select Youtube and enter key
    await page.getByText('Youtube', { exact: true }).first().click({ force: true });
    const keyInput = page.getByPlaceholder('Enter Youtube Key');
    await keyInput.fill('fake-stream-key');

    // Handle React Native Alert
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    // Submit
    const startBtn = page.getByTestId('start-stream-btn');
    await startBtn.click();

    // Verify success modal
    const successAlertText = page.getByText('Stream started successfully', { exact: true });
    await expect(successAlertText).toBeVisible({ timeout: 10000 });
    
    const okBtn = page.getByRole('button', { name: 'OK' });
    if (await okBtn.isVisible()) {
      await okBtn.click();
    }
  });
});
