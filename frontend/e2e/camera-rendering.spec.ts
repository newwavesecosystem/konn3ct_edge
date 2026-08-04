import { test, expect } from '@playwright/test';

test.describe('Camera Rendering', () => {
  // Use a longer timeout for stability tests
  test.setTimeout(120000);

  test('TC-005: Validate participant camera rendering and placeholder behaviour during meeting', async ({ browser }) => {
    // 1. Join meeting from mobile (Context 1) and PC (Context 2)
    // Mobile Context (Participant A)
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 }, // iPhone 12 Pro dimensions
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
    });
    
    // PC Context (Participant B)
    const pcContext = await browser.newContext();

    const mobilePage = await mobileContext.newPage();
    const pcPage = await pcContext.newPage();

    // Participant B (PC) joins first
    await pcPage.goto('/join/playwright-health-room');
    await pcPage.locator('#join-name').pressSequentially('PC Attendee', { delay: 50 });
    await expect(pcPage.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
    await pcPage.locator('#join-meeting-btn').click();

    // Wait for PC to enter
    await expect(pcPage.locator('button[title="Camera on"], button[title="Camera off"]')).toBeVisible({ timeout: 20000 });

    // Participant A (Mobile) joins
    await mobilePage.goto('/join/playwright-health-room');
    await mobilePage.locator('#join-name').pressSequentially('Mobile Attendee', { delay: 50 });
    await expect(mobilePage.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
    await mobilePage.locator('#join-meeting-btn').click();

    // Wait for Mobile to enter
    const mobileCameraBtn = mobilePage.locator('button[title="Camera on"], button[title="Camera off"]');
    await expect(mobileCameraBtn).toBeVisible({ timeout: 20000 });

    // Helper to evaluate camera visibility
    const checkCameraRender = async (page: any) => {
      return await page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video'));
        // Find if there are active video elements rendering properly
        const activeVideos = videos.filter(v => v.srcObject && !v.paused && v.readyState >= 2);
        return activeVideos.length;
      });
    };

    // 1. Participant A turns camera on.
    if (await mobilePage.locator('button[title="Camera on"]').isVisible()) {
      await mobilePage.locator('button[title="Camera on"]').click({ force: true });
    }
    
    // Wait a bit for track to be published and rendered
    await mobilePage.waitForTimeout(5000);

    // 2. Participant B observes Participant A video tile.
    const pcActiveVideosCount = await checkCameraRender(pcPage);
    const pcSeesVideo = pcActiveVideosCount >= 1;
    
    // 3. Participant A observes own preview.
    const mobileActiveVideosCount = await checkCameraRender(mobilePage);
    const mobileSeesOwnVideo = mobileActiveVideosCount >= 1;

    let isReliable = pcSeesVideo && mobileSeesOwnVideo;
    let failureReason = '';

    if (!mobileSeesOwnVideo) {
      failureReason += 'Participant A cannot see their own video. ';
    }
    if (!pcSeesVideo) {
      failureReason += 'Participant B cannot see Participant A video. ';
    }

    // 4. Repeat camera off/on.
    // Turn off
    if (await mobilePage.locator('button[title="Camera off"]').isVisible()) {
      await mobilePage.locator('button[title="Camera off"]').click({ force: true });
      await mobilePage.waitForTimeout(3000);
    }
    
    // Turn on
    if (await mobilePage.locator('button[title="Camera on"]').isVisible()) {
      await mobilePage.locator('button[title="Camera on"]').click({ force: true });
      await mobilePage.waitForTimeout(5000);
    }

    // 5. Observe if tile shows video
    const pcSeesVideoAgain = (await checkCameraRender(pcPage)) >= 1;
    const mobileSeesOwnVideoAgain = (await checkCameraRender(mobilePage)) >= 1;

    if (!mobileSeesOwnVideoAgain || !pcSeesVideoAgain) {
      isReliable = false;
      failureReason += 'Camera failed to render properly after toggling off/on. ';
    }

    // We expect the camera rendering to be reliable without green placeholder or black screen (represented by no playing video)
    expect(isReliable, failureReason).toBe(true);

    await mobileContext.close();
    await pcContext.close();
  });
});
