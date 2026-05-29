import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  // Seed DB and clean up before/after the entire suite
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  globalTeardown: require.resolve('./e2e/global-teardown.ts'),
  /* Maximum time one test can run for. */
  timeout: 30 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     */
    timeout: 5000
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3001', // Next.js runs on 3001 typically, or 3000
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    // Set backend domain so WebSocket connects to LOCAL backend, not production
    extraHTTPHeaders: {},

    // VERY IMPORTANT FOR WEBRTC: Fake camera and microphone
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
      env: {
        // Run tests against the actual staging/production WebRTC edge server
        NEXT_PUBLIC_BACKEND_DOMAIN: 'konn3ctedge.konn3ct.net',
      },
    },
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Only auto-start the frontend. The backend (with mediasoup/WebRTC) must be
  // started manually with 'npm run dev' from the project root before running E2E tests.
  webServer: [
    {
      command: 'npm run dev -- -p 3001',
      cwd: './',
      port: 3001,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    }
  ],
});
