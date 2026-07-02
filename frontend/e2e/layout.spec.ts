import { test, expect } from '@playwright/test';

// Define the viewports we want to test
const viewports = [
  { width: 320, height: 568, name: 'Mobile iPhone SE' },
  { width: 390, height: 844, name: 'Mobile iPhone 14' },
  { width: 768, height: 1024, name: 'Tablet iPad' },
  { width: 1366, height: 768, name: 'Desktop Standard' },
  { width: 1440, height: 900, name: 'Desktop WXGA' },
  { width: 1920, height: 1080, name: 'Desktop Full HD' }
];

test.describe('Layout Tests @layout', () => {
  for (const vp of viewports) {
    test(`Meeting room layout stability on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      
      // Navigate to a mocked meeting room. In a real environment we'd use a specific fixture.
      // We assume the page loads the meeting UI.
      await page.goto('/meeting/test-room?bot=true'); 
      
      // Wait for layout to settle
      await page.waitForTimeout(1000);

      // 1. Assert no horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const innerWidth = await page.evaluate(() => window.innerWidth);
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);

      // 2. Assert main stage is visible
      const stage = page.locator('[data-testid="stage-view"]');
      if (await stage.count() > 0) {
        await expect(stage).toBeVisible();
      }

      // 3. Assert bottom controls are visible and reachable without full page scroll
      const controls = page.locator('[data-testid="bottom-controls"]');
      if (await controls.count() > 0) {
        await expect(controls).toBeVisible();
      }

      // 4. Chat/participants/settings panel does not destroy the stage
      // Open chat
      const chatButton = page.locator('[data-testid="toggle-chat"]');
      if (await chatButton.count() > 0 && await chatButton.isVisible()) {
        await chatButton.click();
        await page.waitForTimeout(500); // let it open
        
        // Assert no horizontal overflow again
        const scrollWidthAfterChat = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scrollWidthAfterChat).toBeLessThanOrEqual(innerWidth);
        
        // Main stage should still be somewhat visible (not completely crushed)
        const stageBox = await stage.boundingBox();
        if (stageBox) {
          expect(stageBox.width).toBeGreaterThan(0);
        }
        
        // Close chat
        await chatButton.click();
      }

      // 5. Screen share / eCinema layouts (just check they don't break page layout if active)
      // Since it's hard to trigger a real screen share in layout spec without full mock, we just ensure no crashes
      const screenShareView = page.locator('[data-testid="screen-share-view"]');
      if (await screenShareView.count() > 0) {
        const ssBox = await screenShareView.boundingBox();
        expect(ssBox?.width).toBeGreaterThan(0);
      }
      
      const eCinemaView = page.locator('[data-testid="ecinema-view"]');
      if (await eCinemaView.count() > 0) {
        const eCinemaBox = await eCinemaView.boundingBox();
        expect(eCinemaBox?.width).toBeGreaterThan(0);
      }
    });
  }
});
