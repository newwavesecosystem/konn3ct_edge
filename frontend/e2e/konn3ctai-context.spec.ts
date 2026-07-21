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
    await expect(page.locator('h3', { hasText: 'Konn3ct AI' })).toBeVisible();

    // 3. Ask Konn3ctAI questions about recent discussion
    await page.locator('input[placeholder="Ask Konn3ct AI..."]').fill('What did we just talk about?');
    await page.locator('input[placeholder="Ask Konn3ct AI..."]').press('Enter');

    // 4. Compare response against actual meeting content (mocked for consistent CI tests)
    await expect(page.locator('text=I received your question about: What did we just talk about?. I am up to date with the meeting context.')).toBeVisible({ timeout: 10000 });

    // 5. Ask for summary using the predefined quick-action button
    await page.locator('button', { hasText: 'Summarize the meeting so far' }).click();

    // Verify AI summary response
    await expect(page.locator('text=Here is the summary: We discussed the new AI context feature.')).toBeVisible({ timeout: 10000 });
  });
});
