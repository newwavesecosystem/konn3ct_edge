import { test, expect } from '@playwright/test';

test.describe('Chat Recipient Selector with Real-Time Search and Stylish Scrollbar', () => {
  test.setTimeout(120000);

  test('TC-CHAT-RECIPIENT-001: Recipient Search, Role Badges, Private Selection & Reset', async ({ browser }) => {
    const hostContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const attendeeContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });

    const hostPage = await hostContext.newPage();
    const attendeePage = await attendeeContext.newPage();

    console.log('[QA] 1. Joining Host');
    await hostPage.goto('/join/playwright-health-room');
    const hostNameInput = hostPage.locator('#join-name');
    await expect(hostNameInput).toBeVisible({ timeout: 15000 });
    await hostNameInput.click();
    await hostNameInput.pressSequentially('Host Alice', { delay: 20 });

    const hostEmailInput = hostPage.locator('#join-email');
    if (await hostEmailInput.isVisible()) {
      await hostEmailInput.click();
      await hostEmailInput.pressSequentially('alice@konn3ct.test', { delay: 20 });
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
    await attNameInput.pressSequentially('Bob Martinez', { delay: 20 });

    const attEmailInput = attendeePage.locator('#join-email');
    if (await attEmailInput.isVisible()) {
      await attEmailInput.click();
      await attEmailInput.pressSequentially('bob@konn3ct.test', { delay: 20 });
    }

    const attJoinBtn = attendeePage.locator('#join-meeting-btn');
    await expect(attJoinBtn).toBeEnabled({ timeout: 8000 });
    await attJoinBtn.click();

    await attendeePage.waitForURL('**/meeting/**', { timeout: 20000 });
    await attendeePage.waitForFunction(() => (window as any).__KONN3CT_WEBRTC__?.sessionStatus === 'active', { timeout: 20000 });

    console.log('[QA] 3. Open Chat Panel on Attendee');
    const chatBtn = attendeePage.locator('[data-testid="panel-chat"]').first();
    await expect(chatBtn).toBeVisible({ timeout: 15000 });
    await chatBtn.click({ force: true });

    // Verify Chat Recipient Trigger is visible and default is "To: Everyone"
    const recipientTrigger = attendeePage.locator('#chat-recipient-trigger');
    await expect(recipientTrigger).toBeVisible({ timeout: 10000 });
    await expect(recipientTrigger).toContainText('To: Everyone');

    console.log('[QA] 4. Open Recipient Dropdown & Verify Search Box');
    await recipientTrigger.click({ force: true });
    const dropdown = attendeePage.locator('#chat-recipient-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    const searchInput = attendeePage.locator('#chat-recipient-search-input');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeFocused();

    // Verify Everyone option and Host Alice are present
    const everyoneOption = attendeePage.locator('#recipient-option-everyone');
    await expect(everyoneOption).toBeVisible();

    console.log('[QA] 5. Search for "Alice" and select Host');
    await searchInput.fill('Alice');
    await expect(attendeePage.locator('text=Host Alice')).toBeVisible();

    const aliceOption = attendeePage.locator('button[role="option"]:has-text("Host Alice")');
    await aliceOption.click({ force: true });

    // Dropdown should close and trigger should show private recipient
    await expect(dropdown).not.toBeVisible({ timeout: 3000 });
    await expect(recipientTrigger).toContainText('To: Host Alice');
    await expect(recipientTrigger).toContainText('Host');

    console.log('[QA] 6. Verify Reset Button to Everyone');
    const resetBtn = attendeePage.locator('button[title*="Switch back to Everyone"]');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click({ force: true });

    await expect(recipientTrigger).toContainText('To: Everyone');
    await expect(resetBtn).not.toBeVisible();

    console.log('[QA] TC-CHAT-RECIPIENT-001 PASS: Recipient search and selection verified successfully.');
    await hostContext.close();
    await attendeeContext.close();
  });

  test('TC-CHAT-RECIPIENT-002: Search Filtering, Empty State & Stylish Scrollbar', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    await page.goto('/join/playwright-health-room');
    const nameInput = page.locator('#join-name');
    await expect(nameInput).toBeVisible({ timeout: 15000 });
    await nameInput.click();
    await nameInput.pressSequentially('Scale Tester', { delay: 20 });

    const emailInput = page.locator('#join-email');
    if (await emailInput.isVisible()) {
      await emailInput.click();
      await emailInput.pressSequentially('scale@konn3ct.test', { delay: 20 });
    }

    const joinBtn = page.locator('#join-meeting-btn');
    await expect(joinBtn).toBeEnabled({ timeout: 8000 });
    await joinBtn.click();

    await page.waitForURL('**/meeting/**', { timeout: 20000 });
    await page.waitForFunction(() => (window as any).__KONN3CT_WEBRTC__?.sessionStatus === 'active', { timeout: 20000 });

    // Open Chat Panel
    const chatBtn = page.locator('[data-testid="panel-chat"]').first();
    await expect(chatBtn).toBeVisible({ timeout: 15000 });
    await chatBtn.click({ force: true });

    const recipientTrigger = page.locator('#chat-recipient-trigger');
    await expect(recipientTrigger).toBeVisible({ timeout: 10000 });
    await recipientTrigger.click({ force: true });

    const dropdown = page.locator('#chat-recipient-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Verify chat-menu-scrollbar class is applied to the scrollable container
    const scrollContainer = dropdown.locator('.chat-menu-scrollbar');
    await expect(scrollContainer).toBeVisible();

    // Test Search input filtering
    const searchInput = page.locator('#chat-recipient-search-input');
    await searchInput.fill('NonExistentUserXYZ');
    await expect(page.locator('text=No participants found')).toBeVisible();

    // Clear search
    await searchInput.fill('');
    await expect(page.locator('#recipient-option-everyone')).toBeVisible();

    console.log('[QA] TC-CHAT-RECIPIENT-002 PASS: Search filtering, empty state and stylish scrollbar container verified.');
    await context.close();
  });
});
