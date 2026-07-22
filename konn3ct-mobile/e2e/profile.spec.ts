import { test, expect } from '@playwright/test';

test.describe('Profile Flow', () => {
  test('should load profile, allow editing, and handle alerts', async ({ page }) => {
    // 1. Mock API Responses
    
    // Mock user profile/auth check
    await page.route(/.*profile.*/, route => {
      // If it's a GET request, mock the fetchProfile endpoint
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              user: {
                id: 1,
                firstname: 'John',
                lastname: 'Doe',
                email: 'test@example.com',
                phone: '+1234567890',
                referral_code: 'KONN3CT-TEST'
              },
              user_plan: {
                name: 'Pro Plan'
              }
            }
          })
        });
      } else {
        route.fallback();
      }
    });

    // Mock Login
    const loginMock = (route: any) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'fake-token',
          access_token: 'fake-token',
          user: { name: 'John Doe', email: 'test@example.com' },
          data: { name: 'John Doe', email: 'test@example.com' }
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

    // Navigate to Profile tab
    const profileTab = page.getByText('Profile', { exact: true });
    await expect(profileTab).toBeVisible();
    await profileTab.click();

    // 3. Verify Profile Screen Loaded
    // "Doe John" should be visible since ProfileScreen displays `${actualLastName} ${actualFirstName}`
    await expect(page.getByText('Doe John')).toBeVisible();
    
    // We do not check for 'Pro Plan' because it is hidden when EXPO_PUBLIC_GOV_LOGIN is true.

    // 4. Edit Profile
    
    // Mock the POST /update-profile endpoint
    await page.route(/.*update-profile.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Profile updated successfully'
        })
      });
    });

    // Click Edit button
    const editBtn = page.getByTestId('edit-profile-btn');
    await editBtn.click();

    // Verify Modal opens and fill the inputs
    const firstnameInput = page.getByTestId('firstname-input');
    await expect(firstnameInput).toBeVisible();
    await firstnameInput.fill('Jane');

    const lastnameInput = page.getByTestId('lastname-input');
    await lastnameInput.fill('Smith');
    
    const phoneInput = page.getByTestId('phone-input');
    await phoneInput.fill('+0987654321');

    // Override the GET /profile mock to return the new name after successful save
    await page.route(/.*profile.*/, route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              user: {
                id: 1,
                firstname: 'Jane',
                lastname: 'Smith',
                email: 'test@example.com',
                phone: '+0987654321',
                referral_code: 'KONN3CT-TEST'
              },
              user_plan: {
                name: 'Pro Plan'
              }
            }
          })
        });
      } else {
        route.fallback();
      }
    });

    // Accept React Native Web's potential window.confirm (though Alert.alert might be a custom DOM modal, we'll try to handle both)
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    // Click Save Changes
    const saveBtn = page.getByTestId('save-profile-btn');
    await saveBtn.click();

    // Browser dialog was already handled and accepted by page.on('dialog')

    // Wait for the modal to close and new profile name to appear
    await expect(page.getByText('Smith Jane')).toBeVisible();
  });
});
