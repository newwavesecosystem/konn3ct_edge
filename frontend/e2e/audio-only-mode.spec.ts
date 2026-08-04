import { test, expect } from '@playwright/test';

test.describe('Audio Only Mode', () => {
  // Use a longer timeout for stability/recovery tests
  test.setTimeout(90000);

  test('TC-024: Validate Audio Only Mode disables cameras successfully', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const attendeeContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const attendeePage = await attendeeContext.newPage();

    // 1. Host joins
    await hostPage.goto('/join/playwright-health-room');
    await hostPage.locator('#join-name').fill('Host User');
    await expect(hostPage.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
    await hostPage.locator('#join-meeting-btn').click();
    await expect(hostPage.locator('button[title="More"]')).toBeVisible({ timeout: 15000 });

    // Host turns camera on
    const hostCameraBtn = hostPage.locator('button[title="Camera on"], button[title="Camera off"]');
    if (await hostCameraBtn.getAttribute('title') === 'Camera on') {
      await hostCameraBtn.click();
    }
    await expect(hostPage.locator('button[title="Camera off"]')).toBeVisible({ timeout: 10000 });

    // 2. Attendee joins
    await attendeePage.goto('/join/playwright-health-room');
    await attendeePage.locator('#join-name').fill('Attendee User');
    await expect(attendeePage.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
    await attendeePage.locator('#join-meeting-btn').click();
    await expect(attendeePage.locator('button[title="More"]')).toBeVisible({ timeout: 15000 });

    // Attendee turns camera on
    const attendeeCameraBtn = attendeePage.locator('button[title="Camera on"], button[title="Camera off"]');
    if (await attendeeCameraBtn.getAttribute('title') === 'Camera on') {
      await attendeeCameraBtn.click();
    }
    await expect(attendeePage.locator('button[title="Camera off"]')).toBeVisible({ timeout: 10000 });

    // Both should see each other's video elements (2 videos total per page)
    await expect(hostPage.locator('video')).toHaveCount(2, { timeout: 10000 });
    await expect(attendeePage.locator('video')).toHaveCount(2, { timeout: 10000 });

    // 3. Attendee opens settings and toggles Audio Only Mode
    await attendeePage.locator('button[title="More"]').click();
    await attendeePage.locator('button', { hasText: /^Settings$/ }).click();
    
    // Toggle Audio-only mode ON
    const audioOnlyToggle = attendeePage.locator('button[aria-label="Audio-only mode"]');
    await audioOnlyToggle.click();

    // 4. Observe all camera/video behaviour
    // Attendee's own camera should be marked as turned off (the Camera button says "Camera on" because it's currently OFF and ready to turn ON)
    await expect(attendeePage.locator('button[title="Camera on"]')).toBeVisible({ timeout: 10000 });

    // Attendee should no longer see any video tags
    await expect(attendeePage.locator('video')).toHaveCount(0, { timeout: 10000 });

    // Attendee should see "Audio Only" text on the host's tile
    await expect(attendeePage.locator('text=Audio Only')).toBeVisible({ timeout: 10000 });

    // 5. Confirm behaviour across host and attendee views
    // The host should still see their own video, but the attendee's video should be gone (avatar shown instead)
    await expect(hostPage.locator('video')).toHaveCount(1, { timeout: 10000 });

    // 6. Toggle mode OFF
    // The settings panel is still open, so we can just click the toggle again
    await audioOnlyToggle.click();

    // 7. Re-confirm behaviour
    // Attendee's remote views should be restored (Host's video comes back)
    // Attendee has 1 video (the host's). Attendee's own camera remains off until clicked again.
    await expect(attendeePage.locator('video')).toHaveCount(1, { timeout: 10000 });

    // Attendee turns their own camera back on
    await attendeePage.locator('button[title="Camera on"]').click();

    // Both have 2 videos again
    await expect(attendeePage.locator('video')).toHaveCount(2, { timeout: 10000 });
    await expect(hostPage.locator('video')).toHaveCount(2, { timeout: 10000 });
  });
});
