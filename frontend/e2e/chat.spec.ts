import { test, expect } from '@playwright/test';

test.describe('Chat UI Testing', () => {
  test('TC-CHAT-UI: Validate chat recipient select option styling for dark mode compatibility', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Join the meeting
    await page.goto('/join/playwright-health-room');
    await page.locator('#join-name').fill('Chat UI Tester');
    await page.locator('#join-meeting-btn').click();
    
    // Wait for the meeting controls to load (e.g. Mute button)
    await expect(page.locator('button[title="Mute"]')).toBeVisible({ timeout: 15000 });
    
    // Open Chat panel if it is not open
    const chatBtn = page.locator('button[title="Chat"]');
    if (await chatBtn.isVisible()) {
      await chatBtn.click();
    } else {
      await page.locator('button[title="More Options"]').first().click();
      await page.locator('button', { hasText: 'Chat' }).first().click();
    }
    
    // Wait for the recipient select dropdown to be visible
    const recipientSelect = page.locator('select').filter({ hasText: 'To: Everyone' });
    await expect(recipientSelect).toBeVisible({ timeout: 5000 });
    
    // Validate that the option elements have the explicit background color set to --mt-bg-control
    const optionElements = recipientSelect.locator('option');
    const count = await optionElements.count();
    
    expect(count).toBeGreaterThan(0);
    
    for (let i = 0; i < count; i++) {
      const bgStyle = await optionElements.nth(i).evaluate((el: HTMLOptionElement) => el.style.backgroundColor);
      // It should be explicitly set to the CSS variable
      expect(bgStyle).toBe('var(--mt-bg-control)');
    }
    
    await context.close();
  });
});
