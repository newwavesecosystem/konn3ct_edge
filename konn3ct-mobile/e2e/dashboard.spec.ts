import { test, expect } from '@playwright/test';

test.describe('Dashboard Flow', () => {
  test('should load dashboard, display upcoming meetings, and test quick actions', async ({ page }) => {
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

    // Mock Dashboard stats
    await page.route(/.*dashboard.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rooms: 5,
          upcoming_meetings: 2,
          streaming: 0,
          recordings: 1
        })
      });
    });

    // Mock today's schedules
    await page.route(/.*schedule\/today.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    // Mock upcoming schedules (should be shown in list)
    await page.route(/.*schedule.*/, route => {
      // Return one meeting in the future
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: '1234',
              title: 'Project Kickoff',
              topic: 'Project Kickoff',
              time: futureDate.toISOString(),
              start_time: futureDate.toISOString(),
              startTime: futureDate.toISOString(),
              date: futureDate.toISOString(),
              duration: '60',
              room_id: 'proj-kickoff'
            }
          ]
        })
      });
    });

    // 2. We inject auth token to bypass login screen or navigate via login
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

    await page.goto('/');

    const signInButton = page.getByTestId('welcome-signin-button');
    await signInButton.waitFor({ state: 'visible', timeout: 15000 });
    await signInButton.click();

    // Perform Login
    const mdaInput = page.getByTestId('mda-input');
    if (await mdaInput.isVisible()) {
      await mdaInput.fill('test-mda');
    }
    const emailInput = page.getByTestId('email-input');
    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await emailInput.fill('test@example.com');
    await page.getByTestId('password-input').fill('password123');
    await page.getByTestId('login-button').click();

    // 3. Verify Dashboard Loaded
    // Dashboard should have our Join, Host, and Schedule buttons
    const joinBtn = page.getByTestId('join-meeting-btn');
    await expect(joinBtn).toBeVisible({ timeout: 15000 });

    const hostBtn = page.getByTestId('host-meeting-btn');
    await expect(hostBtn).toBeVisible();

    const scheduleBtn = page.getByTestId('schedule-meeting-btn');
    await expect(scheduleBtn).toBeVisible();

    // Verify Upcoming Meeting rendered
    // The "Project Kickoff" title should be visible
    await expect(page.getByText('Project Kickoff')).toBeVisible();

    // 4. Test Join Modal interaction
    await joinBtn.click();
    const joinInput = page.getByTestId('join-room-id-input');
    await expect(joinInput).toBeVisible();
    await joinInput.fill('test-room-123');
    
    // We close the modal by clicking outside or just verifying it opened
    // For this test, verifying the modal opens and input works is sufficient
    // We can also click Join but it would transition to Lobby
  });
});
