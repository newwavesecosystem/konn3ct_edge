import { test, expect } from '@playwright/test';

test.describe('Waiting Room', () => {
  test('TC-002: Attendee sees waiting message before host admits them', async ({ page }) => {
    // 1. Attendee joins meeting link for a room with waiting room enabled
    await page.goto('/join/playwright-waiting-room');
    
    // Wait for the join button
    const joinBtn = page.locator('#join-meeting-btn');
    await expect(joinBtn).toBeVisible({ timeout: 15000 });

    // 2. Complete pre-room details
    const nameInput = page.locator('#join-name');
    await nameInput.fill('Waiting Attendee');
    
    const emailInput = page.locator('#join-email');
    if (await emailInput.isVisible()) {
      await emailInput.fill('waiting@example.com');
    }

    // 3. Submit join request
    await expect(joinBtn).toBeEnabled();
    await joinBtn.click();

    // 4. Observe page shown before host admits attendee
    // Wait for navigation to the meeting room URL
    await page.waitForURL(/\/meeting\/playwright-waiting-room/, { timeout: 15000 });
    
    // Verify we arrived at the correct URL
    await expect(page).toHaveURL(/\/meeting\/playwright-waiting-room/);

    // Validate that attendee sees waiting message
    await expect(page.getByText('Waiting for the host to let you in')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('You will join the meeting automatically once the host admits you.')).toBeVisible();
  });
});
