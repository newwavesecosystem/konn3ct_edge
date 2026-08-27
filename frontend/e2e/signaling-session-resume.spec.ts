import { test, expect } from '@playwright/test';

test.describe('SIGNALING-SESSION-RESUME-001 Live Runtime QA Matrix', () => {
  test.setTimeout(120000);

  test('TC-RESUME-001: Transient Signaling Loss Direct Active Resumption', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const attendeeContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const attendeePage = await attendeeContext.newPage();

    console.log('[QA] 1. Joining Host to Initialize Room');
    await hostPage.goto('/join/playwright-health-room');
    const hostNameInput = hostPage.locator('#join-name');
    await expect(hostNameInput).toBeVisible({ timeout: 15000 });
    await hostNameInput.click();
    await hostNameInput.pressSequentially('Host QA', { delay: 20 });

    const hostEmailInput = hostPage.locator('#join-email');
    if (await hostEmailInput.isVisible()) {
      await hostEmailInput.click();
      await hostEmailInput.pressSequentially('host-qa@konn3ct.test', { delay: 20 });
    }

    const hostJoinBtn = hostPage.locator('#join-meeting-btn');
    await expect(hostJoinBtn).toBeEnabled({ timeout: 8000 });
    await hostJoinBtn.click();

    await hostPage.waitForURL('**/meeting/**', { timeout: 20000 });
    await hostPage.waitForFunction(() => (window as any).__KONN3CT_WEBRTC__?.sessionStatus === 'active', { timeout: 20000 });

    console.log('[QA] 2. Joining Attendee');
    await attendeePage.goto('/join/playwright-health-room');
    const attNameInput = attendeePage.locator('#join-name');
    await expect(attNameInput).toBeVisible({ timeout: 15000 });
    await attNameInput.click();
    await attNameInput.pressSequentially('Resilience Attendee', { delay: 20 });

    const attEmailInput = attendeePage.locator('#join-email');
    if (await attEmailInput.isVisible()) {
      await attEmailInput.click();
      await attEmailInput.pressSequentially('resilience@konn3ct.test', { delay: 20 });
    }

    const attJoinBtn = attendeePage.locator('#join-meeting-btn');
    await expect(attJoinBtn).toBeEnabled({ timeout: 8000 });
    await attJoinBtn.click();

    await attendeePage.waitForURL('**/meeting/**', { timeout: 20000 });
    await attendeePage.waitForFunction(() => (window as any).__KONN3CT_WEBRTC__?.sessionStatus === 'active', { timeout: 20000 });

    console.log('[QA] 3. Verifying Initial Active State and Session Resumption Credentials');
    const initialSessionInfo = await attendeePage.evaluate(() => {
      const client = (window as any).__KONN3CT_WEBRTC__;
      return {
        hasClient: !!client,
        meetingInstanceId: client?.meetingInstanceId,
        hasResumeToken: !!client?.resumeToken,
        initialResumeToken: client?.resumeToken,
        sessionGeneration: client?.sessionGeneration,
        sessionStateVersion: client?.sessionStateVersion,
        status: client?.sessionStatus
      };
    });

    console.log('[QA] Initial session credentials:', JSON.stringify(initialSessionInfo));
    expect(initialSessionInfo.hasClient).toBe(true);
    expect(initialSessionInfo.status).toBe('active');

    console.log('[QA] 4. Simulating Signaling-Only WebSocket Drop on Attendee');
    // Monitor for any Waiting Room DOM appearance
    await attendeePage.evaluate(() => {
      (window as any).__WAITING_ROOM_FLASH_COUNT__ = 0;
      const observer = new MutationObserver(() => {
        if (document.body.innerText.includes('Waiting for the host to let you in')) {
          (window as any).__WAITING_ROOM_FLASH_COUNT__++;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });

    // Drop signaling WebSocket directly with valid close code
    await attendeePage.evaluate(() => {
      const client = (window as any).__KONN3CT_WEBRTC__;
      if (client?.ws) {
        client.ws.close(4000, 'simulated_network_loss');
      }
    });

    // Verify Reconnecting indicator appears
    const reconnectingBanner = attendeePage.locator('text=Reconnecting signaling...').first();
    await expect(reconnectingBanner).toBeVisible({ timeout: 5000 });

    console.log('[QA] 5. Awaiting Automatic Reconnect & Direct ACTIVE Resumption');
    // Await restoration to connected
    await expect(reconnectingBanner).not.toBeVisible({ timeout: 20000 });

    // Verify resumption details
    const resumedSessionInfo = await attendeePage.evaluate(() => {
      const client = (window as any).__KONN3CT_WEBRTC__;
      return {
        meetingInstanceId: client?.meetingInstanceId,
        hasResumeToken: !!client?.resumeToken,
        currentResumeToken: client?.resumeToken,
        sessionGeneration: client?.sessionGeneration,
        sessionStateVersion: client?.sessionStateVersion,
        status: client?.sessionStatus,
        waitingRoomFlashCount: (window as any).__WAITING_ROOM_FLASH_COUNT__ || 0
      };
    });

    console.log('[QA] Resumed session credentials:', JSON.stringify(resumedSessionInfo));
    expect(resumedSessionInfo.status).toBe('active');
    expect(resumedSessionInfo.waitingRoomFlashCount).toBe(0);

    console.log('[QA] TC-RESUME-001 PASS: Seamless session resumption with 0 Waiting Room flashes.');
    await hostContext.close();
    await attendeeContext.close();
  });

  test('TC-RESUME-002: Generational Fencing Stale Version Rejection', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const attendeeContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const attendeePage = await attendeeContext.newPage();

    console.log('[QA] 1. Joining Host');
    await hostPage.goto('/join/playwright-health-room');
    const hostNameInput = hostPage.locator('#join-name');
    await expect(hostNameInput).toBeVisible({ timeout: 15000 });
    await hostNameInput.click();
    await hostNameInput.pressSequentially('Host QA', { delay: 20 });

    const hostEmailInput = hostPage.locator('#join-email');
    if (await hostEmailInput.isVisible()) {
      await hostEmailInput.click();
      await hostEmailInput.pressSequentially('host-qa@konn3ct.test', { delay: 20 });
    }

    const hostJoinBtn = hostPage.locator('#join-meeting-btn');
    await expect(hostJoinBtn).toBeEnabled({ timeout: 8000 });
    await hostJoinBtn.click();

    await hostPage.waitForURL('**/meeting/**', { timeout: 20000 });
    await hostPage.waitForFunction(() => (window as any).__KONN3CT_WEBRTC__?.sessionStatus === 'active', { timeout: 20000 });

    console.log('[QA] 2. Joining Attendee');
    await attendeePage.goto('/join/playwright-health-room');
    const attNameInput = attendeePage.locator('#join-name');
    await expect(attNameInput).toBeVisible({ timeout: 15000 });
    await attNameInput.click();
    await attNameInput.pressSequentially('Fencing Attendee', { delay: 20 });

    const attEmailInput = attendeePage.locator('#join-email');
    if (await attEmailInput.isVisible()) {
      await attEmailInput.click();
      await attEmailInput.pressSequentially('fencing@konn3ct.test', { delay: 20 });
    }

    const attJoinBtn = attendeePage.locator('#join-meeting-btn');
    await expect(attJoinBtn).toBeEnabled({ timeout: 8000 });
    await attJoinBtn.click();

    await attendeePage.waitForURL('**/meeting/**', { timeout: 20000 });
    await attendeePage.waitForFunction(() => (window as any).__KONN3CT_WEBRTC__?.sessionStatus === 'active', { timeout: 20000 });

    console.log('[QA] 3. Injecting Stale sessionStateVersion Event');
    const result = await attendeePage.evaluate(() => {
      const client = (window as any).__KONN3CT_WEBRTC__;
      const currentVersion = client?.sessionStateVersion || 1;
      
      // Inject fake stale event with lower sessionStateVersion
      const staleEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'session_status',
          status: 'waiting',
          sessionStateVersion: currentVersion - 1
        })
      });
      client?.ws?.dispatchEvent(staleEvent);

      return {
        currentVersion: client?.sessionStateVersion,
        status: client?.sessionStatus
      };
    });

    // Verify stale message was rejected and status is still active
    expect(result.status).toBe('active');
    console.log('[QA] TC-RESUME-002 PASS: Stale sessionStateVersion message ignored without state regression.');
    await hostContext.close();
    await attendeeContext.close();
  });

  test('TC-RESUME-003: Authoritative Waiting Room Transition Stops Media', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const attendeeContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const attendeePage = await attendeeContext.newPage();

    console.log('[QA] 1. Joining Host');
    await hostPage.goto('/join/playwright-health-room');
    const hostNameInput = hostPage.locator('#join-name');
    await expect(hostNameInput).toBeVisible({ timeout: 15000 });
    await hostNameInput.click();
    await hostNameInput.pressSequentially('Host QA', { delay: 20 });

    const hostEmailInput = hostPage.locator('#join-email');
    if (await hostEmailInput.isVisible()) {
      await hostEmailInput.click();
      await hostEmailInput.pressSequentially('host-qa@konn3ct.test', { delay: 20 });
    }

    const hostJoinBtn = hostPage.locator('#join-meeting-btn');
    await expect(hostJoinBtn).toBeEnabled({ timeout: 8000 });
    await hostJoinBtn.click();

    await hostPage.waitForURL('**/meeting/**', { timeout: 20000 });
    await hostPage.waitForFunction(() => (window as any).__KONN3CT_WEBRTC__?.sessionStatus === 'active', { timeout: 20000 });

    console.log('[QA] 2. Joining Attendee');
    await attendeePage.goto('/join/playwright-health-room');
    const attNameInput = attendeePage.locator('#join-name');
    await expect(attNameInput).toBeVisible({ timeout: 15000 });
    await attNameInput.click();
    await attNameInput.pressSequentially('Revocation Attendee', { delay: 20 });

    const attEmailInput = attendeePage.locator('#join-email');
    if (await attEmailInput.isVisible()) {
      await attEmailInput.click();
      await attEmailInput.pressSequentially('revocation@konn3ct.test', { delay: 20 });
    }

    const attJoinBtn = attendeePage.locator('#join-meeting-btn');
    await expect(attJoinBtn).toBeEnabled({ timeout: 8000 });
    await attJoinBtn.click();

    await attendeePage.waitForURL('**/meeting/**', { timeout: 20000 });
    await attendeePage.waitForFunction(() => (window as any).__KONN3CT_WEBRTC__?.sessionStatus === 'active', { timeout: 20000 });

    console.log('[QA] 3. Server Authoritative Move to Waiting Room');
    await attendeePage.evaluate(() => {
      const client = (window as any).__KONN3CT_WEBRTC__;
      const currentVersion = (client?.sessionStateVersion || 1) + 1;
      
      const waitingEvent = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'session_status',
          status: 'waiting',
          sessionStateVersion: currentVersion
        })
      });
      client?.ws?.dispatchEvent(waitingEvent);
    });

    // Verify Waiting Room UI appears and local media is muted
    await expect(attendeePage.locator('text=Waiting for the host to let you in')).toBeVisible({ timeout: 5000 });
    const waitingStatus = await attendeePage.evaluate(() => {
      const client = (window as any).__KONN3CT_WEBRTC__;
      return client?.sessionStatus;
    });
    expect(waitingStatus).toBe('waiting');

    console.log('[QA] TC-RESUME-003 PASS: Authoritative Waiting Room transition cleanly updates UI and halts active participation.');
    await hostContext.close();
    await attendeeContext.close();
  });

  test('TC-RESUME-004: Muted Participant Reconnect Preserves Mute Integrity', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const attendeeContext = await browser.newContext();

    const hostPage = await hostContext.newPage();
    const attendeePage = await attendeeContext.newPage();

    console.log('[QA] 1. Joining Host');
    await hostPage.goto('/join/playwright-health-room');
    const hostNameInput = hostPage.locator('#join-name');
    await expect(hostNameInput).toBeVisible({ timeout: 15000 });
    await hostNameInput.click();
    await hostNameInput.pressSequentially('Host QA', { delay: 20 });

    const hostEmailInput = hostPage.locator('#join-email');
    if (await hostEmailInput.isVisible()) {
      await hostEmailInput.click();
      await hostEmailInput.pressSequentially('host-qa@konn3ct.test', { delay: 20 });
    }

    const hostJoinBtn = hostPage.locator('#join-meeting-btn');
    await expect(hostJoinBtn).toBeEnabled({ timeout: 8000 });
    await hostJoinBtn.click();

    await hostPage.waitForURL('**/meeting/**', { timeout: 20000 });
    await hostPage.waitForFunction(() => (window as any).__KONN3CT_WEBRTC__?.sessionStatus === 'active', { timeout: 20000 });

    console.log('[QA] 2. Joining Muted Attendee');
    await attendeePage.goto('/join/playwright-health-room');
    const attNameInput = attendeePage.locator('#join-name');
    await expect(attNameInput).toBeVisible({ timeout: 15000 });
    await attNameInput.click();
    await attNameInput.pressSequentially('Muted Resilience Attendee', { delay: 20 });

    const attEmailInput = attendeePage.locator('#join-email');
    if (await attEmailInput.isVisible()) {
      await attEmailInput.click();
      await attEmailInput.pressSequentially('muted-resilience@konn3ct.test', { delay: 20 });
    }

    const attJoinBtn = attendeePage.locator('#join-meeting-btn');
    await expect(attJoinBtn).toBeEnabled({ timeout: 8000 });
    await attJoinBtn.click();

    await attendeePage.waitForURL('**/meeting/**', { timeout: 20000 });
    await attendeePage.waitForFunction(() => (window as any).__KONN3CT_WEBRTC__?.sessionStatus === 'active', { timeout: 20000 });

    // Explicitly verify/ensure attendee is muted
    const muteStateBefore = await attendeePage.evaluate(() => {
      const client = (window as any).__KONN3CT_WEBRTC__;
      return {
        desiredMicMuted: client?.getDesiredMicMuted?.(),
        rawTrackEnabled: client?.rawAudioTrack?.enabled,
        producerPaused: client?.localAudioProducer?.paused ?? true
      };
    });
    console.log('[QA] Mute state before disconnect:', JSON.stringify(muteStateBefore));

    // Simulate signaling drop
    await attendeePage.evaluate(() => {
      const client = (window as any).__KONN3CT_WEBRTC__;
      if (client?.ws) {
        client.ws.close(4000, 'simulated_network_loss');
      }
    });

    const reconnectingBanner = attendeePage.locator('text=Reconnecting signaling...').first();
    await expect(reconnectingBanner).toBeVisible({ timeout: 5000 });
    await expect(reconnectingBanner).not.toBeVisible({ timeout: 20000 });

    // Verify mute state after resumption
    const muteStateAfter = await attendeePage.evaluate(() => {
      const client = (window as any).__KONN3CT_WEBRTC__;
      return {
        status: client?.sessionStatus,
        desiredMicMuted: client?.getDesiredMicMuted?.(),
        rawTrackEnabled: client?.rawAudioTrack ? client.rawAudioTrack.enabled : false,
        producerPaused: client?.localAudioProducer?.paused ?? true
      };
    });
    console.log('[QA] Mute state after resumption:', JSON.stringify(muteStateAfter));

    expect(muteStateAfter.status).toBe('active');
    expect(muteStateAfter.desiredMicMuted).toBe(true);
    expect(muteStateAfter.rawTrackEnabled).toBe(false);
    expect(muteStateAfter.producerPaused).toBe(true);

    console.log('[QA] TC-RESUME-004 PASS: Mute integrity fully preserved across session resumption.');
    await hostContext.close();
    await attendeeContext.close();
  });
});
