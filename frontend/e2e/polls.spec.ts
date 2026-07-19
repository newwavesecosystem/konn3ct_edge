import { test, expect } from '@playwright/test';

test.describe('Polls', () => {
  test.setTimeout(120000);

  test('TC-010: Validate poll percentage/result calculation accuracy', async ({ browser }) => {
    // 1. Host creates poll with multiple options.
    // 2. Participant A votes.
    // 3. Participant B votes.
    // 4. Participant C votes.
    // 5. Compare displayed vote count and percentage across all participant screens.
    
    const hostContext = await browser.newContext();
    const partAContext = await browser.newContext();
    const partBContext = await browser.newContext();
    const partCContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const pageA = await partAContext.newPage();
    const pageB = await partBContext.newPage();
    const pageC = await partCContext.newPage();

    const roomSlug = 'playwright-test-room';

    // Mock the /api/prejoin endpoint for the host to force the 'host' role in the JWT sessionToken
    await hostPage.route('**/api/prejoin', async route => {
      if (route.request().method() !== 'POST') {
        return route.continue();
      }
      const jwt = require('jsonwebtoken');
      const sessionData = {
        userId: 'playwright-bot-host',
        roomId: roomSlug,
        name: 'Poll Host',
        email: 'playwright-bot@konn3ct.test',
        role: 'host',
        isMobile: false,
        camera: false,
        mic: false,
      };
      const sessionToken = jwt.sign(sessionData, process.env.JWT_SECRET || 'super-secret-development-key-change-in-production', { expiresIn: "2h" });
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessionToken })
      });
    });

    const joinRoom = async (page: any, name: string) => {
      const url = `/join/${roomSlug}`;
      await page.goto(url);
      await page.locator('#join-name').pressSequentially(name, { delay: 50 });
      await expect(page.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
      await page.locator('#join-meeting-btn').click();
      await expect(page.locator('button[title="Camera on"], button[title="Camera off"], button[title="More"]').first()).toBeVisible({ timeout: 20000 });
    };

    // Join Host
    await joinRoom(hostPage, 'Poll Host');
    
    // Join Participants
    await joinRoom(pageA, 'Participant A');
    await joinRoom(pageB, 'Participant B');
    await joinRoom(pageC, 'Participant C');

    // Host opens Polls panel
    await hostPage.locator('button[title="More"]').click();
    await hostPage.locator('button:has-text("Polls")').click();
    
    // Host clicks Create Poll
    await hostPage.locator('button:has-text("+ Create Poll")').first().click();
    
    // Host fills in poll
    await hostPage.locator('input[placeholder="Ask something..."]').fill('What is your favorite color?');
    await hostPage.locator('input[placeholder="Option 1"]').fill('Red');
    await hostPage.locator('input[placeholder="Option 2"]').fill('Blue');
    
    // Add third option
    await hostPage.locator('button:has-text("+ Add option")').first().click();
    await hostPage.locator('input[placeholder="Option 3"]').fill('Green');
    
    // Submit
    await hostPage.locator('button:has-text("Post Poll")').first().click();

    // The poll should appear in the list. Wait for it on Host page.
    await expect(hostPage.locator('text=What is your favorite color?').first()).toBeVisible();

    // Helper for participants to open polls panel and vote
    const openPollsAndVote = async (page: any, optionName: string) => {
      await page.locator('button[title="More"]').first().click();
      await page.locator('button:has-text("Polls")').first().click();
      await expect(page.locator('text=What is your favorite color?').first()).toBeVisible({ timeout: 10000 });
      // Wait for the poll to be visible
      await expect(page.locator('text=What is your favorite color?').first()).toBeVisible({ timeout: 10000 });
      await page.screenshot({ path: `participant-poll-${optionName}.png` });
      // Use dispatchEvent to click instantly without waiting for DOM stability
      await page.locator(`button:has-text("${optionName}")`).first().dispatchEvent('click');
    };

    // A votes Blue
    await openPollsAndVote(pageA, 'Blue');
    
    // B votes Red
    await openPollsAndVote(pageB, 'Red');

    // C votes Blue
    await openPollsAndVote(pageC, 'Blue');

    // Now, Host ends the poll
    await hostPage.locator('button:has-text("End Poll")').first().click();
    
    // Verify results on Host page
    // Blue should have 2 votes (67%)
    const blueOption = hostPage.locator('.poll-option-result:has-text("Blue")').first(); 
    // Wait for the percentage or vote count text
    await expect(hostPage.locator('text=2 votes (67%)').first()).toBeVisible({ timeout: 10000 });
    await expect(hostPage.locator('text=1 vote (33%)').first()).toBeVisible();

    const validatePollResults = async (page: any) => {
      // Ensure the poll shows 3 votes total
      
      await expect(page.locator('button', { hasText: 'Red' })).toContainText('33% (1)');
      await expect(page.locator('button', { hasText: 'Blue' })).toContainText('67% (2)');
      await expect(page.locator('button', { hasText: 'Green' })).toContainText('0% (0)');
    };

    await validatePollResults(hostPage);
    await validatePollResults(pageA);
    await validatePollResults(pageB);
    await validatePollResults(pageC);

    await hostContext.close();
    await partAContext.close();
    await partBContext.close();
    await partCContext.close();
  });
});
