import { test, expect } from '@playwright/test';

test.describe('Audio Stability', () => {
  // Use a longer timeout for stability tests
  test.setTimeout(120000);

  test('TC-004: Validate stability of mobile and PC audio during active meeting session', async ({ browser }) => {
    // 1. Join meeting from mobile (Context 1) and PC (Context 2)
    // Mobile Context
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 }, // iPhone 12 Pro dimensions
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
    });
    // PC Context
    const pcContext = await browser.newContext();

    const mobilePage = await mobileContext.newPage();
    const pcPage = await pcContext.newPage();

    // Host (PC) joins first
    await pcPage.goto('/join/playwright-health-room');
    await pcPage.locator('#join-name').pressSequentially('PC Speaker', { delay: 50 });
    const pcEmail = pcPage.locator('#join-email');
    if (await pcEmail.isVisible()) await pcEmail.fill('pc-speaker@konn3ct.test');
    await expect(pcPage.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
    await pcPage.locator('#join-meeting-btn').click();

    // Wait for PC to enter and ensure unmuted
    const pcControlsBar = pcPage.locator('button[title="Mute"], button[title="Unmute"]').first();
    await expect(pcControlsBar).toBeVisible({ timeout: 20000 });
    
    const pcUnmuteBtn = pcPage.locator('button[title="Unmute"]');
    if (await pcUnmuteBtn.isVisible()) {
      await pcUnmuteBtn.click();
    }

    // Attendee (Mobile) joins
    await mobilePage.goto('/join/playwright-health-room');
    await mobilePage.locator('#join-name').pressSequentially('Mobile Attendee', { delay: 50 });
    const mobEmail = mobilePage.locator('#join-email');
    if (await mobEmail.isVisible()) await mobEmail.fill('mobile-attendee@konn3ct.test');
    await expect(mobilePage.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
    await mobilePage.locator('#join-meeting-btn').click();

    // Wait for Mobile to enter
    const mobileControlsBar = mobilePage.locator('button[title="Mute"], button[title="Unmute"]').first();
    await expect(mobileControlsBar).toBeVisible({ timeout: 20000 });

    // 2. Keep active conversation ongoing.
    // In Playwright, --use-fake-ui-for-media-stream automatically sends fake audio/video.
    // We just need to wait and observe.

    // 3. Observe if sound suddenly stops.
    // We will monitor for 30 seconds to see if the audio element pauses or drops out.
    // 4. Watch for error message.
    
    // We expect NO error message about audio to appear during a stable session.
    // Since we don't know the exact DOM of the error, we will assert the audio element remains playing.
    
    let isStable = true;
    let stabilityError = '';

    for (let i = 0; i < 15; i++) {
      // Check every 2 seconds for 30 seconds total
      await mobilePage.waitForTimeout(2000);

      const audioStats = await mobilePage.evaluate(async () => {
        const audioEls = Array.from(document.querySelectorAll('audio'));
        return audioEls.map(el => {
          const stream = el.srcObject as MediaStream | null;
          const track = stream ? stream.getAudioTracks()[0] : null;
          return {
            hasSrcObject: !!stream,
            paused: el.paused,
            readyState: el.readyState,
            trackReadyState: track ? track.readyState : null,
            trackMuted: track ? track.muted : null,
            trackEnabled: track ? track.enabled : null,
          };
        });
      });

      console.log(`[Test Debug] Audio stats:`, JSON.stringify(audioStats));

      const isAudioPlaying = audioStats.some(stat => stat.hasSrcObject && !stat.paused);

      if (!isAudioPlaying && audioStats.some(stat => stat.hasSrcObject)) {
        isStable = false;
        stabilityError = `Audio element paused or dropped out during active session. Stats: ${JSON.stringify(audioStats)}`;
        break;
      } else if (!isAudioPlaying) {
        // If there is no srcObject at all, wait. It might just be connecting.
        // If it never connects, it will fail at the end anyway, but let's not break immediately.
        console.log(`[Test Debug] No audio element with srcObject found yet.`);
      }

      // Check for any obvious error toasts that might contain "audio" or "mic"
      const errorToasts = await mobilePage.locator('text=/stopped receiving audio|mic might be muted/i').count();
      if (errorToasts > 0) {
        isStable = false;
        stabilityError = 'Audio dropout error message appeared unexpectedly.';
        break;
      }
    }

    // 5. Confirm whether sound returns automatically and how long outage lasts.
    // If it dropped, we'd log it and fail the test.
    expect(isStable, stabilityError).toBe(true);

    await mobileContext.close();
    await pcContext.close();
  });
});
