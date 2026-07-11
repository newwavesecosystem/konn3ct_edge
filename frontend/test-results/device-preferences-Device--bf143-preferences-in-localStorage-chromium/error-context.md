# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: device-preferences.spec.ts >> Device Preferences >> can persist notification and theme preferences in localStorage
- Location: e2e\device-preferences.spec.ts:34:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button[title="Settings"]')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]:
          - generic [ref=e8]: S
          - generic [ref=e9]: Playwright Test Room
        - generic [ref=e10]: Disconnected
      - generic [ref=e13]: Meeting · 1 participants
    - generic [ref=e21]:
      - generic [ref=e24]: P
      - generic:
        - generic:
          - generic: PrefsBot
          - generic: (You)
        - generic:
          - img
    - generic [ref=e25]:
      - generic [ref=e26]:
        - generic [ref=e27]: 00:23
        - generic [ref=e28]: Playwright Test Room
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
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe.configure({ mode: 'serial' });
  4  | test.describe('Device Preferences', () => {
  5  |   
  6  |   test.beforeEach(async ({ page }) => {
  7  |     // 1. Navigate to the join screen first so the backend can generate a valid session
  8  |     await page.goto('/join/playwright-test-room');
  9  |     
  10 |     // Wait for full page load and React hydration before interacting
  11 |     // (removed networkidle because websockets/SSE may prevent it)
  12 | 
  13 |     // 2. Fill in the name
  14 |     const nameInput = page.locator('#join-name');
  15 |     await expect(nameInput).toBeVisible({ timeout: 15000 });
  16 |     await nameInput.click();
  17 |     await nameInput.pressSequentially('PrefsBot', { delay: 20 });
  18 | 
  19 |     // Wait for the join button to become enabled
  20 |     const joinBtn = page.locator('#join-meeting-btn');
  21 |     await expect(joinBtn).toBeEnabled({ timeout: 8000 });
  22 |     await joinBtn.click();
  23 |     
  24 |     // 3. Wait up to 20s for the meeting controls bar to appear.
  25 |     const controlsBar = page.locator('button[title="Mute"], button[title="Unmute"]').first();
  26 |     const appeared = await controlsBar.isVisible().catch(() => false);
  27 |     if (!appeared) {
  28 |       await expect(controlsBar).toBeVisible({ timeout: 20000 }).catch(() => {
  29 |         test.skip(true, '⚠ Meeting controls not visible. Ensure the backend is running.');
  30 |       });
  31 |     }
  32 |   });
  33 | 
  34 |   test('can persist notification and theme preferences in localStorage', async ({ page }) => {
  35 |     // Open Settings panel
  36 |     const settingsBtn = page.locator('button[title="Settings"]');
> 37 |     await settingsBtn.click();
     |                       ^ Error: locator.click: Test timeout of 30000ms exceeded.
  38 |     
  39 |     // Wait for settings panel to appear
  40 |     const settingsPanel = page.locator('text="Settings"').first();
  41 |     await expect(settingsPanel).toBeVisible();
  42 | 
  43 |     // Toggle off Master "Enable all pop-up notifications"
  44 |     // Find the toggle by label text
  45 |     const popupsToggleLabel = page.locator('label', { hasText: 'Enable all pop-up notifications' });
  46 |     await expect(popupsToggleLabel).toBeVisible();
  47 |     await popupsToggleLabel.click();
  48 | 
  49 |     // Change Theme to 'slate'
  50 |     const slateThemeBtn = page.locator('button:has-text("Slate")');
  51 |     await expect(slateThemeBtn).toBeVisible();
  52 |     await slateThemeBtn.click();
  53 | 
  54 |     // Give localStorage a moment to sync
  55 |     await page.waitForTimeout(500);
  56 | 
  57 |     // Assert localStorage before reload
  58 |     let localPrefsStr = await page.evaluate(() => localStorage.getItem('konn3ct_meeting_device_preferences_v1'));
  59 |     expect(localPrefsStr).toBeTruthy();
  60 |     let localPrefs = JSON.parse(localPrefsStr!);
  61 |     expect(localPrefs.notifications.enableAllToasts).toBe(false);
  62 |     expect(localPrefs.theme).toBe('slate');
  63 | 
  64 |     // Reload the page
  65 |     await page.reload();
  66 | 
  67 |     // Fast-track joining again
  68 |     const nameInput = page.locator('#join-name');
  69 |     await expect(nameInput).toBeVisible({ timeout: 15000 });
  70 |     await nameInput.click();
  71 |     await nameInput.pressSequentially('PrefsBot', { delay: 20 });
  72 |     const joinBtn = page.locator('#join-meeting-btn');
  73 |     await expect(joinBtn).toBeEnabled();
  74 |     await joinBtn.click();
  75 | 
  76 |     const controlsBar = page.locator('button[title="Mute"], button[title="Unmute"]').first();
  77 |     await expect(controlsBar).toBeVisible({ timeout: 20000 });
  78 | 
  79 |     // Assert localStorage persisted across reload
  80 |     localPrefsStr = await page.evaluate(() => localStorage.getItem('konn3ct_meeting_device_preferences_v1'));
  81 |     localPrefs = JSON.parse(localPrefsStr!);
  82 |     expect(localPrefs.notifications.enableAllToasts).toBe(false);
  83 |     expect(localPrefs.theme).toBe('slate');
  84 | 
  85 |     // Open settings and verify UI hydrated correctly
  86 |     await page.locator('button[title="Settings"]').click();
  87 |     await expect(page.locator('label', { hasText: 'Enable all pop-up notifications' }).locator('button[role="switch"]')).toHaveAttribute('aria-checked', 'false');
  88 |     
  89 |     // Turn pop-ups back on so we don't break subsequent tests
  90 |     await page.locator('label', { hasText: 'Enable all pop-up notifications' }).click();
  91 |   });
  92 | });
  93 | 
```