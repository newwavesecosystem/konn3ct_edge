import { test, expect } from '@playwright/test';

test.describe('Konn3ctAI Context Testing', () => {
  test('TC-025: Validate Konn3ctAI response freshness and meeting context accuracy', async ({ page }) => {
    // Intercept the AI chat endpoint to mock the response since real transcription requires live audio
    await page.route('**/api/ai/chat/**', async (route) => {
      const request = route.request();
      const body = JSON.parse(request.postData() || '{}');
      
      if (body.question.toLowerCase().includes('summary') || body.question.toLowerCase().includes('summarize')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ answer: 'Here is the summary: We discussed the new AI context feature.' })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ answer: `I received your question about: ${body.question}. I am up to date with the meeting context.` })
        });
      }
    });

    // 1. Join the meeting
    await page.goto('/join/playwright-health-room');
    await page.locator('#join-name').fill('AI Tester');
    await expect(page.locator('#join-meeting-btn')).toBeEnabled({ timeout: 10000 });
    await page.locator('#join-meeting-btn').click();

    // Wait for meeting controls to appear
    await expect(page.locator('button[title="Konn3ct AI"]')).toBeVisible({ timeout: 15000 });

    // 2. Open AI Panel
    await page.locator('button[title="Konn3ct AI"]').click();

    // Verify AI Panel is open
    await expect(page.locator('h3', { hasText: 'Konn3ct AI' }).first()).toBeVisible();

    // 3. Ask Konn3ctAI questions about recent discussion
    await page.locator('input[placeholder="Ask Konn3ct AI..."]').first().fill('What did we just talk about?');
    await page.locator('input[placeholder="Ask Konn3ct AI..."]').first().press('Enter');

    // 4. Compare response against actual meeting content (mocked for consistent CI tests)
    await expect(page.locator('text=I received your question about: What did we just talk about?. I am up to date with the meeting context.').first()).toBeVisible({ timeout: 10000 });

    // 5. Ask for summary using the predefined quick-action button
    await page.locator('button', { hasText: 'Summarize the meeting so far' }).first().click();

    // Verify AI summary response
    await expect(page.locator('text=Here is the summary: We discussed the new AI context feature.').first()).toBeVisible({ timeout: 10000 });
  });

  test('TC-030: Validate "Summarize the meeting so far" structure', async ({ page }) => {
    await page.route('**/api/ai/chat/**', async (route) => {
      const request = route.request();
      const body = JSON.parse(request.postData() || '{}');
      if (body.question === 'Summarize the meeting so far') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ 
            answer: '### Key Discussion Points\n- Point 1\n### Decisions Made\n- Decision 1\n### Action Items (with Owners)\n- Action 1'
          })
        });
      }
    });

    await page.goto('/join/playwright-health-room');
    await page.locator('#join-name').fill('Test User');
    await page.locator('#join-meeting-btn').click();
    await expect(page.locator('button[title="Konn3ct AI"]')).toBeVisible({ timeout: 15000 });
    await page.locator('button[title="Konn3ct AI"]').click();

    await page.locator('button', { hasText: 'Summarize the meeting so far' }).first().click();

    await expect(page.locator('text=Key Discussion Points').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Decisions Made').first()).toBeVisible();
    await expect(page.locator('text=Action Items (with Owners)').first()).toBeVisible();
  });

  test('TC-031: Validate "Has my name been mentioned?" context identity', async ({ page }) => {
    let capturedUserName = '';
    await page.route('**/api/ai/chat/**', async (route) => {
      const request = route.request();
      const body = JSON.parse(request.postData() || '{}');
      capturedUserName = body.userName || '';
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ answer: `Yes, ${capturedUserName}, your name was mentioned.` })
      });
    });

    await page.goto('/join/playwright-health-room');
    const myName = 'Alice Wonderland';
    await page.locator('#join-name').fill(myName);
    await page.locator('#join-meeting-btn').click();
    await expect(page.locator('button[title="Konn3ct AI"]')).toBeVisible({ timeout: 15000 });
    await page.locator('button[title="Konn3ct AI"]').click();

    await page.locator('input[placeholder="Ask Konn3ct AI..."]').first().fill('Has my name been mentioned?');
    await page.locator('input[placeholder="Ask Konn3ct AI..."]').first().press('Enter');

    await expect(page.locator(`text=Yes, ${myName}, your name was mentioned.`).first()).toBeVisible({ timeout: 10000 });
    expect(capturedUserName).toBe(myName);
  });

  test('TC-032: Validate Konn3ctAI handling of metadata questions', async ({ page }) => {
    // In E2E, we test the UI flow. The actual metadata injection happens on the backend.
    await page.route('**/api/ai/chat/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ answer: 'The Host of this meeting is Bob. There are 2 attendees.' })
      });
    });

    await page.goto('/join/playwright-health-room');
    await page.locator('#join-name').fill('Test User');
    await page.locator('#join-meeting-btn').click();
    await expect(page.locator('button[title="Konn3ct AI"]')).toBeVisible({ timeout: 15000 });
    await page.locator('button[title="Konn3ct AI"]').click();

    await page.locator('input[placeholder="Ask Konn3ct AI..."]').first().fill('Who is the host?');
    await page.locator('input[placeholder="Ask Konn3ct AI..."]').first().press('Enter');

    await expect(page.locator('text=The Host of this meeting is Bob.').first()).toBeVisible({ timeout: 10000 });
  });
});

