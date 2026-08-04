import { test, expect } from '@playwright/test';

test.describe('Signup Flow', () => {
  test('should register a new account successfully and skip verification for dev', async ({ page }) => {
    // 1. Mock API Responses
    await page.route('**/register', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Error sending verification email. Please check your SMTP settings.' 
          // This simulates the isSmtpError condition which skips verification on dev
        })
      });
    });

    await page.goto('/');

    const signInButton = page.getByTestId('welcome-signin-button');
    await signInButton.waitFor({ state: 'visible', timeout: 15000 });
    await signInButton.click();

    // Ensure we are at Login
    await expect(page.getByTestId('email-input')).toBeVisible({ timeout: 15000 });

    const signupLink = page.getByText('Sign up');
    if (!(await signupLink.isVisible())) {
      test.skip(true, 'Signup is disabled in this environment (SHOW_SIGNUP=false)');
    }

    // Navigate to Signup
    await signupLink.click();

    // Verify Signup Screen is loaded
    const submitBtn = page.getByTestId('signup-submit-btn');
    await expect(submitBtn).toBeVisible({ timeout: 10000 });

    // Fill out the form
    await page.getByTestId('signup-firstname-input').fill('Playwright');
    await page.getByTestId('signup-lastname-input').fill('User');
    await page.getByTestId('signup-email-input').fill('playwright@test.com');
    await page.getByTestId('signup-phone-input').fill('1234567890');
    await page.getByTestId('signup-password-input').fill('StrongPass123!');
    await page.getByTestId('signup-confirm-password-input').fill('StrongPass123!');

    // Submit Registration
    await submitBtn.click();

    // The app should navigate to Login with a success message
    await expect(page.getByTestId('email-input')).toBeVisible({ timeout: 10000 });
  });

  test('should show validation error on password mismatch', async ({ page }) => {
    await page.goto('/');
    
    const signInButton = page.getByTestId('welcome-signin-button');
    await signInButton.waitFor({ state: 'visible', timeout: 15000 });
    await signInButton.click();

    const signupLink = page.getByText('Sign up');
    if (!(await signupLink.isVisible())) {
      test.skip(true, 'Signup is disabled in this environment (SHOW_SIGNUP=false)');
    }

    // Navigate to Signup
    await signupLink.click();
    
    const submitBtn = page.getByTestId('signup-submit-btn');
    await expect(submitBtn).toBeVisible();

    // Fill out form with mismatched passwords
    await page.getByTestId('signup-firstname-input').fill('Test');
    await page.getByTestId('signup-lastname-input').fill('User');
    await page.getByTestId('signup-email-input').fill('test@test.com');
    await page.getByTestId('signup-phone-input').fill('1234567890');
    await page.getByTestId('signup-password-input').fill('Pass123!');
    await page.getByTestId('signup-confirm-password-input').fill('Pass456!');

    // Submit
    await submitBtn.click();

    // We don't have a specific testID for the error box, but we can check the text
    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });
});
