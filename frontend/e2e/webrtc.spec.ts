import { test, expect } from '@playwright/test';

// Shared join helper
async function joinMeeting(page: any, userName: string) {
  await page.goto('/join/playwright-webrtc-room');
  await page.waitForLoadState('domcontentloaded');

  const nameInput = page.locator('#join-name');
  await expect(nameInput).toBeVisible({ timeout: 15000 });
  await nameInput.click();
  await nameInput.pressSequentially(userName, { delay: 50 });

  const joinBtn = page.locator('#join-meeting-btn');
  await expect(joinBtn).toBeEnabled({ timeout: 8000 });
  await joinBtn.click();

  // Wait for meeting controls to appear
  const controlsBar = page.locator('button[title="Mute"], button[title="Unmute"]').first();
  await expect(controlsBar).toBeVisible({ timeout: 20000 });
}

test.describe.configure({ mode: 'serial' });

test.describe('E2E WebRTC Signaling & Media', () => {

  test('Test 1: WebRTC Handshake & Video Producer setup', async ({ page }) => {
    await joinMeeting(page, 'Test User 1');

    // Turn on camera
    const camOnBtn = page.locator('button[title="Camera on"]');
    const camOffBtn = page.locator('button[title="Camera off"]');
    
    if (await camOnBtn.isVisible()) {
      await camOnBtn.click();
      await expect(camOffBtn).toBeVisible({ timeout: 5000 });
    }

    await expect.poll(async () => {
      const { count, states } = await page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video'));
        const statesData = videos.map(v => {
          const stream = v.srcObject as MediaStream;
          return {
            isStream: stream instanceof MediaStream,
            trackCount: stream?.getVideoTracks?.()?.length || 0,
            states: stream?.getVideoTracks?.()?.map(t => t.readyState) || []
          };
        });
        return { count: statesData.flatMap(s => s.states).filter(s => s === 'live').length, states: statesData };
      });
      console.log('Node Video states:', JSON.stringify(states));
      return count;
    }, { timeout: 30000 }).toBeGreaterThanOrEqual(1);
  });

  test.skip('Test 2: Multi-Peer Video Consume', async ({ browser }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await joinMeeting(pageA, 'User A');

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await joinMeeting(pageB, 'User B');

    // User A turns on camera
    const camOnBtnA = pageA.locator('button[title="Camera on"]');
    if (await camOnBtnA.isVisible()) {
      await camOnBtnA.click();
      await expect(pageA.locator('button[title="Camera off"]')).toBeVisible({ timeout: 5000 });
    }

    // Give time for WebRTC to negotiate and User B to receive the track
    await pageB.waitForTimeout(3000);

    // Give time for WebRTC to negotiate and User B to receive the track
    // User B should have their own local (or no local) plus User A's remote
    await expect.poll(async () => {
      return await pageB.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video'));
        return videos
          .filter(v => v.srcObject instanceof MediaStream)
          .flatMap(v => (v.srcObject as MediaStream).getVideoTracks())
          .filter(t => t.readyState === 'live').length;
      });
    }, { timeout: 30000 }).toBeGreaterThanOrEqual(1);

    // Playwright will automatically clean up contexts at the end of the test.
  });

  test.skip('Test 3: Active Speaker Propagation', async ({ browser }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await joinMeeting(pageA, 'Speaker A');

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await joinMeeting(pageB, 'Listener B');

    // Unmute Speaker A
    const unmuteBtnA = pageA.locator('button[title="Unmute"]');
    if (await unmuteBtnA.isVisible()) {
      await unmuteBtnA.click();
      await expect(pageA.locator('button[title="Mute"]')).toBeVisible({ timeout: 3000 });
    }

    // Because we are using fake audio device, it generates a 440hz sine wave continuously.
    // The backend should detect this and broadcast active_speaker for Speaker A.
    // We expect Listener B's UI to show the active speaker border.
    
    // In our app, active speakers have a specific class or border. We can    // Since Test User 1's synthetic mic emits a 440Hz tone constantly, 
    // it should be detected as an active speaker by the backend within a few seconds.
    const glowingTile = pageB.locator('.border-brand-green').first();
    // Wait up to 10 seconds for the backend to run audio-level observing and send the event
    await expect(glowingTile).toBeVisible({ timeout: 10000 });

    // Playwright will automatically clean up contexts at the end of the test.
  });

  test.skip('Test 4: Ask to Unmute', async ({ browser }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await joinMeeting(pageA, 'Host A');

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await joinMeeting(pageB, 'Attendee B');

    // Host A locks the mic
    await pageA.locator('button[title="Security"]').click();
    await pageA.locator('label', { hasText: 'Lock Microphones' }).click();

    // Attendee B's mic is locked
    await expect(pageB.locator('button[title="Unmute"]')).toBeDisabled({ timeout: 5000 });

    // Host A asks Attendee B to unmute
    await pageA.locator('button[title="Participants"]').click();
    
    // Hover over Attendee B to show the "Ask to Unmute" button
    const participantRowB = pageA.locator('.flex-1.min-w-0', { hasText: 'Attendee B' }).locator('..');
    await participantRowB.hover();
    await participantRowB.locator('button[title="Ask to Unmute"]').click();

    // Attendee B should get a toast
    const toastBtn = pageB.locator('button', { hasText: 'Unmute Now' });
    await expect(toastBtn).toBeVisible({ timeout: 10000 });
    await toastBtn.click();

    // Attendee B's mic should be enabled and unmuted
    const muteBtnB = pageB.locator('button[title="Mute"]');
    await expect(muteBtnB).toBeEnabled({ timeout: 5000 });
    await expect(muteBtnB).toBeVisible();

    // Playwright will automatically clean up contexts at the end of the test.
  });
});
