import { test, expect } from '@playwright/test';

test.describe('WebRTC Meeting Flow', () => {
  test('should enter meeting and interact with media controls', async ({ page }) => {
    // 1. Mock the API calls for guest join so we don't need a real live room
    await page.route('**/kv4/validate-meeting', async route => {
      await route.fulfill({ json: { success: true, room: { id: 'konn3ct' } } });
    });
    
    await page.route('**/api/join', async route => {
      await route.fulfill({ json: { token: 'mock-jwt-token' } });
    });

    // 2. Mock Socket.io polling so MediasoupService doesn't fail and close the room
    await page.route('**/socket.io/?*', async route => {
      if (route.request().method() === 'GET') {
        const url = route.request().url();
        if (url.includes('sid=')) {
          // Keep the polling request hanging so it doesn't loop forever
          return new Promise(() => {}); 
        } else {
          // Initial connection handshake packet
          await route.fulfill({
            status: 200,
            contentType: 'text/plain',
            body: '0{"sid":"mock-sid","upgrades":[],"pingInterval":25000,"pingTimeout":5000}'
          });
        }
      } else {
        // POST requests
        await route.fulfill({ status: 200, body: 'ok' });
      }
    });

    // Navigate to root
    await page.goto('/');

    // Go to Guest Join
    const guestLink = page.getByTestId('welcome-guest-button');
    await guestLink.waitFor({ state: 'visible', timeout: 150000 });
    await guestLink.click();

    // Fill the guest join form
    const nameInput = page.getByTestId('guest-name-input');
    await expect(nameInput).toBeVisible({ timeout: 150000 });
    await nameInput.fill('Playwright Bot');

    const roomInput = page.getByTestId('room-id-input');
    await roomInput.fill('konn3ct');

    // Click Join
    const joinButton = page.getByTestId('guest-join-button');
    await joinButton.click();

    // Wait for the MeetingScreen to mount and display the controls
    const toggleMic = page.getByTestId('toggle-mic');
    await expect(toggleMic).toBeVisible({ timeout: 150000 });

    const toggleCamera = page.getByTestId('toggle-camera');
    await expect(toggleCamera).toBeVisible();

    // The fake devices provided by Playwright will be accessed.
    // Interact with controls
    await toggleMic.click({ force: true });
    await toggleCamera.click({ force: true });

    // Open Chat
    const moreBtn = page.getByTestId('more-button');
    await moreBtn.click({ force: true });
    
    const chatMenuBtn = page.getByTestId('chat-menu-button');
    await chatMenuBtn.click({ force: true });

    // Type a message
    const chatInput = page.getByTestId('chat-input');
    await expect(chatInput).toBeVisible();
    await chatInput.fill('Hello from Playwright!');

    const sendBtn = page.getByTestId('send-chat-button');
    await sendBtn.click();

    // Leave the meeting
    const leaveBtn = page.getByTestId('leave-button');
    await leaveBtn.click({ force: true });

    // Handle the leave confirmation dialog
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    // We should be redirected back to the GuestJoin screen or Login screen
    // The guest join screen should become visible again
    await expect(nameInput).toBeVisible({ timeout: 15000 });
  });
});
