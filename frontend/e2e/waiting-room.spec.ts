import { test, expect } from '@playwright/test';

test.describe('Waiting Room', () => {
  test('TC-002: Attendee sees waiting message before host admits them', async ({ page }) => {
    // 1. Attendee joins meeting link for a room with waiting room enabled
    await page.goto('/join/playwright-waiting-room');
    
    // Wait for the join button
    const joinBtn = page.locator('#join-meeting-btn');
    await expect(joinBtn).toBeVisible({ timeout: 15000 });

    // 2. Complete pre-room details
    const nameInput = page.locator('#join-name');
    await nameInput.fill('Waiting Attendee');
    
    const emailInput = page.locator('#join-email');
    if (await emailInput.isVisible()) {
      await emailInput.fill('waiting@example.com');
    }

    // 3. Submit join request
    await expect(joinBtn).toBeEnabled();
    await joinBtn.click();

    // 4. Observe page shown before host admits attendee
    // Wait for navigation to the meeting room URL
    await page.waitForURL(/\/meeting\/playwright-waiting-room/, { timeout: 15000 });
    
    // Verify we arrived at the correct URL
    await expect(page).toHaveURL(/\/meeting\/playwright-waiting-room/);

    // Validate that attendee sees waiting message
    await expect(page.getByText('Waiting for the host to let you in')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('You will join the meeting automatically once the host admits you.')).toBeVisible();
  });

  test('TC-021: Validate meeting info waiting-room status update', async ({ browser }) => {
    // 1. Open Meeting Info and check waiting room status.
    const contextOptions = { baseURL: 'http://localhost:3001' };
    const hostContext = await browser.newContext(contextOptions);
    const hostPage = await hostContext.newPage();
    const roomSlug = 'playwright-waiting-room';

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

    // Join Host
    await hostPage.goto(`/join/${roomSlug}`);
    await hostPage.locator('#join-name').pressSequentially('Host', { delay: 50 });
    await expect(hostPage.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
    await hostPage.locator('#join-meeting-btn').click();
    await expect(hostPage.locator('button[title="Camera on"], button[title="Camera off"], button[title="More"]').first()).toBeVisible({ timeout: 20000 });

    // Open Meeting Info
    await hostPage.locator('button[title="More"]').click();
    await hostPage.locator('button:has-text("Meeting Info")').click();
    
    // Check waiting room status (initially Enabled for this room)
    await expect(hostPage.locator('div:has-text("Waiting Room")').filter({ hasText: 'Enabled' }).first()).toBeVisible();

    // 2. Host disables waiting room (enables bypass).
    // 2. Host disables waiting room (enables bypass).
    
    // Open Security Panel
    await hostPage.locator('button[data-testid="panel-security"]').click();
    
    // Toggle bypass waiting room
    const bypassToggle = hostPage.locator('label:has-text("Bypass Waiting Room")').first();
    await bypassToggle.evaluate(node => (node as HTMLElement).click());
    
    // 3. Recheck Meeting Info.
    await hostPage.locator('button[title="More"]').click();
    await hostPage.locator('button:has-text("Meeting Info")').click();
    
    // Now it should say Disabled
    await expect(hostPage.locator('div:has-text("Waiting Room")').filter({ hasText: 'Disabled' }).first()).toBeVisible();
    
    // 4. Host enables waiting room (disables bypass).
    await hostPage.locator('button[data-testid="panel-security"]').click();
    
    await bypassToggle.evaluate(node => (node as HTMLElement).click());
    
    // 5. Recheck Meeting Info.
    await hostPage.locator('button[title="More"]').click();
    await hostPage.locator('button:has-text("Meeting Info")').click();
    
    // Now it should say Enabled again
    await expect(hostPage.locator('div:has-text("Waiting Room")').filter({ hasText: 'Enabled' }).first()).toBeVisible();
    
    await hostContext.close();
  });
});
