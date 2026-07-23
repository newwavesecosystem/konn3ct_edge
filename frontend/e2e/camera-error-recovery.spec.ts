import { test, expect } from '@playwright/test';

test.describe('Camera Error Recovery', () => {
  // Use a longer timeout for stability/recovery tests
  test.setTimeout(90000);

  test('TC-023: Validate camera connection failure and retry error handling', async ({ browser }) => {
    // 1. Join meeting (Participant turns camera ON automatically depending on URL/UI, or we manually click)
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/join/playwright-health-room');
    await page.locator('#join-name').fill('Camera Tester');
    await expect(page.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
    await page.locator('#join-meeting-btn').click();

    // Wait to join
    const cameraBtn = page.locator('button[title="Camera on"], button[title="Camera off"]');
    await expect(cameraBtn).toBeVisible({ timeout: 15000 });

    // Inject a mock to force the camera video to stall
    // This overrides HTMLVideoElement.prototype.currentTime to always return 0, 
    // simulating a failure in video rendering or connection data flow
    await page.evaluate(() => {
      window['__toggleCameraStall'] = (stalled: boolean) => {
        if (stalled) {
          if (!window['__originalCurrentTimeGetter']) {
            window['__originalCurrentTimeGetter'] = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'currentTime')?.get;
          }
          Object.defineProperty(HTMLVideoElement.prototype, 'currentTime', {
            get: function() { return 1.5; },
            configurable: true
          });
        } else {
          if (window['__originalCurrentTimeGetter']) {
            Object.defineProperty(HTMLVideoElement.prototype, 'currentTime', {
              get: window['__originalCurrentTimeGetter'],
              configurable: true
            });
          }
        }
      };
      window['__toggleCameraStall'](true); // Start stalled
    });

    // 1. Participant turns camera ON.
    if (await page.locator('button[title="Camera on"]').isVisible()) {
      await page.locator('button[title="Camera on"]').click();
    }

    // 2. Observe if camera video appears.
    // 3. If video fails, observe error message.
    const errorText = page.locator('text=Your video feed seems stuck. Give it a moment to catch up!');
    
    // 4. Wait for retry behaviour. 
    // The useVideoHealth hook waits 5s for readyState stalls or currentTime stalls, 
    // then triggers recovery, then if it times out it marks it as "stalled".
    await expect(errorText).toBeVisible({ timeout: 25000 });

    // 5. Confirm whether camera eventually connects or remains failed.
    // We now restore the camera to "recover" it
    await page.evaluate(() => {
      window['__toggleCameraStall'](false);
    });

    // Verify it recovers and the error disappears (it should go back to healthy)
    await expect(errorText).toBeHidden({ timeout: 25000 });
  });
});
