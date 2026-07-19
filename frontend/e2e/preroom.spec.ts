import { test, expect } from '@playwright/test';

test.describe('Pre-Room Flow', () => {
  test('Attendee can complete pre-room details and test devices before joining', async ({ page }) => {
    // 1. Open meeting link
    await page.goto('/join/playwright-webrtc-room');
    
    // Wait for the page to load by waiting for the join button
    const joinBtn = page.locator('#join-meeting-btn');
    await expect(joinBtn).toBeVisible({ timeout: 15000 });

    // Verify video preview is initially visible (isCameraOn is true by default)
    const videoPreview = page.locator('video');
    await expect(videoPreview).toHaveClass(/opacity-100/, { timeout: 10000 });

    // 2. Enter required pre-room meeting details
    const nameInput = page.locator('#join-name');
    await nameInput.fill('Test Attendee');
    
    const emailInput = page.locator('#join-email');
    if (await emailInput.isVisible()) {
      await emailInput.fill('attendee@example.com');
    }

    // 3. Test microphone input
    // The mic button is the first button in the bottom-4 control bar
    const micBtn = page.locator('.absolute.bottom-4 button').nth(0);
    
    // By default, it's unmuted. Let's click it to Mute.
    await micBtn.click();
    
    // Audio meter should be hidden when muted
    const audioMeter = page.locator('.absolute.bottom-\\[4\\.5rem\\]');
    await expect(audioMeter).toBeHidden();
    
    // Unmute again
    await micBtn.click();

    // 4. Test camera preview
    // The camera button is the second button
    const camBtn = page.locator('.absolute.bottom-4 button').nth(1);
    
    // Click to turn off camera
    await camBtn.click();
    
    // Verify video preview becomes hidden (opacity-0) and avatar fallback shows
    await expect(videoPreview).toHaveClass(/opacity-0/);
    await expect(page.getByText('Camera is off')).toBeVisible();

    // Turn camera back on
    await camBtn.click();
    await expect(videoPreview).toHaveClass(/opacity-100/);

    // 5. Test speaker output
    const speakerBtn = page.locator('button[title="Test Speaker"]');
    // Click the test speaker button. This creates an AudioContext and plays a tone.
    await speakerBtn.click();

    // 6. Proceed to join or wait for admission
    await expect(joinBtn).toBeEnabled();
    await joinBtn.click();

    // Wait for navigation to the meeting room
    await page.waitForURL(/\/meeting\/playwright-webrtc-room/, { timeout: 15000 });
    
    // Verify we arrived in the meeting page successfully
    await expect(page).toHaveURL(/\/meeting\/playwright-webrtc-room/);
  });
});
