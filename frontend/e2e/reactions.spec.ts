import { test, expect } from '@playwright/test';

test.describe('Emoji Reactions', () => {
  test('should render the reaction picker, display floating reactions, and animate upwards', async ({ page }) => {
    // Navigate to a test room
    await page.goto('/room/test-reaction-room');

    // Wait for the room to load and the reactions button to be visible
    const reactionsButton = page.locator('button:has-text("Reactions")');
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
