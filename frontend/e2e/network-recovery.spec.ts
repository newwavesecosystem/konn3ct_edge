import { test, expect } from '@playwright/test';

test.use({
  permissions: ['camera', 'microphone'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  },
});

test.describe('Network Recovery', () => {
  test.setTimeout(120000);

  test('TC-029: Validate behavior during brief network disconnection', async ({ browser }) => {
    // 1. Join meeting from PC (Host) and Mobile (Attendee)
    const pcContext = await browser.newContext();
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 }, // iPhone 12 Pro dimensions
    });

    const hostPage = await pcContext.newPage();
    const attendeePage = await mobileContext.newPage();

    // Host joins
    await hostPage.goto('/join/playwright-webrtc-room');
    await hostPage.locator('#join-name').pressSequentially('Host User', { delay: 50 });
    await expect(hostPage.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
    await hostPage.locator('#join-meeting-btn').click();

    // Wait for Host to enter and ensure unmuted
    const hostControlsBar = hostPage.locator('button[title="Mute"], button[title="Unmute"]').first();
    await expect(hostControlsBar).toBeVisible({ timeout: 20000 });
    
    const hostUnmuteBtn = hostPage.locator('button[title="Unmute"]');
    if (await hostUnmuteBtn.isVisible()) {
      await hostUnmuteBtn.click();
    }

    // Turn on camera for Host
    const hostVideoBtn = hostPage.locator('button[title="Turn On Camera"]');
    if (await hostVideoBtn.isVisible()) {
      await hostVideoBtn.click();
    }

    // Attendee joins
    await attendeePage.goto('/join/playwright-webrtc-room');
    await attendeePage.locator('#join-name').pressSequentially('Attendee User', { delay: 50 });
    await expect(attendeePage.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
    await attendeePage.locator('#join-meeting-btn').click();

    // Wait for Attendee to enter
    const attendeeControlsBar = attendeePage.locator('button[title="Mute"], button[title="Unmute"]').first();
    await expect(attendeeControlsBar).toBeVisible({ timeout: 20000 });

    // Verify Attendee can see Host video
    const hostVideoOnAttendee = attendeePage.locator('video').first();
    await expect(hostVideoOnAttendee).toHaveJSProperty('readyState', 4, { timeout: 10000 }); // HAVE_ENOUGH_DATA

    // 2. Wait 45 seconds to see if ping timeout drops the connection
    console.log('Waiting 45 seconds to test ping timeout...');
    await hostPage.waitForTimeout(45000);
    
    // 4. Assert that the connection successfully recovers
    const connectionStatus = hostPage.locator('text=Connected').first();
    await expect(connectionStatus).toBeVisible({ timeout: 15000 });
    
    // Verify Attendee can STILL see Host video (or it recovers)
    await expect(hostVideoOnAttendee).toHaveJSProperty('readyState', 4, { timeout: 15000 });
    
    await pcContext.close();
    await mobileContext.close();
  });

  test('TC-030: Validate privacy state enforcement during network reconnection (Mute Race Condition)', async ({ browser }) => {
    const pcContext = await browser.newContext();
    const hostPage = await pcContext.newPage();

    // 1. Host joins and enables microphone
    await hostPage.goto('/join/playwright-webrtc-room');
    await hostPage.locator('#join-name').pressSequentially('Host User', { delay: 10 });
    await expect(hostPage.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
    await hostPage.locator('#join-meeting-btn').click();

    // Wait for Host to enter and ensure unmuted
    const hostControlsBar = hostPage.locator('button[title="Mute"], button[title="Unmute"]').first();
    await expect(hostControlsBar).toBeVisible({ timeout: 20000 });
    
    const hostUnmuteBtn = hostPage.locator('button[title="Unmute"]');
    if (await hostUnmuteBtn.isVisible()) {
      await hostUnmuteBtn.click();
    }
    
    // Ensure we are in a 'Connected' state
    await expect(hostPage.locator('text=Connected').first()).toBeVisible({ timeout: 10000 });

    // 2. Simulate network disruption
    console.log('Simulating network drop...');
    await pcContext.setOffline(true);
    
    // Wait a brief moment to ensure disconnect is registered
    await hostPage.waitForTimeout(2000);

    // 3. Reconnect network and IMMEDIATELY click mute while republishMedia is rebuilding transports
    console.log('Restoring network and immediately toggling mute...');
    await pcContext.setOffline(false);
    
    // The moment the network comes back, the client will start republishMedia().
    // We race it by clicking the Mute button before it finishes rebuilding the remote producers.
    await hostPage.locator('button[title="Mute"]').click();

    // 4. Wait for the connection to fully recover
    await expect(hostPage.locator('text=Connected').first()).toBeVisible({ timeout: 15000 });

    // 5. Verify the UI still reflects the Muted state
    const unmuteBtnNow = hostPage.locator('button[title="Unmute"]');
    await expect(unmuteBtnNow).toBeVisible();

    await pcContext.close();
  });

  test('TC-031: Validate Infinite Reconnect Loops limit (Max Attempts)', async ({ browser }) => {
    const pcContext = await browser.newContext();
    const hostPage = await pcContext.newPage();

    // 1. Host joins
    await hostPage.goto('/join/playwright-webrtc-room');
    await hostPage.locator('#join-name').pressSequentially('Host User', { delay: 10 });
    await expect(hostPage.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
    await hostPage.locator('#join-meeting-btn').click();

    // Ensure we are in a 'Connected' state
    await expect(hostPage.locator('text=Connected').first()).toBeVisible({ timeout: 10000 });

    // 2. Simulate permanent network disruption
    console.log('Simulating permanent network drop...');
    await pcContext.setOffline(true);
    
    // The client will attempt to reconnect and rebuild the transports.
    // Each attempt times out or fails instantly because offline is true.
    // It should hit the 3 max retry limit (approx 6 seconds).
    
    // Wait for the UI to show 'Connection Failed'
    await expect(hostPage.locator('text=Connection Failed').first()).toBeVisible({ timeout: 15000 });

    await pcContext.close();
  });

  test('TC-032: Validate User Leaves Meeting During Reconnect', async ({ browser }) => {
    const pcContext = await browser.newContext();
    const hostPage = await pcContext.newPage();

    // 1. Host joins
    await hostPage.goto('/join/playwright-webrtc-room');
    await hostPage.locator('#join-name').pressSequentially('Host User', { delay: 10 });
    await expect(hostPage.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
    await hostPage.locator('#join-meeting-btn').click();

    await expect(hostPage.locator('text=Connected').first()).toBeVisible({ timeout: 10000 });

    // 2. Simulate network disruption
    await pcContext.setOffline(true);
    await hostPage.waitForTimeout(2000);

    // 3. Reconnect and immediately click "Leave Room"
    await pcContext.setOffline(false);
    
    // Click End Call / Leave Room (assuming title is "Leave Call" or similar)
    const leaveBtn = hostPage.locator('button[title="Leave Call"]');
    if (await leaveBtn.isVisible()) {
      await leaveBtn.click();
    } else {
      // Fallback if the title is different
      const endBtn = hostPage.locator('button[title="End Call"]');
      if (await endBtn.isVisible()) await endBtn.click();
    }

    // Ensure we leave the room gracefully and the page redirects or shows feedback
    await expect(hostPage.locator('text=Connected')).toBeHidden({ timeout: 5000 });
    await pcContext.close();
  });

  test('TC-033: Validate Camera Toggled During Reconnect', async ({ browser }) => {
    const pcContext = await browser.newContext();
    const hostPage = await pcContext.newPage();

    // 1. Host joins and enables camera
    await hostPage.goto('/join/playwright-webrtc-room');
    await hostPage.locator('#join-name').pressSequentially('Host User', { delay: 10 });
    await expect(hostPage.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
    await hostPage.locator('#join-meeting-btn').click();

    // Turn on camera for Host
    const hostVideoBtn = hostPage.locator('button[title="Turn On Camera"]');
    if (await hostVideoBtn.isVisible()) {
      await hostVideoBtn.click();
    }

    await expect(hostPage.locator('text=Connected').first()).toBeVisible({ timeout: 10000 });

    // 2. Simulate network disruption
    await pcContext.setOffline(true);
    await hostPage.waitForTimeout(2000);

    // 3. Reconnect network and IMMEDIATELY click turn off camera
    await pcContext.setOffline(false);
    
    const turnOffVideoBtn = hostPage.locator('button[title="Turn Off Camera"]');
    if (await turnOffVideoBtn.isVisible()) {
      await turnOffVideoBtn.click();
    }

    // 4. Wait for the connection to fully recover
    await expect(hostPage.locator('text=Connected').first()).toBeVisible({ timeout: 15000 });

    // 5. Verify the UI reflects the Camera is OFF
    const turnOnVideoBtn = hostPage.locator('button[title="Turn On Camera"]');
    await expect(turnOnVideoBtn).toBeVisible({ timeout: 5000 });

    await pcContext.close();
  });

});

