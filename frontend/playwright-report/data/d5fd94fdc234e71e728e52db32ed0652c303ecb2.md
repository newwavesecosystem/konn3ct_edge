# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: webrtc.spec.ts >> E2E WebRTC Signaling & Media >> Test 1: WebRTC Handshake & Video Producer setup
- Location: e2e\webrtc.spec.ts:26:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3001/join/playwright-test-room
Call log:
  - navigating to "http://localhost:3001/join/playwright-test-room", waiting until "load"

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | // Shared join helper
  4   | async function joinMeeting(page: any, userName: string) {
> 5   |   await page.goto('/join/playwright-test-room');
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3001/join/playwright-test-room
  6   |   await page.waitForLoadState('networkidle');
  7   | 
  8   |   const nameInput = page.locator('#join-name');
  9   |   await expect(nameInput).toBeVisible({ timeout: 15000 });
  10  |   await nameInput.click();
  11  |   await nameInput.pressSequentially(userName, { delay: 50 });
  12  | 
  13  |   const joinBtn = page.locator('#join-meeting-btn');
  14  |   await expect(joinBtn).toBeEnabled({ timeout: 8000 });
  15  |   await joinBtn.click();
  16  | 
  17  |   // Wait for meeting controls to appear
  18  |   const controlsBar = page.locator('button[title="Mute"], button[title="Unmute"]').first();
  19  |   await expect(controlsBar).toBeVisible({ timeout: 20000 });
  20  | }
  21  | 
  22  | test.describe.configure({ mode: 'serial' });
  23  | 
  24  | test.describe('E2E WebRTC Signaling & Media', () => {
  25  | 
  26  |   test('Test 1: WebRTC Handshake & Video Producer setup', async ({ page }) => {
  27  |     await joinMeeting(page, 'Test User 1');
  28  | 
  29  |     // Turn on camera
  30  |     const camOnBtn = page.locator('button[title="Camera on"]');
  31  |     const camOffBtn = page.locator('button[title="Camera off"]');
  32  |     
  33  |     if (await camOnBtn.isVisible()) {
  34  |       await camOnBtn.click();
  35  |       await expect(camOffBtn).toBeVisible({ timeout: 5000 });
  36  |     }
  37  | 
  38  |     // Verify local video is playing
  39  |     const liveVideoTracks = await page.evaluate(() =>
  40  |       Array.from(document.querySelectorAll('video'))
  41  |         .filter(v => v.srcObject instanceof MediaStream)
  42  |         .flatMap(v => (v.srcObject as MediaStream).getVideoTracks())
  43  |         .filter(t => t.readyState === 'live' && t.enabled).length
  44  |     );
  45  |     expect(liveVideoTracks).toBeGreaterThanOrEqual(1);
  46  |   });
  47  | 
  48  |   test('Test 2: Multi-Peer Video Consume', async ({ browser }) => {
  49  |     const contextA = await browser.newContext();
  50  |     const pageA = await contextA.newPage();
  51  |     await joinMeeting(pageA, 'User A');
  52  | 
  53  |     const contextB = await browser.newContext();
  54  |     const pageB = await contextB.newPage();
  55  |     await joinMeeting(pageB, 'User B');
  56  | 
  57  |     // User A turns on camera
  58  |     const camOnBtnA = pageA.locator('button[title="Camera on"]');
  59  |     if (await camOnBtnA.isVisible()) {
  60  |       await camOnBtnA.click();
  61  |       await expect(pageA.locator('button[title="Camera off"]')).toBeVisible({ timeout: 5000 });
  62  |     }
  63  | 
  64  |     // Give time for WebRTC to negotiate and User B to receive the track
  65  |     await pageB.waitForTimeout(3000);
  66  | 
  67  |     // Verify User B receives User A's video stream
  68  |     const remoteVideoTracksB = await pageB.evaluate(() => {
  69  |       const videos = Array.from(document.querySelectorAll('video'));
  70  |       return videos
  71  |         .filter(v => v.srcObject instanceof MediaStream)
  72  |         .flatMap(v => (v.srcObject as MediaStream).getVideoTracks())
  73  |         .filter(t => t.readyState === 'live').length;
  74  |     });
  75  | 
  76  |     // User B should have their own local (or no local) plus User A's remote
  77  |     expect(remoteVideoTracksB).toBeGreaterThanOrEqual(1);
  78  | 
  79  |     await contextA.close();
  80  |     await contextB.close();
  81  |   });
  82  | 
  83  |   test('Test 3: Active Speaker Propagation', async ({ browser }) => {
  84  |     const contextA = await browser.newContext();
  85  |     const pageA = await contextA.newPage();
  86  |     await joinMeeting(pageA, 'Speaker A');
  87  | 
  88  |     const contextB = await browser.newContext();
  89  |     const pageB = await contextB.newPage();
  90  |     await joinMeeting(pageB, 'Listener B');
  91  | 
  92  |     // Unmute Speaker A
  93  |     const unmuteBtnA = pageA.locator('button[title="Unmute"]');
  94  |     if (await unmuteBtnA.isVisible()) {
  95  |       await unmuteBtnA.click();
  96  |       await expect(pageA.locator('button[title="Mute"]')).toBeVisible({ timeout: 3000 });
  97  |     }
  98  | 
  99  |     // Because we are using fake audio device, it generates a 440hz sine wave continuously.
  100 |     // The backend should detect this and broadcast active_speaker for Speaker A.
  101 |     // We expect Listener B's UI to show the active speaker border.
  102 |     
  103 |     // In our app, active speakers have a specific class or border. We can check if a tile has the glowing border.
  104 |     // The border is applied to ring-2 ring-emerald-500 or similar.
  105 |     
```