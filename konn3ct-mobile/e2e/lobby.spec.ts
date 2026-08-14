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
    await page.route(/.*login.*/, loginMock);

    await page.route(/.*profile.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: 1, name: 'Playwright User' }
        })
      });
    });

    await page.route(/.*dashboard.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rooms: 0, upcoming_meetings: 0 })
      });
    });

    // Mock Lobby entry (getting token via api/join)
    await page.route(/.*api\/join.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'mock-meeting-token'
        })
      });
    });

    // Mock validate meeting for Dashboard
    await page.route(/.*validate-meeting.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true
        })
      });
    });

    // Mock WebSocket to simulate Lobby waiting state
    await page.addInitScript(() => {
      class MockWebSocket {
        readyState = 0;
        onopen: any = null;
        onmessage: any = null;
        onclose: any = null;
        onerror: any = null;
        constructor(url: string) {
          setTimeout(() => {
            this.readyState = 1;
            if (this.onopen) this.onopen();
            // Send back 'session_status' with status 'waiting'
            setTimeout(() => {
              if (this.onmessage) {
                this.onmessage({ data: JSON.stringify({ type: 'session_status', status: 'waiting' }) });
              }
            }, 500);
          }, 100);
        }
        send(data: any) {}
        close() {}
      }
      (window as any).WebSocket = MockWebSocket;
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
    

    await page.getByTestId('join-room-submit-btn').click();

    // We should see the Lobby leave button while connecting or waiting
    const leaveBtn = page.getByTestId('leave-lobby-btn');
    await expect(leaveBtn).toBeVisible({ timeout: 10000 });

    // Click leave
    await leaveBtn.click();

    // We should be redirected back to Dashboard
    await expect(page.getByText("Today's Meetings").first()).toBeVisible({ timeout: 15000 });
  });
});
