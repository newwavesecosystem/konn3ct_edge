/**
 * Playwright Global Setup
 * =======================
 * Runs ONCE before all tests. Creates the test room in the database and
 * seeds any other required test data. The matching globalTeardown cleans up.
 *
 * Usage: referenced in playwright.config.ts as `globalSetup: './e2e/global-setup.ts'`
 *
 * IMPORTANT: Requires the backend to be running on localhost:3000
 */
import { chromium, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';

// The room slug used by all controls and media-health tests
export const TEST_ROOM_SLUG = 'playwright-test-room';
export const TEST_ROOM_NAME = 'Playwright Test Room';

export default async function globalSetup(config: FullConfig) {
  console.log('\n🔧 [Global Setup] Creating test room in database...\n');

  try {
    // Use a small Node.js script to upsert the room via Prisma directly.
    // We run it in the backend's context (project root) so it shares the same
    // Prisma client and DATABASE_URL.
    const setupScript = `
      const { PrismaClient } = require('@prisma/client');
      const db = new PrismaClient();

      async function main() {
        const owner = await db.user.upsert({
          where: { email: 'playwright-bot@konn3ct.test' },
          update: {},
          create: {
            email: 'playwright-bot@konn3ct.test',
            name: 'Playwright Bot',
            passwordHash: 'not-used',
          },
        });

        console.log('\\n🔧 [Global Setup] Creating test rooms in database...');
    
        for (const slug of ['playwright-prefs-room', 'playwright-health-room', 'playwright-webrtc-room', 'playwright-waiting-room', 'playwright-polls-room', 'playwright-roles-room']) {
          await db.room.upsert({
            where: { slug },
            update: { guestJoinAllowed: true, isWaitingRoomEnabled: slug === 'playwright-waiting-room' },
            create: {
              name: slug.replace(/-/g, ' '),
              slug,
              ownerId: owner.id,
              guestJoinAllowed: true,
              isWaitingRoomEnabled: slug === 'playwright-waiting-room',
              aiFeaturesEnabled: false,
            }
          });
          console.log(\`Room upserted: \${slug}\`);
        }

        console.log('\\n✅ [Global Setup] Test rooms ready.\\n');
        await db.$disconnect();
      }

      main().catch(e => { console.error(e); process.exit(1); });
    `;

    execSync(`node -e "${setupScript.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`, {
      cwd: path.resolve(__dirname, '../../'), // project root (where Prisma is)
      stdio: 'inherit',
    });

    console.log('\n✅ [Global Setup] Test room ready.\n');
  } catch (err: any) {
    // If DB setup fails, print a clear warning but don't abort all tests.
    // Controls & media-health tests will self-skip via their beforeEach guard.
    console.warn('\n⚠ [Global Setup] Could not seed test room:', err.message);
    console.warn('   Controls & media-health tests will be skipped automatically.\n');
  }
}
