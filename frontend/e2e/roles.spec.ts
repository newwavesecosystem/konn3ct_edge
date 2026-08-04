import { test, expect } from '@playwright/test';

test.describe('Co-Host Role Persistence', () => {
  test.setTimeout(120000);

  test('TC-022: Validate co-host role persistence after browser refresh', async ({ browser }) => {
    const contextOptions = { baseURL: 'http://localhost:3001' };
    const hostContext = await browser.newContext(contextOptions);
    const participantContext = await browser.newContext(contextOptions);

    const hostPage = await hostContext.newPage();
    const participantPage = await participantContext.newPage();

    const roomSlug = 'playwright-roles-room';

    // Mock the /api/prejoin endpoint for the host to force the 'host' role in the JWT sessionToken
    await hostPage.route('**/api/prejoin', async route => {
      if (route.request().method() !== 'POST') {
        return route.continue();
      }
      
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
        name: 'Host User',
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

    // 1. Host joins
    await hostPage.goto(`/join/${roomSlug}`);
    await hostPage.locator('#join-name').waitFor({ state: 'visible' });
    await hostPage.locator('#join-name').fill('Host User');
    await expect(hostPage.locator('#join-meeting-btn')).toBeEnabled();
    await hostPage.locator('#join-meeting-btn').click();
    await expect(hostPage.locator('button[title="People"]')).toBeVisible({ timeout: 15000 });

    // 2. Participant joins
    await participantPage.goto(`/join/${roomSlug}`);
    await participantPage.locator('#join-name').waitFor({ state: 'visible' });
    await participantPage.locator('#join-name').fill('Participant B');
    await expect(participantPage.locator('#join-meeting-btn')).toBeEnabled();
    await participantPage.locator('#join-meeting-btn').click();
    
    // Wait for Participant B to be fully joined
    await expect(participantPage.locator('button[title="People"]')).toBeVisible();

    // 3. Host makes Participant B a co-host
    await hostPage.locator('button[title="People"]').click();
    
    // Find Participant B in the People panel and click "Make Co-host"
    // The panel has "group" class on hover which shows the buttons.
    const participantRow = hostPage.locator('.group:has-text("Participant B")');
    await participantRow.hover();
    await participantRow.locator('button[title="Make Co-host"]').click();

    // 4. Confirm Participant B has co-host controls
    // A Co-host should see the Security panel or similar controls.
    // Let's check if the Co-host badge appears in their own view.
    // The "You" badge should now have "Co-host" label in their Participants panel
    await participantPage.locator('button[title="People"]').click();
    const ownRow = participantPage.locator('.group:has-text("Participant B")');
    await expect(ownRow.locator('span:has-text("Co-host")')).toBeVisible();

    // Wait a bit to ensure server processed it
    await participantPage.waitForTimeout(1000);

    // 5. Participant B refreshes browser
    await participantPage.reload();

    // After reload, wait to rejoin
    await expect(participantPage.locator('button[title="People"]')).toBeVisible({ timeout: 15000 });
    await participantPage.locator('button[title="People"]').click();

    // 6. Check Participant B role and controls from their own view
    const ownRowAfterRefresh = participantPage.locator('.group:has-text("Participant B")');
    await expect(ownRowAfterRefresh.locator('span:has-text("Co-host")')).toBeVisible();
  });
});
