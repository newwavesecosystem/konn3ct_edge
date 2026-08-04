import { test, expect } from '@playwright/test';

// Shared join helper
async function joinMeeting(page: any, userName: string, micOn = false, camOn = false) {
  await page.goto('/join/playwright-webrtc-room');
  await page.waitForLoadState('domcontentloaded');

  const nameInput = page.locator('#join-name');
  await expect(nameInput).toBeVisible({ timeout: 15000 });
  await nameInput.click();
  await nameInput.pressSequentially(userName, { delay: 50 });

  // Wait a bit to ensure prejoin components are fully mounted before interacting
  await page.waitForTimeout(500);

  // Toggle mic based on preference
  const micBtn = page.locator('button[title="Mute"], button[title="Unmute"]').first();
  if (await micBtn.isVisible()) {
    const isMicCurrentlyOn = (await micBtn.getAttribute('title')) === 'Mute';
    if ((micOn && !isMicCurrentlyOn) || (!micOn && isMicCurrentlyOn)) {
      await micBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // Toggle camera based on preference
  const camBtn = page.locator('button[title="Camera off"], button[title="Camera on"]').first();
  if (await camBtn.isVisible()) {
    const isCamCurrentlyOn = (await camBtn.getAttribute('title')) === 'Camera off';
    if ((camOn && !isCamCurrentlyOn) || (!camOn && isCamCurrentlyOn)) {
      await camBtn.click();
      await page.waitForTimeout(500);
    }
  }

  const joinBtn = page.locator('#join-meeting-btn');
  await expect(joinBtn).toBeEnabled({ timeout: 8000 });
  await joinBtn.click();

  // Wait for meeting controls to appear
  const controlsBar = page.locator('button[title="Mute"], button[title="Unmute"]').first();
  await expect(controlsBar).toBeVisible({ timeout: 20000 });
}

test.describe.configure({ mode: 'serial' });

test.describe('Media Initialization & Error Recovery', () => {

  test('Camera toggle restart bug - should not fail after multiple restarts', async ({ page }) => {
    // Navigate to meeting and join with camera initially off
    await joinMeeting(page, 'Camera Tester', false, false);
    
    // Check that we don't see any error toasts
    page.on('dialog', async (dialog) => {
      console.log('Dialog:', dialog.message());
      await dialog.accept();
    });

    const camOffBtn = page.locator('button[title="Camera off"]');
    const camOnBtn = page.locator('button[title="Camera on"]');

    // Action 1: Turn on camera
    await expect(camOnBtn).toBeVisible();
    await camOnBtn.click();
    await expect(camOffBtn).toBeVisible({ timeout: 10000 }); // Wait for it to become 'off' button

    // Wait 5 seconds
    await page.waitForTimeout(5000);

    // Action 2: Turn off camera
    await camOffBtn.click();
    await expect(camOnBtn).toBeVisible({ timeout: 5000 });

    // Action 3: Try to turn it on for another 5 seconds
    await camOnBtn.click();
    await expect(camOffBtn).toBeVisible({ timeout: 10000 });
    
    // Check toast does not say "Camera could not start"
    const toasts = page.locator('ol[data-sonner-toaster] li');
    const textContent = await toasts.allTextContents();
    const hasError = textContent.some(t => t.includes('Camera could not start'));
    expect(hasError).toBe(false);

    await page.waitForTimeout(5000);

    // Action 4: Turn off camera
    await camOffBtn.click();
    await expect(camOnBtn).toBeVisible({ timeout: 5000 });

    // Action 5: Wait 3 seconds
    await page.waitForTimeout(3000);

    // Action 6: Turn it on again for 5 seconds
    await camOnBtn.click();
    await expect(camOffBtn).toBeVisible({ timeout: 10000 });
    
    // Final check for the error toast
    const finalToasts = page.locator('ol[data-sonner-toaster] li');
    const finalTextContent = await finalToasts.allTextContents();
    const hasFinalError = finalTextContent.some(t => t.includes('Camera could not start'));
    expect(hasFinalError).toBe(false);

    await page.waitForTimeout(5000);
  });

  test('Audio race condition - Two muted users should not leak media', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // User 1 joins Muted
    await joinMeeting(page1, 'Muted User 1', false, false);
    
    // User 2 joins Muted
    await joinMeeting(page2, 'Muted User 2', false, false);

    // Verify both pages have the "Unmute" button visible (they are muted)
    await expect(page1.locator('button[title="Unmute"]')).toBeVisible();
    await expect(page2.locator('button[title="Unmute"]')).toBeVisible();

    // Wait for peer connections to establish completely
    await page1.waitForTimeout(5000);

    // Evaluate on Page 1: Ensure User 1 is not receiving any audio tracks from User 2
    // We can do this by checking the document for any active <audio> elements connected to the other peer
    const audioReceiving1 = await page1.evaluate(() => {
      const audios = Array.from(document.querySelectorAll('audio'));
      let receiving = false;
      for (const a of audios) {
        if (a.srcObject) {
          const stream = a.srcObject as MediaStream;
          const tracks = stream.getAudioTracks();
          for (const track of tracks) {
            // A remote track is unmuted if its enabled is true and muted is false
            if (track.enabled && !track.muted && track.readyState === 'live') {
              receiving = true;
            }
          }
        }
      }
      return receiving;
    });

    const audioReceiving2 = await page2.evaluate(() => {
      const audios = Array.from(document.querySelectorAll('audio'));
      let receiving = false;
      for (const a of audios) {
        if (a.srcObject) {
          const stream = a.srcObject as MediaStream;
          const tracks = stream.getAudioTracks();
          for (const track of tracks) {
            if (track.enabled && !track.muted && track.readyState === 'live') {
              receiving = true;
            }
          }
        }
      }
      return receiving;
    });

    // Neither should be receiving active audio media (since they joined muted)
    // Note: Due to WebRTC internals, the tracks might exist but be 'muted' on the remote side if the sender paused their producer
    // So if the fix is correct, Mediasoup's producer is paused, meaning the consumer track receives nothing and is locally muted
    expect(audioReceiving1).toBe(false);
    expect(audioReceiving2).toBe(false);

    await context1.close();
    await context2.close();
  });
});
