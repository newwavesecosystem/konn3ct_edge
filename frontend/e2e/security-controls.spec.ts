import { test, expect } from '@playwright/test';

test.describe('Security & Controls', () => {
  test.setTimeout(120000);

  test('TC-026: Validate meeting management controls for Mute All, Disable Mic, Lock Chat, Disable Camera, Bypass Waiting Room', async ({ browser }) => {
    const contextOptions = { baseURL: process.env.NEXT_PUBLIC_FRONTEND_DOMAIN ? `http://${process.env.NEXT_PUBLIC_FRONTEND_DOMAIN}` : 'http://localhost:3001' };
    const hostContext = await browser.newContext(contextOptions);
    const attendeeContext = await browser.newContext(contextOptions);

    const hostPage = await hostContext.newPage();
    const attendeePage = await attendeeContext.newPage();

    const roomSlug = 'playwright-security-room-' + Date.now();

    // 1. Host joins and is assigned 'host' role via mocked prejoin
    await hostPage.route('**/api/prejoin', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      
      const response = await route.fetch();
      const json = await response.json();
      const realJwt = json.sessionToken;
      
      if (!realJwt) return route.continue();

      // We use require('jsonwebtoken') which should be available since it's installed in the backend, but we're in frontend e2e.
      // E2E tests run in Node context, so require should work if we install jsonwebtoken or we can just bypass it.
      // Actually, a simpler way is just to click "Security" if we can make them host. If not, the prejoin mock is better.
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(realJwt);
      delete decoded.exp;
      delete decoded.iat;
      
      const sessionData = {
        ...decoded,
        userId: 'host-user',
        name: 'Security Host',
        role: 'host', // force host
      };
      
      const sessionToken = jwt.sign(sessionData, process.env.JWT_SECRET || 'super-secret-development-key-change-in-production', { expiresIn: "2h" });
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessionToken })
      });
    });

    await hostPage.goto(`/join/${roomSlug}`);
    await hostPage.locator('#join-name').waitFor({ state: 'visible' });
    await hostPage.locator('#join-name').fill('Security Host');
    await expect(hostPage.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
    await hostPage.locator('#join-meeting-btn').click();

    // Wait for Host to be fully in the room
    await expect(hostPage.locator('button[title="Mute"], button[title="Unmute"]').first()).toBeVisible({ timeout: 20000 });

    // 2. Attendee joins
    await attendeePage.goto(`/join/${roomSlug}`);
    await attendeePage.locator('#join-name').waitFor({ state: 'visible' });
    await attendeePage.locator('#join-name').fill('Target Attendee');
    await expect(attendeePage.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
    await attendeePage.locator('#join-meeting-btn').click();

    await expect(attendeePage.locator('button[title="Mute"], button[title="Unmute"]').first()).toBeVisible({ timeout: 20000 });

    // Verify Attendee can initially interact with controls
    await expect(attendeePage.locator('button[title="Mute"], button[title="Unmute"]').first()).not.toBeDisabled();
    await expect(attendeePage.locator('button[title="Camera on"], button[title="Camera off"]').first()).not.toBeDisabled();

    // 3. Host opens Security Panel
    const securityBtn = hostPage.locator('button', { hasText: 'Security & Controls' }).or(hostPage.locator('button[title="Security"]')).or(hostPage.locator('h3:has-text("Security")'));
    
    // Actually the panel button in MeetingControls is not easily selected by title="Security", let's check MeetingControls.tsx
    // The panel button has a tooltip, but it's an SVG. Wait, we can find the Shield icon.
    await hostPage.locator('button').filter({ has: hostPage.locator('svg.lucide-shield') }).click();
    await expect(hostPage.locator('h3', { hasText: 'Security & Controls' })).toBeVisible({ timeout: 5000 });

    // 4. Host uses Mute All ("Mute Attendees")
    await hostPage.locator('button', { hasText: 'Mute Attendees' }).click();

    // Wait for event to propagate
    await attendeePage.waitForTimeout(1000);

    // Attendee should be muted (verify icon is MicOff)
    await expect(attendeePage.locator('button[title="Unmute"]')).toBeVisible();

    // 5. Host disables attendee microphone (Lock Microphones)
    await hostPage.locator('label', { hasText: 'Lock Microphones' }).locator('input[type="checkbox"]').check();

    // Attendee's unmute button should now be disabled
    await expect(attendeePage.locator('button[title="Unmute"]')).toBeDisabled({ timeout: 5000 });

    // 6. Host locks chat
    await hostPage.locator('label', { hasText: 'Lock Chat' }).locator('input[type="checkbox"]').check();

    // Attendee chat input should be disabled and show "Chat locked by host"
    await attendeePage.locator('button').filter({ has: attendeePage.locator('svg.lucide-message-square') }).click(); // Open chat panel
    await expect(attendeePage.locator('textarea[placeholder="Chat locked by host"]')).toBeVisible({ timeout: 5000 });
    await expect(attendeePage.locator('textarea[placeholder="Chat locked by host"]')).toBeDisabled();

    // 7. Host disables attendee camera (Lock Cameras)
    await hostPage.locator('label', { hasText: 'Lock Cameras' }).locator('input[type="checkbox"]').check();

    // Attendee's camera button should now be disabled
    await expect(attendeePage.locator('button[title="Camera on"], button[title="Camera off"]').first()).toBeDisabled({ timeout: 5000 });

    // 8. Host tests bypass waiting room permission
    await hostPage.locator('label', { hasText: 'Bypass Waiting Room' }).locator('input[type="checkbox"]').check();
    await expect(hostPage.locator('label', { hasText: 'Bypass Waiting Room' }).locator('input[type="checkbox"]')).toBeChecked();

    // Validation complete! All permissions enforced.
  });
});
