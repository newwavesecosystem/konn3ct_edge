import { test, expect } from '@playwright/test';

test.describe('Events Flow', () => {
  test('should load events, open create modal, and submit a new event', async ({ page }) => {
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

    // Mock Dashboard stats
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

    // Mock Rooms (needed for Event creation dropdown)
    await page.route(/.*myrooms.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_rooms: 1,
          max_rooms: 10,
          rooms: [
            {
              id: 1,
              name: 'Test Event Room',
              url: 'test-event-room',
              privacy: 0,
              status: 'active',
              mode: 'meeting'
            }
          ]
        })
      });
    });

    // Mock initial Event Summary
    await page.route(/.*event-summary.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            total_events: 0,
            total_participants: 0
          }
        })
      });
    });

    // Mock initial Event List
    await page.route(/.*event-list.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: []
        })
      });
    });

    // Mock Recent Registrations
    await page.route(/.*event-recent-registrations.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: []
        })
      });
    });

    // 2. Perform Login and Navigate
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

    // Verify Dashboard Loaded
    const hostBtn = page.getByTestId('host-meeting-btn');
    await expect(hostBtn).toBeVisible({ timeout: 15000 });

    // Navigate to Events tab
    // In MainTabNavigator, it can be 'Events' or 'Add ons' depending on APP_CONFIG.
    // Let's look for 'Events'.
    const eventsTab = page.getByText('Events', { exact: true });
    await expect(eventsTab).toBeVisible();
    await eventsTab.click();

    // 3. Verify Events Screen Loaded
    // We expect the "No events yet" text to be visible initially
    await expect(page.getByText('No events yet')).toBeVisible();

    // 4. Create Event
    
    // Override event-summary to return new stats
    await page.route(/.*event-summary.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            total_events: 1,
            total_participants: 0
          }
        })
      });
    });

    // Override event-list to return the new event
    await page.route(/.*event-list.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: "101",
              title: "Annual E2E Summit",
              hostname: "Playwright Inc",
              room_id: "1",
              room_name: "Test Event Room",
              date: "2026-12-31",
              time: "10:00",
              timezone: "Africa/Lagos",
              public: 1,
              free: 1
            }
          ]
        })
      });
    });

    // Mock create event endpoint
    await page.route(/.*pre-reg.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Event created successfully!'
        })
      });
    });

    // Click "Create Event" main button
    const createBtn = page.getByTestId('create-event-btn');
    await createBtn.click();

    // Wait for Modal to open
    const titleInput = page.getByPlaceholder('e.g. Annual Tech Summit');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Annual E2E Summit');

    const hostInput = page.getByPlaceholder('Your Name or Company');
    await hostInput.fill('Playwright Inc');

    // Select Room (dropdown)
    // The placeholder text is "Choose a room" when empty, but we mocked 1 room so it should be visible
    const selectRoomDropdown = page.getByText('Choose a room');
    await selectRoomDropdown.click();

    // Click the actual room from the dropdown list
    const roomOption = page.getByText('Test Event Room', { exact: true });
    await expect(roomOption).toBeVisible();
    await roomOption.click();

    // Handle the Success Alert that RN might pop up
    // Just in case it's a native alert
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    // Click submit event
    const submitBtn = page.getByTestId('submit-event-btn');
    await submitBtn.click();

    // Handle React Native Web's Alert modal if it pops up as DOM text
    const successAlertText = page.getByText('Event created successfully!', { exact: true });
    await expect(successAlertText).toBeVisible({ timeout: 10000 });
    
    // There's usually an 'OK' button on the Alert modal
    const okBtn = page.getByRole('button', { name: 'OK' });
    if (await okBtn.isVisible()) {
      await okBtn.click();
    }

    // Wait for the modal to close and new event to appear
    await expect(page.getByText('Annual E2E Summit', { exact: true })).toBeVisible();
  });
});
