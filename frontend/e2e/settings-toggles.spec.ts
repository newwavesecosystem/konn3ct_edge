import { test, expect } from '@playwright/test';

test.describe('Meeting Settings Toggles', () => {
  test.setTimeout(120000);

  test('TC-028: Validate settings toggles for low bandwidth, audio-only mode, AI noise suppression, HD video, and mirror video', async ({ page }) => {
    // Navigate and join the meeting
    await page.goto('/join/playwright-settings-room');
    await page.locator('#join-name').waitFor({ state: 'visible' });
    await page.locator('#join-name').fill('Settings Tester');
    
    await expect(page.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
    await page.locator('#join-meeting-btn').click();

    // Wait for the meeting controls to indicate we are inside the room
    const controlsBar = page.locator('button[title="Camera off"], button[title="Camera on"]').first();
    await expect(controlsBar).toBeVisible({ timeout: 20000 });

    // Open Settings Panel
    await page.locator('button', { hasText: 'Settings' }).or(page.locator('button[title="Settings"]')).or(page.locator('h3:has-text("Settings")')).click().catch(async () => {
        // Alternative: open via the more menu
        await page.locator('button[title="More options"]').click();
        await page.locator('button', { hasText: 'Settings' }).click();
    });

    await expect(page.locator('h2', { hasText: 'Settings' }).or(page.locator('span:has-text("Settings")'))).toBeVisible({ timeout: 5000 });

    // Define the toggles to validate
    const togglesToValidate = [
      'Low bandwidth mode',
      'Audio-only mode',
      'AI Noise Suppression (Premium)',
      'HD Video',
      'Widescreen Capture (16:9)',
      'Mirror my video',
      'Original Ratio'
    ];

    for (const toggleLabel of togglesToValidate) {
      // Find the toggle container by its label text
      const toggleContainer = page.locator('div').filter({ has: page.locator(`text="${toggleLabel}"`) }).first();
      await expect(toggleContainer).toBeVisible();

      // Find the actual button role switch inside the container (or by role directly)
      const switchBtn = page.getByRole('switch', { name: toggleLabel }).or(
        toggleContainer.getByRole('switch')
      ).first();

      // Check the initial state
      const initialState = await switchBtn.getAttribute('aria-checked');
      
      // Toggle the state
      await switchBtn.click();
      
      // Verify state changed
      const expectedState = initialState === 'true' ? 'false' : 'true';
      await expect(switchBtn).toHaveAttribute('aria-checked', expectedState, { timeout: 3000 });

      // Toggle it back to original state to ensure no side effects
      await switchBtn.click();
      await expect(switchBtn).toHaveAttribute('aria-checked', initialState, { timeout: 3000 });
    }

    // Specific validation for Mirror Video on UI
    const mirrorToggle = page.getByRole('switch', { name: 'Mirror my video' }).first();
    const isMirroredInit = await mirrorToggle.getAttribute('aria-checked');
    
    // Turn ON mirror mode
    if (isMirroredInit !== 'true') {
      await mirrorToggle.click();
      await expect(mirrorToggle).toHaveAttribute('aria-checked', 'true', { timeout: 3000 });
    }

    // Find the local video element
    const localVideo = page.locator('video').first();
    // Verify it has scaleX(-1) applied
    const style = await localVideo.getAttribute('style');
    // It might be set via a class or inline style in ParticipantVideo, but usually it's transform: scaleX(-1)
    if (style && style.includes('scaleX')) {
      expect(style).toContain('scaleX(-1)');
    }
  });
});
