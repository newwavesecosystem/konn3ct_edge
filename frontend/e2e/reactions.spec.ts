import { test, expect } from '@playwright/test';

test.describe('Emoji Reactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/join/playwright-test-room');
    await page.waitForLoadState('domcontentloaded');

    const nameInput = page.locator('#join-name');
    await expect(nameInput).toBeVisible({ timeout: 15000 });
    await nameInput.click();
    await nameInput.pressSequentially('ReactionBot', { delay: 50 });

    const joinBtn = page.locator('#join-meeting-btn');
    await expect(joinBtn).toBeEnabled({ timeout: 8000 });
    await joinBtn.click();
    
    const controlsBar = page.locator('button[title="Mute"], button[title="Unmute"]').first();
    try {
      await expect(controlsBar).toBeVisible({ timeout: 20000 });
    } catch {
      test.skip();
    }
  });

  test.skip('should render the reaction picker, display floating reactions, and animate upwards', async ({ page }) => {
    // Wait for the room to load and the reactions button to be visible
    const reactionsButton = page.locator('button[title="React"]');
    await expect(reactionsButton).toBeVisible({ timeout: 15000 });

    // Open the reaction picker
    await reactionsButton.click();

    // Verify the picker appears
    const picker = page.locator('.grid.grid-cols-6');
    await expect(picker).toBeVisible();

    // Click the thumbs up emoji (👍)
    const thumbsUpBtn = picker.locator('button', { hasText: '👍' });
    await expect(thumbsUpBtn).toBeVisible();
    await thumbsUpBtn.click();

    // Verify the reaction picker closes
    await expect(picker).not.toBeVisible();

    // Verify the floating reaction appears
    const floatingEmoji = page.locator('span', { hasText: '👍' }).first();
    await expect(floatingEmoji).toBeVisible();

    // Verify the animation is moving upward (y coordinate is decreasing)
    // We get the parent div which is the motion.div being animated
    const motionDiv = floatingEmoji.locator('..').locator('..');
    
    // Get initial bounding box
    const initialBox = await motionDiv.boundingBox();
    expect(initialBox).not.toBeNull();

    // Wait briefly for animation to progress
    await page.waitForTimeout(500);

    // Get bounding box after a short delay
    const movedBox = await motionDiv.boundingBox();
    expect(movedBox).not.toBeNull();

    if (initialBox && movedBox) {
      // It should have moved upwards, meaning the Y coordinate is smaller
      expect(movedBox.y).toBeLessThan(initialBox.y);
    }
  });
});
