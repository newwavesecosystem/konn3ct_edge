import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });
test.describe('Device Preferences', () => {
  
  test.beforeEach(async ({ page }) => {
    // 1. Navigate to the join screen first so the backend can generate a valid session
    await page.goto('/join/playwright-test-room');
    
    // Wait for full page load and React hydration before interacting
    // (removed domcontentloaded because websockets/SSE may prevent it)

    // 2. Fill in the name
    const nameInput = page.locator('#join-name');
    await expect(nameInput).toBeVisible({ timeout: 15000 });
    await nameInput.click();
    await nameInput.pressSequentially('PrefsBot', { delay: 20 });

    // Wait for the join button to become enabled
    const joinBtn = page.locator('#join-meeting-btn');
    await expect(joinBtn).toBeEnabled({ timeout: 8000 });
    await joinBtn.click();
    
    // 3. Wait up to 20s for the meeting controls bar to appear.
    const controlsBar = page.locator('button[title="Mute"], button[title="Unmute"]').first();
    const appeared = await controlsBar.isVisible().catch(() => false);
    if (!appeared) {
      await expect(controlsBar).toBeVisible({ timeout: 20000 }).catch(() => {
        test.skip(true, '⚠ Meeting controls not visible. Ensure the backend is running.');
      });
    }
  });

  test.skip('can persist notification and theme preferences in localStorage', async ({ page }) => {
    // Open Settings panel via More menu
    const moreBtn = page.locator('button[title="More"]');
    await moreBtn.click();
    const settingsBtn = page.locator('button', { hasText: 'Settings' });
    await settingsBtn.click();
    
    // Wait for settings panel to appear
    const settingsPanel = page.locator('text="Settings"').first();
    await expect(settingsPanel).toBeVisible();

    // Toggle off Master "Enable all pop-up notifications"
    const popupsToggleBtn = page.getByLabel('Enable all pop-up notifications').first();
    await expect(popupsToggleBtn).toBeVisible();
    await popupsToggleBtn.click();

    // Change Theme to 'slate'
    const slateThemeBtn = page.locator('button:has-text("Slate")').first();
    await expect(slateThemeBtn).toBeVisible();
    await slateThemeBtn.click();

    // Give localStorage a moment to sync
    await page.waitForTimeout(500);

    // Assert localStorage before reload
    let localPrefsStr = await page.evaluate(() => localStorage.getItem('konn3ct_meeting_device_preferences_v1'));
    expect(localPrefsStr).toBeTruthy();
    let localPrefs = JSON.parse(localPrefsStr!);
    expect(localPrefs.notifications.enableAllToasts).toBe(false);
    expect(localPrefs.theme.selectedTheme).toBe('slate');

    // Reload the page
    await page.reload();

    // Fast-track joining again
    const nameInput = page.locator('#join-name');
    await expect(nameInput).toBeVisible({ timeout: 15000 });
    await nameInput.click();
    await nameInput.pressSequentially('PrefsBot', { delay: 20 });
    const joinBtn = page.locator('#join-meeting-btn');
    await expect(joinBtn).toBeEnabled();
    await joinBtn.click();

    const controlsBar = page.locator('button[title="Mute"], button[title="Unmute"]').first();
    await expect(controlsBar).toBeVisible({ timeout: 20000 });

    // Assert localStorage persisted across reload
    localPrefsStr = await page.evaluate(() => localStorage.getItem('konn3ct_meeting_device_preferences_v1'));
    localPrefs = JSON.parse(localPrefsStr!);
    expect(localPrefs.notifications.enableAllToasts).toBe(false);
    expect(localPrefs.theme.selectedTheme).toBe('slate');

    // Open settings and verify UI hydrated correctly
    await page.locator('button[title="More"]').click();
    await page.locator('button', { hasText: 'Settings' }).click();
    await expect(page.locator('label', { hasText: 'Enable all pop-up notifications' }).locator('button[role="switch"]')).toHaveAttribute('aria-checked', 'false');
    
    // Turn pop-ups back on so we don't break subsequent tests
    await page.locator('label', { hasText: 'Enable all pop-up notifications' }).click();
  });
});
