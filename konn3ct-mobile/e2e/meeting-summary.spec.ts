import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
// Read .env to check if SHOW_AI is false
const envPath = path.join(process.cwd(), '.env');
let isAiHidden = false;
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  isAiHidden = envContent.includes('EXPO_PUBLIC_SHOW_AI=false') || envContent.includes('EXPO_PUBLIC_GOV_LOGIN=true');
}

test.describe('Meeting Summary Flow', () => {
  test('should display AI summary, action items, and transcripts', async ({ page }) => {
    test.skip(isAiHidden, 'AI features are disabled in this environment');
    // Mock login and navigation
    const loginMock = (route: any) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'fake-token',
          access_token: 'fake-token',
          user: { name: 'Test User', email: 'test@example.com' },
          data: { name: 'Test User', email: 'test@example.com' }
        })
      });
    };
    await page.route(/.*login.*/, loginMock);
    
    // Mocks for Dashboard past summaries
    await page.route(/.*ai\/summaries.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { roomId: 'room123', roomName: 'Test AI Room', roomSlug: 'test-ai-room' }
        ])
      });
    });

    await page.route(/.*dashboard.*/, route => route.fulfill({ status: 200, body: '{}' }));
    await page.route(/.*schedule.*/, route => route.fulfill({ status: 200, body: '{"data":[]}' }));
    await page.route(/.*profile.*/, route => route.fulfill({ status: 200, body: '{"data":{}}' }));

    // Mock AI endpoints
    await page.route(/.*ai\/summary.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary: 'This is a mock AI generated summary for the meeting.',
          actionItems: JSON.stringify(['Implement new design', 'Fix bugs'])
        })
      });
    });

    await page.route(/.*ai\/transcription.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { content: 'Hello everyone.' },
          { content: 'Let us start the meeting.' }
        ])
      });
    });

    await page.goto('/');
    const signInButton = page.getByTestId('welcome-signin-button');
    await signInButton.waitFor({ state: 'visible', timeout: 15000 });
    await signInButton.click();
    
    const mdaInput = page.getByTestId('mda-input');
    if (await mdaInput.isVisible()) {
      await mdaInput.fill('test-mda');
    }
    await page.getByTestId('email-input').fill('test@example.com');
    await page.getByTestId('password-input').fill('password123');
    await page.getByTestId('login-button').click();

    // Click the AI Intelligence card on the dashboard
    const aiCard = page.getByText('Test AI Room');
    await expect(aiCard).toBeVisible({ timeout: 15000 });
    await aiCard.click();

    // Verify AI Summary loaded
    await expect(page.getByText('AI Summary', { exact: true })).toBeVisible();
    await expect(page.getByText('This is a mock AI generated summary for the meeting.')).toBeVisible();
    await expect(page.getByText('Implement new design')).toBeVisible();
    await expect(page.getByText('Hello everyone.')).toBeVisible();
  });
});
