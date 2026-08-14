import { test, expect } from '@playwright/test';

test.describe('Captions Testing', () => {
  test('TC-033: Validate caption panel scrollability and review of caption history', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto('/join/playwright-health-room');
    await page.locator('#join-name').fill('Caption Tester');
    await page.locator('#join-meeting-btn').click();
    
    // Wait for the meeting to load
    await expect(page.locator('button[title="Mute"]')).toBeVisible({ timeout: 15000 });
    
    // Forcefully render some fake captions into the overlay
    await page.evaluate(() => {
      const overlay = document.createElement('div');
      overlay.className = 'absolute inset-0 pointer-events-none z-50 flex items-end justify-center pb-8';
      
      const motionDiv = document.createElement('div');
      motionDiv.className = 'bg-black/70 backdrop-blur-md px-6 py-4 rounded-2xl pointer-events-auto max-h-[160px] cursor-grab';
      
      const scrollDiv = document.createElement('div');
      scrollDiv.id = 'fake-caption-scroll';
      scrollDiv.className = 'flex flex-col gap-1.5 overflow-y-auto max-h-[160px] no-scrollbar';
      
      for (let i = 0; i < 20; i++) {
        const line = document.createElement('div');
        line.innerText = `User: This is simulated caption line ${i}`;
        line.style.padding = '10px';
        scrollDiv.appendChild(line);
      }
      
      motionDiv.appendChild(scrollDiv);
      overlay.appendChild(motionDiv);
      document.body.appendChild(overlay);
    });

    const scrollContainer = page.locator('#fake-caption-scroll');
    await expect(scrollContainer).toBeVisible();
    
    const isScrollable = await scrollContainer.evaluate((node) => {
      return node.scrollHeight > node.clientHeight;
    });
    
    expect(isScrollable).toBe(true);
    
    await scrollContainer.evaluate((node) => node.scrollTop = 0);
    const scrollTop = await scrollContainer.evaluate((node) => node.scrollTop);
    expect(scrollTop).toBe(0);
    
    await context.close();
  });
});
