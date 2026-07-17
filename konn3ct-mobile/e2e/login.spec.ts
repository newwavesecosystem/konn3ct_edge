import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should load the app and display login form', async ({ page }) => {
    // Navigate to the app root
    await page.goto('/');

    const signInButton = page.getByTestId('welcome-signin-button');
    await signInButton.waitFor({ state: 'visible', timeout: 150000 });
    await signInButton.click();

    // Wait for the app to initialize by checking for the email input
    const emailInput = page.getByTestId('email-input');
    await expect(emailInput).toBeVisible({ timeout: 150000 });
  });

  test('should show validation errors on empty submission', async ({ page }) => {
    await page.goto('/');

    const signInButton = page.getByTestId('welcome-signin-button');
    await signInButton.waitFor({ state: 'visible', timeout: 150000 });
    await signInButton.click();

    // Wait for the email input to ensure page is loaded
    await page.getByTestId('email-input').waitFor({ state: 'visible', timeout: 150000 });

    // Find the exact Login button using testID
    const loginButton = page.getByTestId('login-button');
    await loginButton.click();

    // Check for the React state validation error
    const errorText = page.locator('text=Please fill in all fields').first();
    await expect(errorText).toBeVisible();
  });

  test('should allow entering text and handle invalid login', async ({ page }) => {
    await page.goto('/');

    const signInButton = page.getByTestId('welcome-signin-button');
    await signInButton.waitFor({ state: 'visible', timeout: 150000 });
    await signInButton.click();

    // Fill the inputs using testIDs
    const mdaInput = page.getByTestId('mda-input');
    if (await mdaInput.isVisible()) {
      await mdaInput.fill('test-mda');
    }
    
    const emailInput = page.getByTestId('email-input');
    await emailInput.waitFor({ state: 'visible', timeout: 150000 });
    await emailInput.fill('test@example.com');

    const passwordInput = page.getByTestId('password-input');
    await passwordInput.fill('wrongpassword123');

    // Click login
    const loginButton = page.getByTestId('login-button');
    await loginButton.click();

    // The API request fails and shows "Failed to login" via React Native Alert
    // Playwright handles window.alert/window.confirm automatically, or we can listen for it
    page.on('dialog', dialog => {
      expect(dialog.message()).toContain('Failed to login');
      dialog.accept();
    });
  });
});
