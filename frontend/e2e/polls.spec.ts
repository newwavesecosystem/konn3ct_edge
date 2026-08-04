import { test, expect } from '@playwright/test';

test.describe('Polls', () => {
  test.setTimeout(120000);

  test('TC-010: Validate poll percentage/result calculation accuracy', async ({ browser }) => {
    // 1. Host creates poll with multiple options.
    // 2. Participant A votes.
    // 3. Participant B votes.
    // 4. Participant C votes.
    // 5. Compare displayed vote count and percentage across all participant screens.
    
    const contextOptions = { baseURL: 'http://localhost:3001' };
    const hostContext = await browser.newContext(contextOptions);
    const partAContext = await browser.newContext(contextOptions);
    const partBContext = await browser.newContext(contextOptions);
    const partCContext = await browser.newContext(contextOptions);

    const hostPage = await hostContext.newPage();
    const pageA = await partAContext.newPage();
    const pageB = await partBContext.newPage();
    const pageC = await partCContext.newPage();

    const roomSlug = 'playwright-polls-room';

    // Mock the /api/prejoin endpoint for the host to force the 'host' role in the JWT sessionToken
    await hostPage.route('**/api/prejoin', async route => {
      if (route.request().method() !== 'POST') {
        return route.continue();
      }
      
      // Fetch the real response first to get the correct roomId
      const response = await route.fetch();
      const json = await response.json();
      const realJwt = json.sessionToken;
      
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(realJwt);
      delete decoded.exp;
      delete decoded.iat;
      
      const sessionData = {
        ...decoded,
        userId: 'playwright-bot-host',
        name: 'Poll Host',
        email: 'playwright-bot@konn3ct.test',
        role: 'host',
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
    
    const uniqueId = Date.now();
    const pollQuestion = `What is your favorite color? ${uniqueId}`;
    const optRed = `Red ${uniqueId}`;
    const optBlue = `Blue ${uniqueId}`;
    const optGreen = `Green ${uniqueId}`;

    // Host fills in poll
    await hostPage.locator('input[placeholder="Ask something..."]').fill(pollQuestion);
    await hostPage.locator('input[placeholder="Option 1"]').fill(optRed);
    await hostPage.locator('input[placeholder="Option 2"]').fill(optBlue);
    
    // Add third option
    await hostPage.locator('button:has-text("+ Add option")').first().click();
    await hostPage.locator('input[placeholder="Option 3"]').fill(optGreen);
    
    // Submit
    await hostPage.locator('button:has-text("Post Poll")').first().click();

    // The poll should appear in the list. Wait for it on Host page.
    await expect(hostPage.locator(`text=${pollQuestion}`).first()).toBeVisible();

    // Helper for participants to open polls panel and vote
    const openPollsAndVote = async (page: any, optionName: string) => {
      await page.locator('button[title="More"]').first().click();
      await page.locator('button:has-text("Polls")').first().click();
      // Wait for the poll to be visible
      await expect(page.locator(`text=${pollQuestion}`).first()).toBeVisible({ timeout: 10000 });
      
      // Use click with force to bypass stability checks (which can fail if DOM is animating/updating)
      await page.locator(`button:has-text("${optionName}")`).first().click({ force: true });
      await page.waitForTimeout(500);
    };

    // A votes Blue
    await openPollsAndVote(pageA, optBlue);
    
    // B votes Red
    await openPollsAndVote(pageB, optRed);

    // C votes Blue
    await openPollsAndVote(pageC, optBlue);

    // Now, Host ends the poll
    await hostPage.locator('button:has-text("End Poll")').first().click();
    
    // Verify results on Host page

    const validatePollResults = async (page: any) => {
      // Ensure the poll shows 3 votes total
      
      await expect(page.locator('button', { hasText: optRed }).first()).toContainText('33% (1)', { timeout: 10000 });
      await expect(page.locator('button', { hasText: optBlue }).first()).toContainText('67% (2)', { timeout: 10000 });
      await expect(page.locator('button', { hasText: optGreen }).first()).toContainText('0% (0)', { timeout: 10000 });
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
