import { test, expect } from '@playwright/test';

test.describe('Virtual Background', () => {
  test.setTimeout(120000);

  test('TC-027: Validate virtual background applies without page refresh', async ({ page }) => {
    // 1. Listen for unhandled exceptions in the page to ensure the `drawImage` bug is fixed
    const errors: string[] = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    // We mock the camera stream to prevent relying on real hardware
    await page.addInitScript(() => {
      // Mock navigator.mediaDevices.getUserMedia
      const mockStream = new MediaStream();
      // Add a dummy video track (if possible) or just let Playwright use its fake device
      // Playwright's --use-fake-ui-for-media-stream handles this automatically.
    });

    await page.goto('/join/playwright-vb-room');
    await page.locator('#join-name').waitFor({ state: 'visible' });
    await page.locator('#join-name').fill('VB Tester');
    
    await expect(page.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
    await page.locator('#join-meeting-btn').click();

    // 2. Wait for meeting controls and verify we are in the room
    const controlsBar = page.locator('button[title="Camera off"], button[title="Camera on"]').first();
    await expect(controlsBar).toBeVisible({ timeout: 20000 });

    // Turn on camera if it's currently off
    const camOnBtn = page.locator('button[title="Camera on"]');
    if (await camOnBtn.isVisible()) {
      await camOnBtn.click();
    }
    
    // Wait for camera to be active
    await expect(page.locator('button[title="Camera off"]')).toBeVisible({ timeout: 10000 });

    // 3. Open Settings Panel
    await page.locator('button', { hasText: 'Settings' }).or(page.locator('button[title="Settings"]')).or(page.locator('h3:has-text("Settings")')).click().catch(async () => {
        // Alternative: open via the more menu
        await page.locator('button[title="More options"]').click();
        await page.locator('button', { hasText: 'Settings' }).click();
    });

    await expect(page.locator('h2', { hasText: 'Settings' }).or(page.locator('span:has-text("Settings")'))).toBeVisible({ timeout: 5000 });

    // 4. Select a virtual background image
    const vbImageBtn = page.locator('button[title="Virtual Background: modern_office"]').or(page.locator('button:has(img[src="/backgrounds/modern_office.png"])'));
    await expect(vbImageBtn).toBeVisible({ timeout: 5000 });
    
    await vbImageBtn.click();

    // Wait a couple seconds to allow model to load and processFrame loop to run
    await page.waitForTimeout(3000);

    // Assert that NO errors were thrown during the loop (specifically the drawImage error)
    const drawImageErrors = errors.filter(e => e.includes('drawImage') || e.includes('HTMLImageElement'));
    expect(drawImageErrors).toHaveLength(0);

    // 5. Select "None" to switch back to normal
    const vbNoneBtn = page.locator('button[title="Turn off virtual background"]');
    await expect(vbNoneBtn).toBeVisible();
    await vbNoneBtn.click();
    
    await page.waitForTimeout(1000);

    // No errors should have occurred
    expect(errors.filter(e => e.includes('drawImage') || e.includes('HTMLImageElement'))).toHaveLength(0);
    
    // Validate UI reflects the active state
    await expect(vbNoneBtn).toHaveClass(/ring-2 ring-brand-green/);
  });
});
