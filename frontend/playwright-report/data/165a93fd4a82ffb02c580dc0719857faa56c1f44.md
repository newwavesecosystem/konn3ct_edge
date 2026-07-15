# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: webrtc.spec.ts >> E2E WebRTC Signaling & Media >> Test 1: WebRTC Handshake & Video Producer setup
- Location: e2e\webrtc.spec.ts:26:7

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 1
Received:    0

Call Log:
- Test timeout of 30000ms exceeded
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]:
          - generic [ref=e8]: S
          - generic [ref=e9]: Playwright Webrtc Room
        - generic [ref=e10]: Disconnected
      - generic [ref=e13]: Meeting · 1 participants
    - generic [ref=e21]:
      - generic [ref=e24]: TU
      - generic:
        - generic:
          - generic: Test User 1
          - generic: (You)
        - generic:
          - img
    - generic [ref=e25]:
      - generic [ref=e26]:
        - generic [ref=e27]: 00:22
        - generic [ref=e28]: Playwright Webrtc Room
        - button "Enable Captions" [ref=e29]:
          - img [ref=e30]
      - generic [ref=e33]:
        - button "Mute" [ref=e34]:
          - img [ref=e35]
        - button "Camera off" [ref=e38]:
          - img [ref=e39]
        - button "Share screen" [ref=e43]:
          - img [ref=e44]
        - button "React" [ref=e47]:
          - img [ref=e48]
        - button "Raise hand" [ref=e51]:
          - img [ref=e52]
        - button "More" [ref=e59]:
          - img [ref=e60]
        - button "End" [ref=e64]:
          - img [ref=e65]
          - generic [ref=e69]: End
      - generic [ref=e70]:
        - generic [ref=e71]:
          - button "Speaker" [ref=e72]:
            - img [ref=e73]
          - button "Grid" [ref=e76]:
            - img [ref=e77]
          - button "Spotlight" [ref=e82]:
            - img [ref=e83]
        - button "Konn3ct AI" [ref=e89]:
          - img [ref=e90]
        - button "Chat" [ref=e93]:
          - img [ref=e94]
        - button "People" [ref=e96]:
          - img [ref=e97]
    - button "QA Diagnostics" [ref=e103]:
      - img [ref=e104]
  - region "Notifications alt+T"
  - generic [ref=e117] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e118]:
      - img [ref=e119]
    - generic [ref=e122]:
      - button "Open issues overlay" [ref=e123]:
        - generic [ref=e124]:
          - generic [ref=e125]: "1"
          - generic [ref=e126]: "2"
        - generic [ref=e127]:
          - text: Issue
          - generic [ref=e128]: s
      - button "Collapse issues badge" [ref=e129]:
        - img [ref=e130]
  - alert [ref=e132]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | // Shared join helper
  4   | async function joinMeeting(page: any, userName: string) {
  5   |   await page.goto('/join/playwright-webrtc-room');
  6   |   await page.waitForLoadState('domcontentloaded');
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
  38  |     await expect.poll(async () => {
  39  |       const { count, states } = await page.evaluate(() => {
  40  |         const videos = Array.from(document.querySelectorAll('video'));
  41  |         const statesData = videos.map(v => {
  42  |           const stream = v.srcObject as MediaStream;
  43  |           return {
  44  |             isStream: stream instanceof MediaStream,
  45  |             trackCount: stream?.getVideoTracks?.()?.length || 0,
  46  |             states: stream?.getVideoTracks?.()?.map(t => t.readyState) || []
  47  |           };
  48  |         });
  49  |         return { count: statesData.flatMap(s => s.states).filter(s => s === 'live').length, states: statesData };
  50  |       });
  51  |       console.log('Node Video states:', JSON.stringify(states));
  52  |       return count;
> 53  |     }, { timeout: 30000 }).toBeGreaterThanOrEqual(1);
      |                            ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  54  |   });
  55  | 
  56  |   test.skip('Test 2: Multi-Peer Video Consume', async ({ browser }) => {
  57  |     const contextA = await browser.newContext();
  58  |     const pageA = await contextA.newPage();
  59  |     await joinMeeting(pageA, 'User A');
  60  | 
  61  |     const contextB = await browser.newContext();
  62  |     const pageB = await contextB.newPage();
  63  |     await joinMeeting(pageB, 'User B');
  64  | 
  65  |     // User A turns on camera
  66  |     const camOnBtnA = pageA.locator('button[title="Camera on"]');
  67  |     if (await camOnBtnA.isVisible()) {
  68  |       await camOnBtnA.click();
  69  |       await expect(pageA.locator('button[title="Camera off"]')).toBeVisible({ timeout: 5000 });
  70  |     }
  71  | 
  72  |     // Give time for WebRTC to negotiate and User B to receive the track
  73  |     await pageB.waitForTimeout(3000);
  74  | 
  75  |     // Give time for WebRTC to negotiate and User B to receive the track
  76  |     // User B should have their own local (or no local) plus User A's remote
  77  |     await expect.poll(async () => {
  78  |       return await pageB.evaluate(() => {
  79  |         const videos = Array.from(document.querySelectorAll('video'));
  80  |         return videos
  81  |           .filter(v => v.srcObject instanceof MediaStream)
  82  |           .flatMap(v => (v.srcObject as MediaStream).getVideoTracks())
  83  |           .filter(t => t.readyState === 'live').length;
  84  |       });
  85  |     }, { timeout: 30000 }).toBeGreaterThanOrEqual(1);
  86  | 
  87  |     // Playwright will automatically clean up contexts at the end of the test.
  88  |   });
  89  | 
  90  |   test.skip('Test 3: Active Speaker Propagation', async ({ browser }) => {
  91  |     const contextA = await browser.newContext();
  92  |     const pageA = await contextA.newPage();
  93  |     await joinMeeting(pageA, 'Speaker A');
  94  | 
  95  |     const contextB = await browser.newContext();
  96  |     const pageB = await contextB.newPage();
  97  |     await joinMeeting(pageB, 'Listener B');
  98  | 
  99  |     // Unmute Speaker A
  100 |     const unmuteBtnA = pageA.locator('button[title="Unmute"]');
  101 |     if (await unmuteBtnA.isVisible()) {
  102 |       await unmuteBtnA.click();
  103 |       await expect(pageA.locator('button[title="Mute"]')).toBeVisible({ timeout: 3000 });
  104 |     }
  105 | 
  106 |     // Because we are using fake audio device, it generates a 440hz sine wave continuously.
  107 |     // The backend should detect this and broadcast active_speaker for Speaker A.
  108 |     // We expect Listener B's UI to show the active speaker border.
  109 |     
  110 |     // In our app, active speakers have a specific class or border. We can    // Since Test User 1's synthetic mic emits a 440Hz tone constantly, 
  111 |     // it should be detected as an active speaker by the backend within a few seconds.
  112 |     const glowingTile = pageB.locator('.border-brand-green').first();
  113 |     // Wait up to 10 seconds for the backend to run audio-level observing and send the event
  114 |     await expect(glowingTile).toBeVisible({ timeout: 10000 });
  115 | 
  116 |     // Playwright will automatically clean up contexts at the end of the test.
  117 |   });
  118 | 
  119 |   test.skip('Test 4: Ask to Unmute', async ({ browser }) => {
  120 |     const contextA = await browser.newContext();
  121 |     const pageA = await contextA.newPage();
  122 |     await joinMeeting(pageA, 'Host A');
  123 | 
  124 |     const contextB = await browser.newContext();
  125 |     const pageB = await contextB.newPage();
  126 |     await joinMeeting(pageB, 'Attendee B');
  127 | 
  128 |     // Host A locks the mic
  129 |     await pageA.locator('button[title="Security"]').click();
  130 |     await pageA.locator('label', { hasText: 'Lock Microphones' }).click();
  131 | 
  132 |     // Attendee B's mic is locked
  133 |     await expect(pageB.locator('button[title="Unmute"]')).toBeDisabled({ timeout: 5000 });
  134 | 
  135 |     // Host A asks Attendee B to unmute
  136 |     await pageA.locator('button[title="Participants"]').click();
  137 |     
  138 |     // Hover over Attendee B to show the "Ask to Unmute" button
  139 |     const participantRowB = pageA.locator('.flex-1.min-w-0', { hasText: 'Attendee B' }).locator('..');
  140 |     await participantRowB.hover();
  141 |     await participantRowB.locator('button[title="Ask to Unmute"]').click();
  142 | 
  143 |     // Attendee B should get a toast
  144 |     const toastBtn = pageB.locator('button', { hasText: 'Unmute Now' });
  145 |     await expect(toastBtn).toBeVisible({ timeout: 10000 });
  146 |     await toastBtn.click();
  147 | 
  148 |     // Attendee B's mic should be enabled and unmuted
  149 |     const muteBtnB = pageB.locator('button[title="Mute"]');
  150 |     await expect(muteBtnB).toBeEnabled({ timeout: 5000 });
  151 |     await expect(muteBtnB).toBeVisible();
  152 | 
  153 |     // Playwright will automatically clean up contexts at the end of the test.
```