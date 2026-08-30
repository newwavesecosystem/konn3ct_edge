import { test, expect } from '@playwright/test';

test.describe('Audio Recovery', () => {
  test.setTimeout(120000);
  test('TC-003: Validate incoming audio recovery after PC browser refresh and blocked-audio prompt', async ({ browser }) => {
    // We need two participants to ensure remote audio tracks exist.
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const hostPage = await context1.newPage();
    const attendeePage = await context2.newPage();

    // 1. Host joins the meeting to provide a remote audio track
    await hostPage.goto('/join/playwright-webrtc-room');
    await hostPage.locator('#join-name').fill('Host Speaker');
    const hostEmail = hostPage.locator('#join-email');
    if (await hostEmail.isVisible()) await hostEmail.fill('host@konn3ct.test');
    await hostPage.locator('#join-meeting-btn').click();
    // Wait for host to enter
    await expect(hostPage.locator('button[title="Mute"], button[title="Unmute"]').first()).toBeVisible({ timeout: 20000 });

    // Host ensures they are unmuted to send audio
    const hostUnmuteBtn = hostPage.locator('button[title="Unmute"]');
    if (await hostUnmuteBtn.isVisible()) {
      await hostUnmuteBtn.click();
    }

    // 2. Attendee joins the meeting
    await attendeePage.goto('/join/playwright-webrtc-room');
    await attendeePage.locator('#join-name').fill('Audio Test Attendee');
    const attEmail = attendeePage.locator('#join-email');
    if (await attEmail.isVisible()) await attEmail.fill('attendee@konn3ct.test');
    await attendeePage.locator('#join-meeting-btn').click();

    // Wait for the meeting controls to indicate we are inside the room
    const attendeeControlsBar = attendeePage.locator('button[title="Mute"], button[title="Unmute"]').first();
    await expect(attendeeControlsBar).toBeVisible({ timeout: 20000 });

    // 3. Confirm audio can initially be heard by the attendee
    await attendeePage.waitForFunction(() => {
      const audioEls = Array.from(document.querySelectorAll('audio'));
      return audioEls.some(el => !el.paused && el.srcObject !== null);
    }, { timeout: 15000 }).catch(() => {
       console.log('Initial audio wait timed out or failed');
    });

    // 4. Refresh attendee browser
    // This will cause them to rejoin without user gesture, triggering autoplay block
    await attendeePage.reload();

    // Re-join if needed (some apps auto-rejoin on refresh if session is active)
    await expect(attendeeControlsBar).toBeVisible({ timeout: 20000 });

    // 5. Observe if browser blocked incoming audio message appears
    const blockedMessage = attendeePage.getByText('Your browser blocked incoming audio.');
    await expect(blockedMessage).toBeVisible({ timeout: 15000 });

    // 6. Click Enable Audio
    const enableAudioBtn = attendeePage.getByText('Click to Enable Audio');
    await expect(enableAudioBtn).toBeVisible();
    await enableAudioBtn.click();

    // 7. Observe whether audio is restored
    // We should expect the blocked message to disappear
    await expect(blockedMessage).toBeHidden({ timeout: 5000 });

    // Verify if there's any active audio element that is playing (not paused)
    const isAudioPlaying = await attendeePage.evaluate(async () => {
      // Give it a brief moment to process the play() promise
      await new Promise(r => setTimeout(r, 1000));
      const audioEls = Array.from(document.querySelectorAll('audio'));
      return audioEls.some(el => el.srcObject && !el.paused);
    });

    // If the bug exists, this expect will fail.
    expect(isAudioPlaying, 'Audio elements should be playing after clicking Enable Audio').toBe(true);

    await context1.close();
    await context2.close();
  });
});
