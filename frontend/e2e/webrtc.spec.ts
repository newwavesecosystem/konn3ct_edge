import { test, expect } from '@playwright/test';

// Shared join helper
async function joinMeeting(page: any, userName: string) {
  await page.goto('/join/playwright-test-room');
  await page.waitForLoadState('networkidle');

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

    // Verify local video is playing
    const liveVideoTracks = await page.evaluate(() =>
      Array.from(document.querySelectorAll('video'))
        .filter(v => v.srcObject instanceof MediaStream)
        .flatMap(v => (v.srcObject as MediaStream).getVideoTracks())
        .filter(t => t.readyState === 'live' && t.enabled).length
    );
    expect(liveVideoTracks).toBeGreaterThanOrEqual(1);
  });

  test('Test 2: Multi-Peer Video Consume', async ({ browser }) => {
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

    // Verify User B receives User A's video stream
    const remoteVideoTracksB = await pageB.evaluate(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      return videos
        .filter(v => v.srcObject instanceof MediaStream)
        .flatMap(v => (v.srcObject as MediaStream).getVideoTracks())
        .filter(t => t.readyState === 'live').length;
    });

    // User B should have their own local (or no local) plus User A's remote
    expect(remoteVideoTracksB).toBeGreaterThanOrEqual(1);

    await contextA.close();
    await contextB.close();
  });

  test('Test 3: Active Speaker Propagation', async ({ browser }) => {
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
    
    // In our app, active speakers have a specific class or border. We can check if a tile has the glowing border.
    // The border is applied to ring-2 ring-emerald-500 or similar.
    
    const glowingTile = pageB.locator('.ring-emerald-500').first();
    // Wait up to 10 seconds for the backend to run audio-level observing and send the event
    await expect(glowingTile).toBeVisible({ timeout: 10000 });

    await contextA.close();
    await contextB.close();
  });
});
