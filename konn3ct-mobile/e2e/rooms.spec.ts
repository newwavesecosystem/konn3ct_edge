import { test, expect } from '@playwright/test';

test.describe('Rooms Flow', () => {
  test('should load rooms, create a room, and delete a room', async ({ page }) => {
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

    // Initial Rooms fetch mock
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
              name: 'Initial Room',
              url: 'initial-room',
              privacy: 0,
              status: 'active',
              mode: 'meeting'
            }
          ]
        })
      });
    });

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

    // Verify Dashboard Loaded by checking for host meeting btn
    const hostBtn = page.getByTestId('host-meeting-btn');
    await expect(hostBtn).toBeVisible({ timeout: 15000 });

    // Navigate to Rooms tab
    const roomsTab = page.getByText('Rooms', { exact: true });
    await expect(roomsTab).toBeVisible();
    await roomsTab.click();

    // 3. Verify Rooms Screen Loaded
    // We expect the "Initial Room" to be visible
    await expect(page.getByText('Initial Room')).toBeVisible();

    // 4. Create Room
    // Override myrooms route to return the new room after creation
    await page.route(/.*myrooms.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_rooms: 2,
          max_rooms: 10,
          rooms: [
            {
              id: 1,
              name: 'Initial Room',
              url: 'initial-room',
              privacy: 0,
              status: 'active',
              mode: 'meeting'
            },
            {
              id: 2,
              name: 'E2E Test Room',
              url: 'e2e-test-room',
              privacy: 0,
              status: 'active',
              mode: 'meeting'
            }
          ]
        })
      });
    });

    // Mock createroom endpoint
    await page.route(/.*createroom.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Room created successfully!'
        })
      });
    });

    // Click "Create Room"
    const createBtn = page.getByTestId('create-room-btn');
    await createBtn.click();

    // Wait for Modal
    const roomNameInput = page.getByPlaceholder('e.g. Marketing Weekly Sync');
    await expect(roomNameInput).toBeVisible();
    await roomNameInput.fill('E2E Test Room');

    // Click submit in modal (which is the last 'Create Room' text)
    const submitBtn = page.getByText('Create Room', { exact: true }).last();
    await submitBtn.click();

    // Verify success message inside the modal
    await expect(page.getByText('Room created successfully!')).toBeVisible();

    // Wait for the modal to close and new room to appear
    await expect(page.getByText('E2E Test Room')).toBeVisible();

    // 5. Delete Room
    // Override myrooms route again to simulate deletion
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
              name: 'Initial Room',
              url: 'initial-room',
              privacy: 0,
              status: 'active',
              mode: 'meeting'
            }
          ]
        })
      });
    });

    await page.route(/.*deleteroom\/2.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Room deleted'
        })
      });
    });

    // Click delete on the newly created room (id: 2)
    const deleteBtn = page.getByTestId('delete-room-2');
    await deleteBtn.click();
    
    // In React Native Web, Alert.alert renders a DOM modal instead of a native browser dialog.
    // Click the confirmation "Delete" button
    const confirmDeleteBtn = page.getByText('Delete', { exact: true }).last();
    await confirmDeleteBtn.click();
    
    // Wait for the room to disappear
    await expect(page.getByText('E2E Test Room', { exact: true })).not.toBeVisible();
  });
});
